import { env } from "../config/env.js";
import { convex } from "./convex.js";
import { getQueueMetrics } from "./user-message-queue.js";

type OverallHealthStatus = "healthy" | "degraded" | "unhealthy";
type ServiceStatus = "up" | "down";

interface ServiceHealth {
  status: ServiceStatus;
  latencyMs?: number;
  error?: string;
}

export interface HealthStatus {
  status: OverallHealthStatus;
  uptime: string;
  memory: {
    rss: string;
    heapUsed: string;
  };
  services: {
    venice: ServiceHealth;
    fal: ServiceHealth;
    convex: ServiceHealth;
  };
  metrics: {
    activeUsers24h: number;
    messagesLastHour: number;
    errorsLastHour: number;
    queueActiveUsers: number;
    queuePendingMessages: number;
    queueRunningTasks: number;
    queueWaitingForSlot: number;
  };
}

export interface SystemMetrics {
  memory: {
    rssBytes: number;
    heapUsedBytes: number;
    rss: string;
    heapUsed: string;
  };
  cpu: {
    usagePercent: number;
  };
  throughput: {
    messagesLastHour: number;
    messagesPerMinute: number;
  };
  queue: {
    activeUsers: number;
    pendingMessages: number;
    runningTasks: number;
    waitingForSlot: number;
  };
  errors: {
    lastHour: number;
    errorRatePerHour: number;
  };
  activeUsers24h: number;
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const MEMORY_WARN_BYTES = 512 * 1024 * 1024;
const MEMORY_CRITICAL_BYTES = 768 * 1024 * 1024;

const errorTimestamps: number[] = [];

let healthMonitorTimer: NodeJS.Timeout | null = null;
let previousCpuSample = process.cpuUsage();
let previousCpuSampleAt = Date.now();

function markError(): void {
  errorTimestamps.push(Date.now());
  pruneOldErrorEntries();
}

function pruneOldErrorEntries(): void {
  const cutoff = Date.now() - ONE_HOUR_MS;
  while (errorTimestamps.length > 0 && errorTimestamps[0] < cutoff) {
    errorTimestamps.shift();
  }
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${Math.round(mb)}MB`;
}

function formatUptime(seconds: number): string {
  const totalSeconds = Math.floor(seconds);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

async function timedFetch(
  url: string,
  options: RequestInit
): Promise<{ response: Response; latencyMs: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return { response, latencyMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkVenice(): Promise<ServiceHealth> {
  try {
    const { response, latencyMs } = await timedFetch(
      "https://api.venice.ai/api/v1/models",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${env.VENICE_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return { status: "up", latencyMs };
  } catch (error) {
    markError();
    return { status: "down", error: sanitizeErrorMessage(error) };
  }
}

async function checkFal(): Promise<ServiceHealth> {
  try {
    const { response, latencyMs } = await timedFetch("https://queue.fal.run", {
      method: "GET",
      headers: {
        Authorization: `Key ${env.FAL_KEY}`,
      },
    });

    if (response.status >= 500) {
      throw new Error(`HTTP ${response.status}`);
    }

    return { status: "up", latencyMs };
  } catch (error) {
    markError();
    return { status: "down", error: sanitizeErrorMessage(error) };
  }
}

async function checkConvex(): Promise<ServiceHealth> {
  const startedAt = Date.now();

  try {
    await convex.getStats();
    return { status: "up", latencyMs: Date.now() - startedAt };
  } catch (error) {
    markError();
    return { status: "down", error: sanitizeErrorMessage(error) };
  }
}

async function getActivityMetrics(): Promise<{
  activeUsers24h: number;
  messagesLastHour: number;
}> {
  const now = Date.now();

  try {
    const [stats, inactiveUsers, lastHourEventCounts] = await Promise.all([
      convex.getStats(),
      convex.getInactiveUsers(DAY_MS),
      convex.getAnalyticsEventCounts(now - ONE_HOUR_MS, now),
    ]);

    const totalUsers =
      typeof stats === "object" &&
      stats !== null &&
      "totalUsers" in stats &&
      typeof stats.totalUsers === "number"
        ? stats.totalUsers
        : 0;

    const activeUsers24h = Math.max(totalUsers - inactiveUsers.length, 0);
    const messagesLastHour = lastHourEventCounts.reduce((sum, entry) => sum + entry.count, 0);

    return { activeUsers24h, messagesLastHour };
  } catch (error) {
    markError();
    console.warn("[health-monitor] Failed to fetch activity metrics:", error);
    return { activeUsers24h: 0, messagesLastHour: 0 };
  }
}

function deriveOverallStatus(
  services: HealthStatus["services"],
  rssBytes: number
): OverallHealthStatus {
  const downCount = Object.values(services).filter((service) => service.status === "down").length;

  if (downCount >= 2 || services.convex.status === "down" || rssBytes > MEMORY_CRITICAL_BYTES) {
    return "unhealthy";
  }

  if (downCount >= 1 || rssBytes > MEMORY_WARN_BYTES) {
    return "degraded";
  }

  return "healthy";
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
  pruneOldErrorEntries();

  const memoryUsage = process.memoryUsage();
  const now = Date.now();
  const cpuUsage = process.cpuUsage(previousCpuSample);
  const elapsedMicros = Math.max((now - previousCpuSampleAt) * 1000, 1);
  const cpuPercent = ((cpuUsage.user + cpuUsage.system) / elapsedMicros) * 100;

  previousCpuSample = process.cpuUsage();
  previousCpuSampleAt = now;

  const { activeUsers24h, messagesLastHour } = await getActivityMetrics();
  const errorsLastHour = errorTimestamps.length;
  const queueMetrics = getQueueMetrics();

  return {
    memory: {
      rssBytes: memoryUsage.rss,
      heapUsedBytes: memoryUsage.heapUsed,
      rss: formatBytes(memoryUsage.rss),
      heapUsed: formatBytes(memoryUsage.heapUsed),
    },
    cpu: {
      usagePercent: Number(cpuPercent.toFixed(2)),
    },
    throughput: {
      messagesLastHour,
      messagesPerMinute: Number((messagesLastHour / 60).toFixed(2)),
    },
    queue: {
      activeUsers: queueMetrics.activeUsers,
      pendingMessages: queueMetrics.totalPending,
      runningTasks: queueMetrics.totalRunning,
      waitingForSlot: queueMetrics.waitingForSlot,
    },
    errors: {
      lastHour: errorsLastHour,
      errorRatePerHour: Number(errorsLastHour.toFixed(2)),
    },
    activeUsers24h,
  };
}

export async function getHealthStatus(): Promise<HealthStatus> {
  const [venice, fal, convexHealth, systemMetrics] = await Promise.all([
    checkVenice(),
    checkFal(),
    checkConvex(),
    getSystemMetrics(),
  ]);

  const services: HealthStatus["services"] = {
    venice,
    fal,
    convex: convexHealth,
  };

  return {
    status: deriveOverallStatus(services, systemMetrics.memory.rssBytes),
    uptime: formatUptime(process.uptime()),
    memory: {
      rss: systemMetrics.memory.rss,
      heapUsed: systemMetrics.memory.heapUsed,
    },
    services,
    metrics: {
      activeUsers24h: systemMetrics.activeUsers24h,
      messagesLastHour: systemMetrics.throughput.messagesLastHour,
      errorsLastHour: systemMetrics.errors.lastHour,
      queueActiveUsers: systemMetrics.queue.activeUsers,
      queuePendingMessages: systemMetrics.queue.pendingMessages,
      queueRunningTasks: systemMetrics.queue.runningTasks,
      queueWaitingForSlot: systemMetrics.queue.waitingForSlot,
    },
  };
}

export function startHealthMonitor(): ReturnType<typeof setInterval> {
  if (healthMonitorTimer) {
    return healthMonitorTimer;
  }

  console.log("Starting health monitor (checks every 5 minutes)");

  healthMonitorTimer = setInterval(async () => {
    try {
      const health = await getHealthStatus();

      if (health.memory.rss.endsWith("MB")) {
        const rssMb = Number(health.memory.rss.replace("MB", ""));
        if (Number.isFinite(rssMb) && rssMb > MEMORY_WARN_BYTES / (1024 * 1024)) {
          console.warn(`[health-monitor] High memory usage detected: ${health.memory.rss}`);
        }
      }

      if (health.status !== "healthy") {
        console.warn("[health-monitor] System health warning:", health);
      }
    } catch (error) {
      markError();
      console.error("[health-monitor] Health monitor tick failed:", error);
    }
  }, FIVE_MINUTES_MS);

  return healthMonitorTimer;
}

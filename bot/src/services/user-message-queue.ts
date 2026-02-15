type QueueTask = () => Promise<void>;

interface QueueItem {
  task: QueueTask;
  resolve: () => void;
  reject: (error: unknown) => void;
}

interface UserQueue {
  running: boolean;
  items: QueueItem[];
  lastActivityAt: number;
}

export interface QueueEnqueueResult {
  accepted: boolean;
  queuedAhead: number;
  completion: Promise<void>;
}

const MAX_QUEUE_PER_USER = 25;
const MAX_TOTAL_PENDING = 20_000;
const MAX_GLOBAL_RUNNING = 400;

const queues = new Map<number, UserQueue>();
let totalPending = 0;
let totalRunning = 0;
const globalWaiters: Array<() => void> = [];

function createRejectedResult(queuedAhead: number): QueueEnqueueResult {
  return {
    accepted: false,
    queuedAhead,
    completion: Promise.resolve(),
  };
}

function touchQueue(queue: UserQueue): void {
  queue.lastActivityAt = Date.now();
}

function maybeCleanupQueue(telegramId: number, queue: UserQueue): void {
  if (queue.running || queue.items.length > 0) return;
  queues.delete(telegramId);
}

async function acquireGlobalSlot(): Promise<void> {
  if (totalRunning < MAX_GLOBAL_RUNNING) {
    totalRunning += 1;
    return;
  }

  await new Promise<void>((resolve) => {
    globalWaiters.push(resolve);
  });
  totalRunning += 1;
}

function releaseGlobalSlot(): void {
  totalRunning = Math.max(0, totalRunning - 1);
  if (globalWaiters.length > 0 && totalRunning < MAX_GLOBAL_RUNNING) {
    const next = globalWaiters.shift();
    next?.();
  }
}

async function drainQueue(telegramId: number): Promise<void> {
  const queue = queues.get(telegramId);
  if (!queue || queue.running) return;

  queue.running = true;

  try {
    while (queue.items.length > 0) {
      const item = queue.items.shift()!;
      touchQueue(queue);
      await acquireGlobalSlot();
      try {
        await item.task();
        item.resolve();
      } catch (error) {
        item.reject(error);
      } finally {
        releaseGlobalSlot();
        totalPending = Math.max(0, totalPending - 1);
      }
    }
  } finally {
    queue.running = false;
    touchQueue(queue);
    maybeCleanupQueue(telegramId, queue);
  }
}

export function enqueueUserMessageTask(
  telegramId: number,
  task: QueueTask
): QueueEnqueueResult {
  const queue = queues.get(telegramId) ?? {
    running: false,
    items: [],
    lastActivityAt: Date.now(),
  };

  if (!queues.has(telegramId)) {
    queues.set(telegramId, queue);
  }

  const queuedAhead = queue.items.length + (queue.running ? 1 : 0);

  if (queue.items.length >= MAX_QUEUE_PER_USER || totalPending >= MAX_TOTAL_PENDING) {
    return createRejectedResult(queuedAhead);
  }

  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const completion = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  queue.items.push({
    task,
    resolve,
    reject,
  });
  totalPending += 1;
  touchQueue(queue);

  void drainQueue(telegramId);

  return {
    accepted: true,
    queuedAhead,
    completion,
  };
}

export function getQueueMetrics(): {
  activeUsers: number;
  totalPending: number;
  totalRunning: number;
  waitingForSlot: number;
} {
  return {
    activeUsers: queues.size,
    totalPending,
    totalRunning,
    waitingForSlot: globalWaiters.length,
  };
}

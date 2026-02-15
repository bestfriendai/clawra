import assert from "node:assert/strict";
import test from "node:test";
import { enqueueUserMessageTask, getQueueMetrics } from "./user-message-queue.js";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("user message queue executes tasks in strict order", async () => {
  const events: string[] = [];

  const first = enqueueUserMessageTask(910001, async () => {
    events.push("start:1");
    await wait(20);
    events.push("end:1");
  });
  const second = enqueueUserMessageTask(910001, async () => {
    events.push("start:2");
    await wait(5);
    events.push("end:2");
  });
  const third = enqueueUserMessageTask(910001, async () => {
    events.push("start:3");
    events.push("end:3");
  });

  await Promise.all([first.completion, second.completion, third.completion]);

  assert.deepEqual(events, ["start:1", "end:1", "start:2", "end:2", "start:3", "end:3"]);
});

test("queue enforces per-user backlog cap", async () => {
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const first = enqueueUserMessageTask(910002, async () => {
    await firstGate;
  });

  const accepted: Array<ReturnType<typeof enqueueUserMessageTask>> = [];
  for (let i = 0; i < 25; i += 1) {
    accepted.push(
      enqueueUserMessageTask(910002, async () => {
      })
    );
  }

  const rejected = enqueueUserMessageTask(910002, async () => {
  });

  assert.ok(accepted.every((item) => item.accepted));
  assert.equal(rejected.accepted, false);

  releaseFirst();
  await first.completion;
  await Promise.all(accepted.map((item) => item.completion));

  const metrics = getQueueMetrics();
  assert.ok(metrics.totalPending >= 0);
});

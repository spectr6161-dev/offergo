import { Queue } from "bullmq";
import IORedis from "ioredis";
import { z } from "zod";
import { env } from "@offergo/shared";

export const queues = {
  "resume.analysis": z.object({
    resumeId: z.string().cuid(),
    userId: z.string().cuid(),
  }),
  "resume.rewrite": z.object({
    resumeId: z.string().cuid(),
    versionId: z.string().cuid(),
    userId: z.string().cuid(),
  }),
  "trainer.followup": z.object({
    trainerSessionId: z.string().cuid(),
    userId: z.string().cuid(),
    prompt: z.string().min(1),
  }),
  "billing.reconcile": z.object({
    paymentId: z.string().cuid(),
  }),
  "housekeeping.entitlements": z.object({
    initiatedBy: z.literal("system"),
  }),
  "housekeeping.files": z.object({
    initiatedBy: z.literal("system"),
  }),
  "automation.playwright.apply": z.object({
    accountId: z.string().min(1),
    userId: z.string().cuid(),
  }),
  "automation.playwright.sync": z.object({
    accountId: z.string().min(1),
    userId: z.string().cuid(),
  }),
} as const;

export type QueueJobName = keyof typeof queues;

export function getQueueConnection() {
  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
}

export function getQueue(name: QueueJobName) {
  return new Queue(name, {
    connection: getQueueConnection(),
  });
}

export async function enqueueJob<TName extends QueueJobName>(
  name: TName,
  payload: z.infer<(typeof queues)[TName]>,
) {
  const parsed = queues[name].parse(payload);
  const queue = getQueue(name);

  return queue.add(name, parsed, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2_000,
    },
    removeOnComplete: 100,
    removeOnFail: 100,
  });
}

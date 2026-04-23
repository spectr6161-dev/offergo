import { Worker, type Job } from "bullmq";
import { getQueueConnection, queues, type QueueJobName } from "@offergo/queue";
import { prisma } from "@offergo/db";
import { analyzeResume, rewriteResume, runTrainerTurn } from "@offergo/ai";
import { expireEntitlements } from "@offergo/billing";
import { env } from "@offergo/shared";

type WorkerHandler = (job: Job) => Promise<unknown>;

async function upsertJobState(
  job: Job,
  status: "queued" | "running" | "completed" | "failed",
  result?: unknown,
  error?: string,
) {
  const existing = await prisma.job.findFirst({
    where: {
      queue: job.queueName,
      providerJobId: job.id ?? undefined,
    },
  });

  const data = {
    queue: job.queueName,
    name: job.name,
    providerJobId: job.id ?? null,
    status,
    payload: job.data,
    result: result ? JSON.parse(JSON.stringify(result)) : undefined,
    error: error ?? null,
    attempts: job.attemptsMade,
    lastRunAt: new Date(),
  };

  if (existing) {
    await prisma.job.update({
      where: { id: existing.id },
      data,
    });
    return existing.id;
  }

  const created = await prisma.job.create({
    data,
  });

  return created.id;
}

async function appendAttempt(jobId: string, status: "running" | "completed" | "failed", error?: string) {
  await prisma.jobAttempt.create({
    data: {
      jobId,
      status,
      error: error ?? null,
      startedAt: new Date(),
      finishedAt: status === "running" ? null : new Date(),
    },
  });
}

const handlers: Record<QueueJobName, WorkerHandler> = {
  "resume.analysis": async (job) => {
    return analyzeResume(job.data);
  },
  "resume.rewrite": async (job) => {
    return rewriteResume(job.data);
  },
  "trainer.followup": async (job) => {
    return runTrainerTurn(job.data);
  },
  "billing.reconcile": async () => {
    return { reconciled: true };
  },
  "housekeeping.entitlements": async () => {
    const expired = await expireEntitlements();
    return { expired };
  },
  "housekeeping.files": async () => {
    return { deleted: 0 };
  },
  "automation.playwright.apply": async () => {
    if (!env.ENABLE_PLAYWRIGHT_AUTOMATION) {
      return { skipped: true, reason: "Playwright automation disabled" };
    }

    return { skipped: true, reason: "Playwright runtime scaffolded, implementation deferred" };
  },
  "automation.playwright.sync": async () => {
    if (!env.ENABLE_PLAYWRIGHT_AUTOMATION) {
      return { skipped: true, reason: "Playwright automation disabled" };
    }

    return { skipped: true, reason: "Playwright runtime scaffolded, implementation deferred" };
  },
};

async function main() {
  const connection = getQueueConnection();

  for (const queueName of Object.keys(queues) as QueueJobName[]) {
    const worker = new Worker(
      queueName,
      async (job) => {
        const handler = handlers[job.name as QueueJobName];

        if (!handler) {
          throw new Error(`No handler registered for job ${job.name}`);
        }

        const jobId = await upsertJobState(job, "running");
        await appendAttempt(jobId, "running");

        try {
          const result = await handler(job);
          await upsertJobState(job, "completed", result);
          await appendAttempt(jobId, "completed");
          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown job failure";
          await upsertJobState(job, "failed", undefined, message);
          await appendAttempt(jobId, "failed", message);
          throw error;
        }
      },
      {
        connection,
      },
    );

    worker.on("completed", (job) => {
      console.log(`[worker] completed ${job.queueName}:${job.id}`);
    });

    worker.on("failed", (job, error) => {
      console.error(`[worker] failed ${job?.queueName}:${job?.id}`, error);
    });
  }

  console.log("[worker] ready");
}

void main().catch((error) => {
  console.error("[worker] fatal", error);
  process.exit(1);
});

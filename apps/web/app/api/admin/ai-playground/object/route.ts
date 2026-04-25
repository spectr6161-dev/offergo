import { generateAiObject } from "@offergo/ai";
import { z } from "zod";

import { getLatencyMs, jsonAiError, requireAdminApiAccess } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  prompt: z.string().min(1),
  modelId: z.string().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
});

const playgroundObjectSchema = z.object({
  title: z.string(),
  summary: z.string(),
  bullets: z.array(z.string()).min(1),
  risk: z.enum(["low", "medium", "high"]),
});

export async function POST(request: Request) {
  const forbidden = await requireAdminApiAccess();

  if (forbidden) {
    return forbidden;
  }

  const startedAt = performance.now();

  try {
    const body = bodySchema.parse(await request.json());
    const result = await generateAiObject({
      ...body,
      schema: playgroundObjectSchema,
      system:
        "Return only an object that matches the schema. Keep Russian language unless the prompt asks otherwise.",
    });

    return Response.json({
      ...result,
      latencyMs: getLatencyMs(startedAt),
    });
  } catch (error) {
    return Response.json(jsonAiError(error, getLatencyMs(startedAt)), {
      status: 500,
    });
  }
}

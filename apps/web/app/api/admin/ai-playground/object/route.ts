import { generateAiObject } from "@offergo/ai";
import { z } from "zod";

import { getLatencyMs, jsonAiError, requireAdminApiAccess } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  prompt: z.string().min(1),
  modelId: z.string().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().min(1).max(4096).optional(),
});

const playgroundObjectMaxOutputTokens = 1024;

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
    console.info("[ai-playground/object] start", {
      modelId: body.modelId ?? null,
      maxOutputTokens: body.maxOutputTokens ?? playgroundObjectMaxOutputTokens,
    });
    const result = await generateAiObject({
      ...body,
      maxOutputTokens: body.maxOutputTokens ?? playgroundObjectMaxOutputTokens,
      schema: playgroundObjectSchema,
      system:
        "Return only an object that matches the schema. Keep Russian language unless the prompt asks otherwise.",
    });
    console.info("[ai-playground/object] finish", {
      modelId: result.modelId,
      latencyMs: getLatencyMs(startedAt),
      finishReason: result.finishReason,
    });

    return Response.json({
      ...result,
      latencyMs: getLatencyMs(startedAt),
    });
  } catch (error) {
    console.error("[ai-playground/object] error", jsonAiError(error).error);
    return Response.json(jsonAiError(error, getLatencyMs(startedAt)), {
      status: 500,
    });
  }
}

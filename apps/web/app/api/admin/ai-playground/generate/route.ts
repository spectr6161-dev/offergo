import { generateAiTextResult } from "@offergo/ai";
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

const playgroundTextMaxOutputTokens = 1024;

export async function POST(request: Request) {
  const forbidden = await requireAdminApiAccess();

  if (forbidden) {
    return forbidden;
  }

  const startedAt = performance.now();

  try {
    const body = bodySchema.parse(await request.json());
    console.info("[ai-playground/generate] start", {
      modelId: body.modelId ?? null,
      maxOutputTokens: body.maxOutputTokens ?? playgroundTextMaxOutputTokens,
    });
    const result = await generateAiTextResult({
      ...body,
      maxOutputTokens: body.maxOutputTokens ?? playgroundTextMaxOutputTokens,
    });
    console.info("[ai-playground/generate] finish", {
      modelId: result.modelId,
      latencyMs: getLatencyMs(startedAt),
      finishReason: result.finishReason,
    });

    return Response.json({
      ...result,
      latencyMs: getLatencyMs(startedAt),
    });
  } catch (error) {
    console.error("[ai-playground/generate] error", jsonAiError(error).error);
    return Response.json(jsonAiError(error, getLatencyMs(startedAt)), {
      status: 500,
    });
  }
}

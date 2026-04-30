import { streamAiText } from "@offergo/ai";
import { z } from "zod";

import { jsonAiError, requireAdminApiAccess } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  messages: z.array(z.unknown()).min(1),
  modelId: z.string().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().min(1).max(4096).optional(),
});

const playgroundChatMaxOutputTokens = 768;

export async function POST(request: Request) {
  const startedAt = performance.now();
  const forbidden = await requireAdminApiAccess();

  if (forbidden) {
    console.info("[ai-playground/chat] forbidden", {
      latencyMs: Math.round(performance.now() - startedAt),
    });
    return forbidden;
  }

  try {
    const body = bodySchema.parse(await request.json());
    console.info("[ai-playground/chat] start", {
      modelId: body.modelId ?? null,
      messages: body.messages.length,
      maxOutputTokens: body.maxOutputTokens ?? playgroundChatMaxOutputTokens,
    });
    const result = await streamAiText({
      messages: body.messages as never,
      modelId: body.modelId,
      temperature: body.temperature,
      maxOutputTokens: body.maxOutputTokens ?? playgroundChatMaxOutputTokens,
    });

    return result.toUIMessageStreamResponse({
      headers: {
        "x-ai-model": body.modelId ?? "",
      },
      onError: (error) => {
        const normalized = jsonAiError(error).error;
        console.error("[ai-playground/chat] stream error", normalized);
        return JSON.stringify(normalized);
      },
      onFinish: () => {
        console.info("[ai-playground/chat] finish", {
          modelId: body.modelId ?? null,
          latencyMs: Math.round(performance.now() - startedAt),
        });
      },
    });
  } catch (error) {
    console.error("[ai-playground/chat] error", jsonAiError(error).error);
    return Response.json(jsonAiError(error), { status: 500 });
  }
}

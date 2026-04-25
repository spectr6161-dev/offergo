import { generateAiSpeech } from "@offergo/ai";
import { z } from "zod";

import { getLatencyMs, jsonAiError, requireAdminApiAccess } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  text: z.string().min(1),
  modelId: z.string().min(1).optional(),
  voice: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  const forbidden = await requireAdminApiAccess();

  if (forbidden) {
    return forbidden;
  }

  const startedAt = performance.now();

  try {
    const body = bodySchema.parse(await request.json());
    const result = await generateAiSpeech(body);

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

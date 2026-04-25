import { generateAiTextResult } from "@offergo/ai";
import { z } from "zod";

import { getLatencyMs, jsonAiError, requireAdminApiAccess } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  prompt: z.string().min(1),
  modelId: z.string().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export async function POST(request: Request) {
  const forbidden = await requireAdminApiAccess();

  if (forbidden) {
    return forbidden;
  }

  const startedAt = performance.now();

  try {
    const body = bodySchema.parse(await request.json());
    const result = await generateAiTextResult(body);

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

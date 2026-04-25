import { generateAiImage } from "@offergo/ai";
import { z } from "zod";

import { getLatencyMs, jsonAiError, requireAdminApiAccess } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  prompt: z.string().min(1),
  modelId: z.string().min(1).optional(),
  aspectRatio: z
    .custom<`${number}:${number}`>((value) => typeof value === "string" && /^\d+:\d+$/.test(value))
    .optional(),
});

export async function POST(request: Request) {
  const forbidden = await requireAdminApiAccess();

  if (forbidden) {
    return forbidden;
  }

  const startedAt = performance.now();

  try {
    const body = bodySchema.parse(await request.json());
    const result = await generateAiImage(body);

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

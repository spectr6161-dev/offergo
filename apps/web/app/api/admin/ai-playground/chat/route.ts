import { streamAiText } from "@offergo/ai";
import { z } from "zod";

import { jsonAiError, requireAdminApiAccess } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  messages: z.array(z.unknown()).min(1),
  modelId: z.string().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export async function POST(request: Request) {
  const forbidden = await requireAdminApiAccess();

  if (forbidden) {
    return forbidden;
  }

  try {
    const body = bodySchema.parse(await request.json());
    const result = await streamAiText({
      messages: body.messages as never,
      modelId: body.modelId,
      temperature: body.temperature,
    });

    return result.toUIMessageStreamResponse({
      headers: {
        "x-ai-model": body.modelId ?? "",
      },
      onError: (error) => JSON.stringify(jsonAiError(error).error),
    });
  } catch (error) {
    return Response.json(jsonAiError(error), { status: 500 });
  }
}

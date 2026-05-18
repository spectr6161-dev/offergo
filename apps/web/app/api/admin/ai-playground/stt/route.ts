import { transcribeAiAudio } from "@offergo/ai";
import { z } from "zod";

import { getLatencyMs, jsonAiError, requireAdminApiAccess } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const metadataSchema = z.object({
  modelId: z.string().min(1).optional(),
  prompt: z.string().min(1).optional(),
});

const maxAudioSize = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const forbidden = await requireAdminApiAccess();

  if (forbidden) {
    return forbidden;
  }

  const startedAt = performance.now();

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json(
        { error: "Нужно передать audio-файл в поле file." },
        { status: 400 },
      );
    }

    if (!file.type.startsWith("audio/")) {
      return Response.json(
        { error: "STT принимает только audio/* файлы." },
        { status: 400 },
      );
    }

    if (file.size > maxAudioSize) {
      return Response.json(
        { error: "Файл больше 20 MB. Для больших файлов нужен Files API." },
        { status: 413 },
      );
    }

    const metadata = metadataSchema.parse({
      modelId: formData.get("modelId") || undefined,
      prompt: formData.get("prompt") || undefined,
    });
    const audio = new Uint8Array(await file.arrayBuffer());
    const result = await transcribeAiAudio({
      ...metadata,
      audio,
      mediaType: file.type,
    });
    const payload =
      result && typeof result === "object" ? result : { result };

    return Response.json({
      ...payload,
      fileName: file.name,
      latencyMs: getLatencyMs(startedAt),
    });
  } catch (error) {
    return Response.json(jsonAiError(error, getLatencyMs(startedAt)), {
      status: 500,
    });
  }
}

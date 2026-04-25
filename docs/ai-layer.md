# AI Layer

## Provider strategy

- primary provider: `Gemini`
- package owner: `packages/ai`
- SDK: `Vercel AI SDK` (`ai` + `@ai-sdk/google`)
- provider layer: `packages/ai/src/gemini-provider.ts`
- model catalog: `packages/ai/src/model-catalog.ts`
- entrypoints:
  - `analyzeResume`
  - `rewriteResume`
  - `evaluateAnswer`
  - `runTrainerTurn`
  - `generateAiText`
  - `streamAiText`
  - `generateAiObject`
  - `generateAiImage`
  - `generateAiSpeech`
  - `transcribeAiAudio`

## Why this shape

The application should not import provider SDKs directly from pages, server actions, or worker code.
Everything goes through `packages/ai` so model/provider changes stay localized.

## Integration rule

Any code that works with neural network APIs must start from `packages/ai`.

- `apps/web` can own chat UI, streaming route handlers, and user interactions.
- `apps/api` can expose REST endpoints for mobile, bot, and external clients.
- `apps/worker` can run long AI jobs and queue-backed processing.
- Provider selection, prompts, tool definitions, structured output schemas, and model calls belong in `packages/ai`.

Do not import `@ai-sdk/google`, `ai`, Gemini SDKs, OpenAI SDKs, or other provider clients directly in application code unless `packages/ai` is being implemented or refactored.

## Vercel AI SDK

The base AI adapter uses Vercel AI SDK with the Google provider:

- `ai` provides common generation APIs such as `generateText`, streaming primitives, tools, and structured output support.
- `@ai-sdk/google` provides Gemini models through the Google Generative AI provider.
- The project keeps the existing env contract: `GEMINI_API_KEY` and `GEMINI_MODEL_TEXT`.
- The default model is configured by `GEMINI_MODEL_TEXT`, for example `gemini-3.1-pro-preview`.
- Vercel AI SDK covers text, streaming, structured output, and image generation in this package.
- Gemini TTS currently uses direct Gemini REST only inside `gemini-provider.ts`, because the current Google provider package does not expose a Gemini `SpeechModel` factory.

## Admin AI Playground

`apps/web` exposes an admin-only dev console at `/admin/ai-playground`.

- UI uses Vercel AI Elements installed as local shadcn/ui components.
- Route handlers live under `/api/admin/ai-playground/*`.
- Route handlers check admin access and call only `packages/ai`.
- The playground does not persist history in the database in v1.
- Live/realtime audio is intentionally left for v2.

## Current implementation level

The adapter supports text generation, streaming chat, structured object generation, image generation, Gemini TTS, and audio transcription through Gemini multimodal prompts.
Prompting is still intentionally lightweight because product workflows are not yet implemented.

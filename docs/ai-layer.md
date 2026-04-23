# AI Layer

## Provider strategy

- primary provider: `Gemini`
- package owner: `packages/ai`
- entrypoints:
  - `analyzeResume`
  - `rewriteResume`
  - `evaluateAnswer`
  - `runTrainerTurn`

## Why this shape

The application should not import provider SDKs directly from pages, server actions, or worker code.
Everything goes through `packages/ai` so model/provider changes stay localized.

## Current implementation level

The adapter exists and can be called by worker jobs.
Prompting is intentionally lightweight at this stage because the product workflows are not yet implemented.

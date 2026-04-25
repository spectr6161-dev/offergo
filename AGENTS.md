<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated - the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

# Project Frontend Rules

## Default product language

The product UI in this repository is Russian by default.

- Write user-facing interface text in Russian unless the user explicitly asks for another language.
- Prefer Russian labels, button text, validation messages, placeholders, navigation labels, and empty states.
- Do not mix English UI copy into Russian pages unless it is a real brand name, API term, or an explicitly requested exception.

## Locked frontend stack

For all new frontend work in this repository, use this stack:

- `Next.js`
- `shadcn/ui`
- `Tailwind CSS`
- `TypeScript`

Do not introduce `MUI` back into the project.

## Default UI workflow

Before building any new page, component, or frontend flow:

1. Read the relevant Next.js docs first.
2. Check the existing codebase for a reusable solution before writing new code.
3. Check whether `shadcn/ui` already has a ready-made component or block that fits the task.
4. Prefer composing existing `shadcn/ui` components over custom markup.
5. Only write custom UI code when there is no suitable built-in or already-added solution.

## shadcn/ui rules

- Prefer existing installed components first.
- Before adding a new UI primitive, check the local component set and project code.
- Before inventing a custom solution, check `shadcn/ui` docs and examples first.
- When adding components, use the project package manager runner: `pnpm dlx shadcn@latest ...`
- Prefer semantic Tailwind classes and project tokens over raw one-off colors and ad-hoc styling.
- Prefer composition over reinvention: cards, dialogs, tables, forms, tabs, sheets, alerts, and empty states should come from `shadcn/ui` when possible.

## Ready-made solution rule

The default assumption is:

- first look for an existing local component
- then look for an existing `shadcn/ui` component or block
- only after that write custom implementation

# Project AI Rules

## Locked AI integration path

For all code that talks to neural network APIs, use `packages/ai` first.

- Do not import provider SDKs directly from `apps/web`, `apps/api`, `apps/worker`, pages, route handlers, server actions, or UI components.
- Do not call Gemini, OpenAI, Anthropic, or other model APIs directly from product code.
- Add model/provider code to `packages/ai`, then expose a small use-case function or adapter from that package.
- The default implementation inside `packages/ai` uses Vercel AI SDK: `ai` + `@ai-sdk/google`.
- The default provider remains Gemini via `GEMINI_API_KEY` and `GEMINI_MODEL_TEXT`.
- The provider implementation file is `packages/ai/src/gemini-provider.ts`; model IDs and defaults are in `packages/ai/src/model-catalog.ts`.
- Before changing AI code, check the current Vercel AI SDK docs and Google Gemini model docs; do not rely on stale model names.
- If a task needs streaming UI in Next.js, still keep provider selection, prompts, tools, and schemas in `packages/ai`; the route/UI should consume that package, not own provider logic.
- The admin AI playground lives at `/admin/ai-playground`; it is a dev/testing surface only and must not become the place where product AI logic lives.
- Use Vercel AI Elements for AI chat/test UI before writing custom chat components.

# Backend, Secrets, Billing Rules

## Secrets

- Never write real secrets, API keys, bot tokens, merchant secrets, passwords, or OAuth secrets into `.env.example`, README, docs, seed files, tests, or code comments.
- `.env.example` may contain only empty placeholders or obvious fake values.
- If a real secret was exposed in chat, docs, or git history, treat it as compromised and require rotation.
- Production must set `APP_ENV=production` and must not start with default `BETTER_AUTH_SECRET`, default database credentials, or missing required provider secrets.

## Module boundaries

- `apps/api` owns backend API contracts, auth guards, RBAC, billing endpoints, AdminJS, and health checks.
- `apps/web` must call API routes/server actions and must not bypass backend ownership for billing/auth state.
- `packages/billing` owns payment state transitions and Platega integration.
- `packages/ai` owns all AI provider calls.
- `packages/queue` schemas must match worker handler input exactly.

## Error handling

- Do not swallow API/provider errors and show empty states unless a successful empty response was received.
- New API endpoints must return predictable HTTP errors: `400` validation, `401/403` auth, `404` not found, `409` conflicts, `502` provider failures, `500` unexpected failures.
- External `fetch` calls to providers or cross-runtime proxies must use a timeout.

## AdminJS and billing invariants

- AdminJS access is for `admin` only. Do not grant `/adminjs` access to `support`.
- Auth/session/key models, role assignments, payments, and entitlements are read-only in AdminJS unless a task explicitly adds audited admin mutations.
- Checkout may use only `Plan.active=true`.
- `Plan.priceRub` and `Plan.durationDays` must be positive before payment creation.
- Platega webhook confirmation must match local payment amount and currency before granting entitlement.

## Layout and copy constraints

- Avoid `boxed-view` layouts by default.
- Do not wrap the whole screen in a large centered card unless the user explicitly wants that pattern or the flow truly requires it.
- If a boxed card is unavoidable, keep it minimal and never make it the main visual gimmick.
- Prefer open layouts, direct structure, and clear hierarchy over decorative framing.

- Never add extra UI elements that were not requested.
- Never add helper copy, explanatory subtitles, descriptions, hints, or marketing text unless the user explicitly asked for them.
- If the user asked for specific fields and actions, render only those fields and actions.
- Do not add filler text such as:
  - "Enter your login and password or continue with Telegram and Google."
  - "Login currently works as email."
  - "Use a strong password with at least 8 characters."
- Keep forms strict, compact, and literal. No decorative copywriting by default.

# Production Agent Guardrails

These rules are mandatory for backend, security, billing, async provider, queue, and database work.

## Secrets and environment

- Never write real API keys, bot tokens, merchant secrets, OAuth secrets, passwords, private keys, or session secrets into tracked files: `.env.example`, README, docs, seed files, tests, fixtures, comments, or snapshots.
- `.env.example` must contain only empty placeholders or clearly fake values.
- If a real secret appears in chat, docs, logs, or git history, treat it as compromised and require rotation.
- Do not weaken or bypass production env guards unless the user explicitly requests that exact security change.
- Production mode is controlled by `APP_ENV=production`; do not use `NODE_ENV` as the app-level security mode.
- Deploy must not run seed automatically. Admin seed is allowed only when both `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` are explicitly set.

## AdminJS and protected data

- `/adminjs` access is only for users with the `admin` role. Do not grant AdminJS access to `support`.
- Auth models, sessions, JWKS/private keys, role assignments, payments, and entitlements are read-only in AdminJS by default.
- Do not add manual role changes, payment status changes, or entitlement changes without an explicit audited admin flow.
- Sensitive fields must stay hidden in AdminJS list/filter/show/edit views.

## API errors and web data states

- API errors must follow the project contract: Zod validation -> `400`, auth -> `401/403`, Prisma not found -> `404`, unique conflict -> `409`, provider failure -> `502`, unexpected failure -> `500`.
- Never expose stack traces, provider secrets, tokens, private keys, or raw provider payloads in public API error responses.
- Do not convert API/provider failures into empty UI states. Empty states are valid only after a successful empty response.
- Web pages must show a diagnosable error state when required API data cannot be loaded.

## Billing invariants

- Checkout must use only `Plan.active=true`.
- `Plan.priceRub` must be greater than `0`.
- `Plan.durationDays` must be greater than `0`.
- Platega webhook confirmation may grant entitlement only when provider amount and currency match the local `Payment`.
- Payment confirm, cancel, chargeback, and entitlement grant logic must remain idempotent.
- Billing provider errors must be logged safely without secrets and surfaced as provider failures, not generic success or empty state.

## Async provider and queue rules

- Every external `fetch` or provider call must have an explicit timeout.
- Retries are allowed only for safe/idempotent operations; never blindly retry payment mutation or entitlement grant flows.
- Provider errors must be redacted before reaching user-facing/admin-facing JSON.
- Do not set command timeouts on BullMQ blocking Redis connections used by workers.
- Queue payload schemas in `packages/queue` must exactly match worker handler input and downstream use-case schemas.

## Database change rules

- Do not rely on `prisma db push` for production database evolution once the project moves beyond scaffold mode.
- Production DB changes must use migrations and be compatible with existing data.
- Do not add schema fields that allow impossible billing states without corresponding validation and invariants.

# offergo_app

Greenfield monorepo for the new offerGO web application. This subtree is isolated from the legacy `web`, `backend`, and `client` directories and is intended to replace the old stack incrementally.

## Structure

- `apps/web` - Next.js 16 product app and `/admin`
- `apps/worker` - BullMQ workers and Playwright-ready automation runtime
- `packages/db` - Prisma schema, client, migrations, seed
- `packages/auth` - Better Auth server, client, guards, SMTP transport
- `packages/ui` - shared MUI theme and app primitives
- `packages/ai` - Gemini-first AI adapter and use-case entrypoints
- `packages/billing` - Platega adapter and entitlement logic
- `packages/queue` - queue names, payload schemas, worker contracts
- `packages/shared` - shared zod contracts, enums, env helpers
- `docs/` - working documentation for the project

## Quick start

1. Copy `.env.example` to `.env`.
2. Start infra with Docker if available:
   - `docker compose up -d postgres redis minio mailpit`
3. Install workspace dependencies:
   - `pnpm install`
4. Generate Prisma client and apply migrations:
   - `pnpm db:generate`
   - `pnpm db:migrate`
   - `pnpm db:seed`
5. Run the app and worker:
   - `pnpm dev:web`
   - `pnpm dev:worker`

## Current scope

This initial scaffold includes:

- auth/account foundation
- manual-renewal billing via Platega
- object storage integration shape
- queue-backed domain skeletons for resume, trainer, and housekeeping
- shared admin and dashboard shells

See `docs/` for architecture, workflow, and deployment details.

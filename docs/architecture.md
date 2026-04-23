# Architecture

## Monorepo shape

- `apps/web` - Next.js 16 application with auth routes, protected dashboard routes, `/admin`, and route handlers
- `apps/worker` - BullMQ worker runtime with Playwright-ready queue scaffold
- `packages/db` - Prisma schema, generated client, migrations, seed
- `packages/auth` - Better Auth core config, Next-facing guards, SMTP transport, client helpers
- `packages/ui` - shared MUI theme, shells, cards, grid wrapper, toast provider
- `packages/ai` - Gemini-first adapter and use-case entrypoints
- `packages/billing` - Platega adapter and entitlement orchestration
- `packages/queue` - queue names, payload schemas, enqueue helpers
- `packages/shared` - shared enums, zod schemas, env parsing

## Runtime split

- `web` owns:
  - App Router pages
  - auth endpoints
  - billing webhook
  - health route
  - storage route contract
- `worker` owns:
  - async job consumption
  - future Playwright browser jobs
  - scheduled housekeeping tasks

## Data boundaries

- `Postgres` is the main system of record
- `Redis` is only for queue transport
- `S3-compatible storage` is for files and artifacts
- `Gemini` is isolated behind `packages/ai`
- `Platega` is isolated behind `packages/billing`

## Current implementation level

This repository state is a **foundation scaffold**:

- auth pages and route mounting exist
- dashboard and admin routes exist
- worker and domain packages exist
- most product routes are placeholders on purpose

This is deliberate. The goal is to stabilize the platform and ownership boundaries before building feature workflows.

# Architecture

## Monorepo shape

- `apps/web` - Next.js 16 web/admin client shell with protected routes and intentionally stripped screens
- `apps/api` - NestJS + Express API for auth, billing, RBAC, and external clients
- `apps/worker` - BullMQ worker runtime with Playwright-ready queue scaffold
- `packages/db` - Prisma schema, generated client, migrations, seed
- `packages/auth` - Better Auth core config, shared session helpers, Next-facing guards, SMTP transport, client helpers
- `packages/ui` - shared lightweight UI primitives, shells, tables, and toast provider
- `packages/ai` - Gemini-first adapter and use-case entrypoints
- `packages/billing` - Platega adapter and entitlement orchestration
- `packages/queue` - queue names, payload schemas, enqueue helpers
- `packages/shared` - shared enums, zod schemas, env parsing

## Frontend baseline

All future frontend work should use:

- `Next.js`
- `shadcn/ui`
- `Tailwind CSS`
- `TypeScript`

Implementation order for UI work:

1. check existing project code
2. check `shadcn/ui` ready-made components or blocks
3. only then build custom UI

## Runtime split

- `web` owns:
  - App Router pages
  - auth forms and browser UX
  - protected web/admin layouts
- `api` owns:
  - auth endpoints
  - public REST endpoints
  - billing webhook and checkout contract
  - RBAC enforcement for external clients
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

- auth routes, auth engine, and API route mounting exist
- dashboard and admin routes exist, but web screens are intentionally stripped
- platform API and OpenAPI surface exist
- worker and domain packages exist
- most product routes are placeholders on purpose

This is deliberate. The goal is to stabilize the platform and ownership boundaries before building feature workflows.

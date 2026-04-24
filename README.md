# offergo_app

Greenfield monorepo for the new offerGO web application. This subtree is isolated from the legacy `web`, `backend`, and `client` directories and is intended to replace the old stack incrementally.

## Structure

- `apps/web` - Next.js 16 product app and `/admin`
- `apps/api` - NestJS + Express API for auth, billing, RBAC, and external clients
- `apps/worker` - BullMQ workers and Playwright-ready automation runtime
- `packages/db` - Prisma schema, client, migrations, seed
- `packages/auth` - Better Auth server, client, guards, SMTP transport
- `packages/ui` - shared lightweight UI primitives and provider helpers
- `packages/ai` - Gemini-first AI adapter and use-case entrypoints
- `packages/billing` - Platega adapter and entitlement logic
- `packages/queue` - queue names, payload schemas, worker contracts
- `packages/shared` - shared zod contracts, enums, env helpers
- `docs/` - working documentation for the project

## Frontend standard

The frontend stack is fixed for future UI work:

- `Next.js`
- `shadcn/ui`
- `Tailwind CSS`
- `TypeScript`

When implementing UI, check for an existing local solution first, then check `shadcn/ui` components/blocks, and only then write custom code.

## Quick start

1. Copy `.env.example` to `.env`.
   - If `web` and `api` will run on sibling subdomains in production, set `AUTH_COOKIE_DOMAIN=.your-domain.com`.
2. Start infra with Docker if available:
   - `docker compose up -d postgres redis minio mailpit`
3. Install workspace dependencies:
   - `pnpm install`
4. Generate Prisma client and apply migrations:
   - `pnpm db:generate`
   - `pnpm db:migrate`
   - `pnpm db:seed`
5. Run the web app, API, and worker:
   - `pnpm dev:web`
   - `pnpm dev:api`
   - `pnpm dev:worker`
6. Open API docs:
   - Swagger UI: `http://localhost:3001/api/docs`
   - OpenAPI JSON: `http://localhost:3001/api/docs-json`
7. Runtime server log:
   - unified log file: `logs/server.log`
   - `apps/api` resets the file on boot
   - `apps/worker` appends into the same file

## Current scope

This initial scaffold includes:

- auth/account foundation
- separate NestJS API foundation for web and non-web clients
- manual-renewal billing via Platega
- object storage integration shape
- queue-backed domain skeletons for resume, trainer, and housekeeping
- shared admin and dashboard route structure

See `docs/` for architecture, workflow, and deployment details.

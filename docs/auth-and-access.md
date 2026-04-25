# Auth and Access

## Auth stack

- `Better Auth` is the primary auth layer
- `packages/auth/src/core.ts` owns the auth instance
- `packages/auth/src/session.ts` owns framework-agnostic session resolution and role hydration
- `packages/auth/src/server.ts` owns Next-specific guards
- `packages/auth/src/client.ts` owns browser auth client helpers

## Routes

Implemented auth routes:

- `/login`
- `/register`
- `/forgot-password` - placeholder, email delivery is not enabled in the base
- `/reset-password` - placeholder, email delivery is not enabled in the base
- `/verify-email` - placeholder, email delivery is not enabled in the base

Mounted auth handler:

- `apps/api` mounts Better Auth under `/api/auth/*`

Supported auth modes:

- browser session/cookie for web
- bearer token for mobile, bot, and non-browser clients
- JWT/JWKS for downstream service verification
- optional cross-subdomain session cookies via `AUTH_COOKIE_DOMAIN`
- email verification and password reset email delivery are intentionally not enabled in the base

## Roles

The current role model is:

- `user`
- `admin`
- `support`

Protected layouts:

- `app/(dashboard)/layout.tsx` -> any authenticated user
- `app/admin/layout.tsx` -> `admin` or `support`

## Current caveat

Auth pages are implemented as foundation forms, but the broader product still uses placeholder routes.
Treat the auth layer as usable platform code and the product routes as staged shells.

If `apps/web` and `apps/api` are deployed on sibling subdomains, set `AUTH_COOKIE_DOMAIN=.example.com` so the session cookie is visible to both origins.

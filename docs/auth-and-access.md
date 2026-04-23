# Auth and Access

## Auth stack

- `Better Auth` is the primary auth layer
- `packages/auth/src/core.ts` owns the auth instance
- `packages/auth/src/server.ts` owns Next-specific guards
- `packages/auth/src/client.ts` owns browser auth client helpers

## Routes

Implemented auth routes:

- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- `/verify-email`

Mounted auth handler:

- `/api/auth/[...all]`

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

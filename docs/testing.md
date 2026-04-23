# Testing

## Recommended layers

- unit tests for:
  - payment status mapping
  - queue payload validation
  - AI adapter input validation
- integration tests for:
  - auth route mounting
  - billing webhook handling
  - Prisma client and migrations
- e2e tests for:
  - login/register/verify flows
  - protected route access
  - admin access boundary

## Current scaffold status

The repository currently prioritizes buildable structure over broad automated coverage.

Minimum validation after changes:

- `pnpm typecheck`
- `pnpm build`
- targeted route smoke checks in `apps/web`

When product flows are implemented, expand into:

- webhook integration fixtures
- queue worker integration tests
- end-to-end auth and billing journeys

# Deployment

## Default deployment shape

- `web` container
- `api` container
- `worker` container
- `postgres`
- `redis`
- `minio`

The repository includes a root `docker-compose.yml` for this monorepo subtree.
Every runtime part of the project is started through Docker Compose.

## Server update flow

Use one command:

```bash
make deploy
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/project.ps1 deploy
```

The deploy flow pulls the latest code, rebuilds cached Docker images, starts infra, syncs Prisma schema, runs seed, and restarts `api`, `web`, and `worker`.

## Notes

- Docker builds use a root multi-target `Dockerfile`
- dependency download is cached by `pnpm fetch` and Docker BuildKit cache mounts
- source files are copied after dependency install, so code-only changes do not reinstall packages
- `db-sync` and `db-seed` are one-off Docker services, not host commands
- app containers use `restart: unless-stopped`
- `api` and `web` have Docker healthchecks
- infra ports are bound to `127.0.0.1` by default
- webhook routes require a public URL reachable by providers
- Better Auth base URL must match the deployed API URL
- S3 env vars must point to the actual storage backend used in the environment
- AdminJS is mounted on `/adminjs` and stores sessions in Postgres table `adminjs_session`

## Current limitation

This repository state is a platform scaffold, not a production-ready deployment artifact.
Before production, add:

- production env handling
- secrets management
- database backup strategy
- observability and alerting
- Prisma migrations and `prisma migrate deploy` instead of `prisma db push`

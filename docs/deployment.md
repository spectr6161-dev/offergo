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

## GitHub Actions production flow

Production deploy runs from GitHub Actions on every push to `main`.

The workflow:

1. runs Prisma generate and typechecks for `api` and `web`;
2. builds `api`, `web`, and `worker` Docker images in GitHub Actions;
3. pushes the images to GitHub Container Registry;
4. uploads only the deployment bundle to `/home/hinstil/offergo`;
5. runs `scripts/project.sh deploy-images` over SSH.

The server does not build application images in this flow. It pulls GHCR images and restarts Docker Compose services with the existing `.env` and volumes.

Required GitHub repository secrets:

```text
PROD_SSH_HOST
PROD_SSH_USER
PROD_SSH_PRIVATE_KEY
```

## Manual server update flow

For emergency manual deploy from the server, use:

```bash
make deploy
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/project.ps1 deploy
```

The manual flow rebuilds cached Docker images on the server. Prefer the GitHub Actions flow for normal production updates.

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

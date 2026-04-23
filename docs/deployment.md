# Deployment

## Default deployment shape

- `web` container
- `worker` container
- `postgres`
- `redis`
- `minio`

The repository includes a root `docker-compose.yml` for this monorepo subtree.

## Notes

- current Dockerfiles install and build from the monorepo root context
- webhook routes require a public URL reachable by providers
- Better Auth base URL must match the deployed application URL
- S3 env vars must point to the actual storage backend used in the environment

## Current limitation

This repository state is a platform scaffold, not a production-ready deployment artifact.
Before production, add:

- proper image optimization
- production env handling
- secrets management
- database backup strategy
- observability and alerting

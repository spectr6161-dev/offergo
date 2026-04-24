# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update -y && \
  apt-get install -y --no-install-recommends ca-certificates openssl && \
  rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/worker/package.json ./apps/worker/package.json
COPY packages/ai/package.json ./packages/ai/package.json
COPY packages/auth/package.json ./packages/auth/package.json
COPY packages/billing/package.json ./packages/billing/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/queue/package.json ./packages/queue/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/ui/package.json ./packages/ui/package.json

RUN --mount=type=cache,id=offergo-pnpm-store,target=/pnpm/store \
  pnpm config set store-dir /pnpm/store && \
  pnpm fetch --frozen-lockfile

RUN --mount=type=cache,id=offergo-pnpm-store,target=/pnpm/store \
  pnpm config set store-dir /pnpm/store && \
  pnpm install --frozen-lockfile --offline

FROM base AS deps
COPY apps ./apps
COPY packages ./packages

RUN pnpm --filter @offergo/db db:generate

FROM deps AS dev
CMD ["pnpm", "dev"]

FROM deps AS api
RUN pnpm --filter @offergo/api build
EXPOSE 3001
CMD ["pnpm", "--filter", "@offergo/api", "start"]

FROM deps AS web
RUN pnpm --filter @offergo/web build
EXPOSE 3000
CMD ["pnpm", "--filter", "@offergo/web", "start"]

FROM deps AS worker
RUN pnpm --filter @offergo/worker build
CMD ["pnpm", "--filter", "@offergo/worker", "start"]

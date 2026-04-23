# Setup

## Prerequisites

- Node 22
- pnpm 10
- Docker with access from the current environment if you want containerized infra

## Local environment

1. Copy `.env.example` to `.env`
2. Adjust secrets and provider credentials
3. Install dependencies:

```bash
cd /mnt/c/lakonit/la_sobes/offergo_app
pnpm install
```

## Infra

If Docker is available:

```bash
docker compose up -d postgres redis minio mailpit
```

Default ports:

- Postgres: `5434`
- Redis: `6379`
- MinIO API: `9000`
- MinIO console: `9001`
- Mailpit SMTP: `1025`
- Mailpit UI: `8025`

## Prisma

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

The seed currently creates:

- a default admin user
- baseline plans
- minimal question tags and demo questions

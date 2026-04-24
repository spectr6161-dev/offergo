# Runbook запуска и деплоя

## Требования

- Docker Engine или Docker Desktop
- Docker Compose v2
- Git
- `make` желательно на Linux/macOS, но можно запускать `sh scripts/project.sh` напрямую
- Node.js и pnpm на сервере не нужны

## Первый запуск с нуля

Linux/server:

```bash
make setup
```

Без `make`:

```bash
sh scripts/project.sh setup
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/project.ps1 setup
```

Команда делает полный Docker-only setup:

- создаёт `.env` из `.env.example`, если файла ещё нет
- собирает Docker images с кешированием pnpm store
- поднимает `postgres`, `redis`, `minio`, `mailpit`
- запускает job-контейнер `db-sync`
- запускает job-контейнер `db-seed`
- поднимает `api`, `web`, `worker`
- показывает `docker compose ps`

## Локальный dev-запуск

Linux/macOS:

```bash
make dev
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/project.ps1 dev
```

Dev-режим использует `docker-compose.dev.yml`:

- исходники монтируются в контейнеры через bind mount
- `node_modules` живут в named Docker volumes
- pnpm store живёт в named Docker volume
- Prisma generate/db push/seed выполняются внутри Docker
- host-машине не нужен локальный `pnpm install`

Если зависимости изменились и dev-volume устарел:

```bash
make clean-volumes
make dev
```

## Обновление сервера

Linux/server:

```bash
make deploy
```

Без `make`:

```bash
sh scripts/project.sh deploy
```

Deploy flow:

- `git pull --ff-only`
- `docker compose build`
- старт infra-контейнеров
- `db-sync`
- `db-seed`
- restart `api`, `web`, `worker`
- `docker compose ps`

Пока в проекте нет Prisma migrations, deploy использует `prisma db push --skip-generate`. Когда появятся production migrations, этот шаг нужно заменить на `prisma migrate deploy`.

## Основные команды

Linux/macOS:

```bash
make setup
make dev
make build
make deploy
make restart
make logs
make ps
make health
make clean
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/project.ps1 setup
powershell -ExecutionPolicy Bypass -File scripts/project.ps1 dev
powershell -ExecutionPolicy Bypass -File scripts/project.ps1 build
powershell -ExecutionPolicy Bypass -File scripts/project.ps1 deploy
powershell -ExecutionPolicy Bypass -File scripts/project.ps1 restart
powershell -ExecutionPolicy Bypass -File scripts/project.ps1 logs
powershell -ExecutionPolicy Bypass -File scripts/project.ps1 ps
powershell -ExecutionPolicy Bypass -File scripts/project.ps1 health
powershell -ExecutionPolicy Bypass -File scripts/project.ps1 clean
```

## Docker services

- `postgres`: Postgres + pgvector, данные в volume `postgres-data`
- `redis`: Redis, данные в volume `redis-data`
- `minio`: S3-compatible storage, данные в volume `minio-data`
- `mailpit`: SMTP/UI для локальной почты
- `api`: NestJS API, AdminJS, Swagger, auth/billing/storage endpoints
- `web`: Next.js web client
- `worker`: BullMQ worker runtime
- `db-sync`: одноразовый job для синхронизации Prisma schema
- `db-seed`: одноразовый job для seed

Infra-порты в compose привязаны к `127.0.0.1`, чтобы Postgres/Redis/MinIO/Mailpit не открывались наружу на сервере. Публичными остаются `web` и `api`.

## URL

- Web: `http://localhost:3000`
- API health: `http://localhost:3001/api/v1/health`
- Swagger: `http://localhost:3001/api/docs`
- AdminJS: `http://localhost:3001/adminjs`
- Mailpit: `http://localhost:8025`
- MinIO console: `http://localhost:9001`

## Диагностика

Проверить контейнеры:

```bash
docker compose ps
```

Смотреть логи:

```bash
docker compose logs -f --tail=200
```

Проверить health:

```bash
make health
```

Проверить Docker build cache:

```bash
docker compose --progress=plain build api
```

Если сборка кажется зависшей на `pnpm`, смотри строки `reused/downloaded/added`. После первого запуска повторная сборка должна использовать cache. Долгий этап `exporting layers` на Docker Desktop для Windows нормален и зависит от скорости диска.

## Типовые проблемы

- `Failed to fetch` на web: проверь, что `api` healthy и `NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3001`.
- Prisma не видит БД: внутри Docker host должен быть `postgres`, не `localhost`.
- Redis не доступен из контейнера: внутри Docker host должен быть `redis`.
- Mailpit не получает письма: внутри Docker `SMTP_HOST=mailpit`, UI доступен на `http://localhost:8025`.
- После изменения зависимостей dev-контейнер ведёт себя странно: выполни `make clean-volumes`, затем `make dev`.

## AdminJS

AdminJS доступен на:

```text
http://localhost:3001/adminjs
```

Доступ разрешён пользователям с ролью `admin` или `support`. Seed создаёт администратора:

```text
admin@offergo.local
Admin12345!
```

Все Prisma models регистрируются автоматически из Prisma DMMF. Сессии AdminJS хранятся в Postgres-таблице `adminjs_session`, которую создаёт `connect-pg-simple`.

#!/usr/bin/env sh
set -eu

command_name="${1:-setup}"

compose() {
  echo "> docker compose $*"
  docker compose "$@"
}

dev_compose() {
  echo "> docker compose -f docker-compose.yml -f docker-compose.dev.yml $*"
  docker compose -f docker-compose.yml -f docker-compose.dev.yml "$@"
}

ensure_env_file() {
  if [ ! -f .env ]; then
    cp .env.example .env
    echo "created .env from .env.example"
  fi
}

sync_database() {
  compose run --rm db-sync
}

seed_database() {
  compose run --rm db-seed
}

case "$command_name" in
  setup)
    ensure_env_file
    compose build
    compose up -d postgres redis minio
    sync_database
    seed_database
    compose up -d api web worker
    compose ps
    ;;
  dev)
    ensure_env_file
    dev_compose build
    dev_compose run --rm api pnpm install --frozen-lockfile --prefer-offline
    dev_compose run --rm api pnpm --filter @offergo/db db:generate
    dev_compose run --rm api pnpm --filter @offergo/db exec prisma db push --skip-generate
    dev_compose run --rm api pnpm --filter @offergo/db db:seed
    dev_compose up
    ;;
  build)
    compose build
    ;;
  seed)
    ensure_env_file
    seed_database
    ;;
  deploy)
    if [ -d .git ]; then
      echo "> git pull --ff-only"
      git pull --ff-only
    fi
    compose build
    compose up -d postgres redis minio
    sync_database
    compose up -d api web worker
    compose ps
    ;;
  restart)
    compose up -d api web worker
    compose ps
    ;;
  logs)
    compose logs -f --tail=200
    ;;
  ps)
    compose ps
    ;;
  health)
    compose ps
    echo "> docker compose exec -T api node -e \"fetch('http://127.0.0.1:3001/api/v1/health').then(async (r)=>{ console.log(await r.text()); process.exit(r.ok?0:1) }).catch((e)=>{ console.error(e); process.exit(1) })\""
    docker compose exec -T api node -e "fetch('http://127.0.0.1:3001/api/v1/health').then(async (r)=>{ console.log(await r.text()); process.exit(r.ok?0:1) }).catch((e)=>{ console.error(e); process.exit(1) })"
    ;;
  clean)
    compose down --remove-orphans
    dev_compose down --remove-orphans
    ;;
  clean-volumes)
    compose down --remove-orphans --volumes
    dev_compose down --remove-orphans --volumes
    ;;
  *)
    echo "Unknown command: $command_name" >&2
    echo "Usage: scripts/project.sh setup|dev|build|seed|deploy|restart|logs|ps|health|clean|clean-volumes" >&2
    exit 1
    ;;
esac

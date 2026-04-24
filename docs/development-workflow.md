# Development Workflow

## Add a new feature safely

1. Decide which package owns the capability
2. Add contracts and types first
3. Add DB changes if the capability needs persistence
4. Add adapter or queue behavior if it touches external systems
5. Add route handlers or server actions
6. Add the final page or UI flow

## Workspace commands

Docker-first path:

```bash
make setup
make dev
make build
make health
make logs
make clean
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/project.ps1 setup
powershell -ExecutionPolicy Bypass -File scripts/project.ps1 dev
powershell -ExecutionPolicy Bypass -File scripts/project.ps1 build
powershell -ExecutionPolicy Bypass -File scripts/project.ps1 health
powershell -ExecutionPolicy Bypass -File scripts/project.ps1 logs
powershell -ExecutionPolicy Bypass -File scripts/project.ps1 clean
```

Host Node path is optional and should not be required for a fresh machine or server:

```bash
pnpm install
pnpm dev:web
pnpm dev:api
pnpm dev:worker
pnpm build
pnpm typecheck
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

## Current guidance

Because the current state is a foundation scaffold:

- prefer small, package-owned additions
- do not turn placeholder routes into full features accidentally
- keep product workflows behind clearly named packages and actions
- prefer Docker-first setup for new machines and agents
- run Prisma sync/seed through Docker jobs unless you are intentionally debugging locally

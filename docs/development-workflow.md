# Development Workflow

## Add a new feature safely

1. Decide which package owns the capability
2. Add contracts and types first
3. Add DB changes if the capability needs persistence
4. Add adapter or queue behavior if it touches external systems
5. Add route handlers or server actions
6. Add the final page or UI flow

## Workspace commands

```bash
pnpm install
pnpm dev:web
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

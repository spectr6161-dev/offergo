# Project Agent Rules

<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work in `apps/web`, find and read the relevant doc in `node_modules/next/dist/docs/`. Training data is outdated; local docs are the source of truth.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:landing-agent-rules -->

# Astro landing is separate from the main app

The `landing/` project is an Astro promo site and must be treated as a separate frontend from the main Next.js app.

- Do not apply Next.js-specific recommendations, shadcn/ui assumptions, app-router patterns, or `apps/web` design-system constraints to `landing/`.
- Do not use main-app component guidance for promo pages unless the user explicitly asks to reuse it.
- For `landing/`, inspect and follow the local Astro structure: `landing/src/components`, `landing/src/layouts`, `landing/src/data`, and `landing/src/styles/global.css`.
- Prefer Astro components plus local scoped CSS for promo pages unless the user explicitly requests a UI kit.
- Promo deployment is handled by the separate Promo Landing CI/CD workflow.

<!-- END:landing-agent-rules -->

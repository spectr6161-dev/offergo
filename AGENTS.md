<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated - the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

# Project Frontend Rules

## Default product language

The product UI in this repository is Russian by default.

- Write user-facing interface text in Russian unless the user explicitly asks for another language.
- Prefer Russian labels, button text, validation messages, placeholders, navigation labels, and empty states.
- Do not mix English UI copy into Russian pages unless it is a real brand name, API term, or an explicitly requested exception.

## Locked frontend stack

For all new frontend work in this repository, use this stack:

- `Next.js`
- `shadcn/ui`
- `Tailwind CSS`
- `TypeScript`

Do not introduce `MUI` back into the project.

## Default UI workflow

Before building any new page, component, or frontend flow:

1. Read the relevant Next.js docs first.
2. Check the existing codebase for a reusable solution before writing new code.
3. Check whether `shadcn/ui` already has a ready-made component or block that fits the task.
4. Prefer composing existing `shadcn/ui` components over custom markup.
5. Only write custom UI code when there is no suitable built-in or already-added solution.

## shadcn/ui rules

- Prefer existing installed components first.
- Before adding a new UI primitive, check the local component set and project code.
- Before inventing a custom solution, check `shadcn/ui` docs and examples first.
- When adding components, use the project package manager runner: `pnpm dlx shadcn@latest ...`
- Prefer semantic Tailwind classes and project tokens over raw one-off colors and ad-hoc styling.
- Prefer composition over reinvention: cards, dialogs, tables, forms, tabs, sheets, alerts, and empty states should come from `shadcn/ui` when possible.

## Ready-made solution rule

The default assumption is:

- first look for an existing local component
- then look for an existing `shadcn/ui` component or block
- only after that write custom implementation

## Layout and copy constraints

- Avoid `boxed-view` layouts by default.
- Do not wrap the whole screen in a large centered card unless the user explicitly wants that pattern or the flow truly requires it.
- If a boxed card is unavoidable, keep it minimal and never make it the main visual gimmick.
- Prefer open layouts, direct structure, and clear hierarchy over decorative framing.

- Never add extra UI elements that were not requested.
- Never add helper copy, explanatory subtitles, descriptions, hints, or marketing text unless the user explicitly asked for them.
- If the user asked for specific fields and actions, render only those fields and actions.
- Do not add filler text such as:
  - "Enter your login and password or continue with Telegram and Google."
  - "Login currently works as email."
  - "Use a strong password with at least 8 characters."
- Keep forms strict, compact, and literal. No decorative copywriting by default.

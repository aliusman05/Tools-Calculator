# Project rules for Claude Code

## Stack

- Next.js (App Router) + TypeScript (strict mode) + Tailwind CSS
- MDX for page content, Vitest for unit tests, Playwright for e2e smoke tests
- Recharts (lazy loaded) for charts
- Package manager: pnpm

## Rules

- All calculator math lives in `src/lib/calculators/*.ts` as pure functions with no React or DOM code.
- Every calculator function must have a matching test file in `src/lib/calculators/__tests__/`.
- Never ship a calculator without tests that compare against known correct values.
- Use a registry (`src/lib/registry.ts`) so adding a calculator requires one config entry + one component + one MDX file.
- No `any` types. No unused dependencies. Keep client JS small; use Server Components by default and `"use client"` only for interactive calculators.
- Money math: use integer cents or round only at display time. Never round intermediate values.
- All pages must be statically generated.
- Accessibility: labels on all inputs, keyboard navigable, visible focus states, color contrast AA.
- Wide tables must scroll inside their own container (`overflow-x-auto`), never the page body.
- Do not copy text from other websites. Write original explanations.
- Run `pnpm lint && pnpm typecheck && pnpm test` before declaring any task done.
- Commit after each completed task with a clear message.

## Commands

- `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`

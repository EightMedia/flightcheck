# 1.3.0

## Wat er verandert

- Runtime: `commander` 14 → 15 (ESM-only; Node `>=22.12.0`), `robots-parser` 3.0.1 → 3.1.1.
- Tooling: `vitest` 4 → 5, `typescript` 5 → 7, `pnpm` pin 11.28.13 → 11.29.0.
- TypeScript 6+/7: set explicit `rootDir: "src"` in `tsconfig.json`.
- Security: override `vite` to `>=8.1.6` (dev audit highs via vitest).
- Engines: Node `>=22.12.0` (was `>=22.0.0`).

## Waarom

Wekelijks onderhoud 2026-w48: zoveel mogelijk dependencies bijwerken, inclusief eerder uitgestelde majors die zonder codewijzigingen groen bleven.

## Build en tests

- `pnpm audit --prod --audit-level high` — clean (1 moderate `minimatch` via crawlee blijft)
- `pnpm test` — 169 passed
- `pnpm typecheck` / `pnpm build` — OK
- `jscpd` (src, min-lines 100) — geen duplicaten

## Open / upstream

- Deprecated transitive: `lodash.isequal` (crawlee/`ow`), `whatwg-encoding` (cheerio/jsdom), `@sapphire/shapeshift` — wacht op upstream.
- `pnpm` 12 en `@types/node` 26 uitgesteld (package manager major / types voor Node 26 terwijl `.nvmrc` op 24 blijft).

## Wie

Cursor cloud maintenance agent.

# 1.2.1

## Wat er verandert

- Patch/minor dependency updates (`cheerio`, `commander`, `crawlee`, `pino`, `zod`, `@types/node`, `tsx`, `vitest`).
- pnpm package manager pin updated to 11.28.13; security overrides moved to `pnpm-workspace.yaml` (pnpm 11.28+).
- Transitive high-severity advisories mitigated via overrides (`undici`, `lodash`, `ws`, `adm-zip`, `brace-expansion`, `browserslist`, `figlet`, `ip-address`, `nanoid@^3`).
- Inline GitHub Actions PR checks (audit, test+build, version/changelog). Shared `EightMedia/ci-workflows` is private and cannot be reused from this public repo.

## Waarom

Wekelijks onderhoud 2026-w47: dependencies bijwerken, bekende high-severity audit findings aanpakken, en CI aansluiten op de gedeelde Eight-workflows.

## Build en tests

- `pnpm audit --prod --audit-level high` — clean
- `pnpm test` — 169 passed
- `pnpm typecheck` / `pnpm build` — OK

## Wie

Argus weekly maintenance agent.

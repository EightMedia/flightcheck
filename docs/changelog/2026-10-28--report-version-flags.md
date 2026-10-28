# Changelog

## Metadata

- Datum: 2026-10-28
- Branch: main
- Contributors:
  - Matthijs Brouwer (`matthijs@eight.nl`)

## Wijzigingen

- Rapporten (`*-report.json` / `*-report.md`) vermelden `flightcheckVersion` en CLI `flags`
- Patch release `1.0.1`

## Waarom

- Reproduceerbaarheid: weten met welke Flightcheck-versie en flags een rapport is gemaakt

## Build en test status

- Build: Geslaagd (`pnpm build`)
- Tests: Geslaagd (`pnpm test`, 155)
- Opmerking: vitest includeert nu ook `tests/**/*.test.ts`

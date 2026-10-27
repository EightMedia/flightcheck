# Changelog

## Metadata

- Datum: 2026-10-27
- Branch: feat/structured-report-json
- Contributors:
  - Matthijs Brouwer (`matthijs@eight.nl`)

## Wijzigingen

- Analyze schrijft `*-report.json` (analysis + platte findings) als bron van waarheid
- `*-report.md` wordt daaruit gerenderd in gewone taal, gegroepeerd op severity
- Fix-manifest en agent-jobs worden niet meer gegenereerd
- Docs/README bijgewerkt; agent-fixes gemarkeerd als deprecated

## Waarom

- Machine-readable output voor tools én leesbare MD voor minder technische lezers,
  zonder dubbele agent-orchestratie-output

## Build en test status

- Build: Geslaagd (`tsc --noEmit`)
- Tests: Geslaagd (`npm test`, 150 tests)
- Opmerking: geen project-eslint-config aanwezig

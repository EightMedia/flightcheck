# Changelog

## Metadata

- Datum: 2026-10-28
- Branch: main
- Contributors:
  - Matthijs Brouwer (`matthijs@eight.nl`)

## Wijzigingen

- Default `--max-pages` verlaagd van 1000 naar 100
- Slimme seed-selectie op URL-boomvorm (niet op slug-namen): list = veel blad-kinderen
- Round-robin sample van leaves per list-parent; structurele links via `forefront`
- Findings krijgen een optioneel `fix`-voorstel in JSON en Markdown
- Crawlee storage onder `.flightcheckStorage/<hash>/`, opgeruimd na de run
- Packageversie naar 1.1.0

## Bijgewerkte pakketten

| Pakket | Van | Naar |
| --- | --- | --- |
| `@eightmedia/flightcheck` | 1.0.1 | 1.1.0 |

## Build en test status

- Build: Geslaagd (`pnpm build`)
- Tests: Geslaagd (`pnpm test`, 169)
- Opmerking: —

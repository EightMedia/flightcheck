# Changelog

## Metadata

- Datum: 2026-09-28
- Branch: feature/agent-ready-check
- Contributors:
  - Matthijs Brouwer (`matthijs@eight.nl`)

## Wijzigingen

- Nieuwe standalone check `agent-ready` in de default pipeline (Content Signals, AI bot rules, llms.txt, Markdown negotiation, Link headers, well-known protocol discovery).
- Analyze-rapportsectie **Agent readiness** plus fix-package `agent-ready` met prompt.
- Docs bijgewerkt (`agent-ready.md`, checks, check-api, analyze, agent-fixes, qc-checks-plan, README, index).

## Waarom

- Sites moeten ook voor AI-agents discoverable en bruikbaar zijn; isitagentready.com-checks pasten nog niet in Flightcheck.
- Content-sites profiteren vooral van robots-policy, llms.txt en markdown negotiation zonder zware commerce/MCP-eisen.

## Build en test status

- Build: Geslaagd
- Tests: Geslaagd
- Opmerking: `pnpm build` (tsc) en `pnpm test` (166 tests) groen op Node 24.

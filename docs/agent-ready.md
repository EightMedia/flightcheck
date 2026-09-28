# Agent readiness

Flightcheck can audit how ready a site is for AI agents, aligned with the practical
checks from [isitagentready.com](https://isitagentready.com/).

**Status:** implemented as standalone check `agent-ready` (default pipeline).

## What it checks

| Area | Signal | Severity when missing |
| --- | --- | --- |
| Bot access | `Content-Signal` in robots.txt | warning |
| Bot access | Explicit AI bot `User-agent` rules (GPTBot, ClaudeBot, …) | warning |
| Content | `/llms.txt` plain-text overview with `#` title | warning / review if incomplete |
| Content | Markdown negotiation (`Accept: text/markdown` → `text/markdown`) | warning |
| Discoverability | Homepage `Link` headers (`api-catalog`, `service-doc`, …) | review |
| Protocols | Well-known MCP / Agent Skills / API Catalog / ARD / A2A | review (informational for content sites) |

robots.txt existence and sitemaps remain in the existing `robots-txt` and `sitemap` checks.

## Architecture

- Module: `src/checks/agent-ready.ts`
- Pure analyzer: `analyzeAgentReady()` (unit-tested)
- Network runner: `runAgentReadyCheck()` — parallel fetches of robots, llms.txt, homepage
  (HTML + markdown Accept), and well-known endpoints
- Wave 1 (parallel with crawl / DNS / headers / robots)
- Report section: `## Agent readiness` via `buildAgentReadySection()` in `reportTier1.ts`
- Fix package: `agent-ready` → `prompts/fix/agent-ready.md`

## CLI

```bash
pnpm run flightcheck -- https://example.com
pnpm run flightcheck -- https://example.com --checks agent-ready,analyze
```

## Out of scope (for now)

- Commerce protocols (x402, UCP, ACP, MPP)
- Web Bot Auth
- DNS-AID
- WebMCP (needs a browser)
- Full OAuth / Auth.md discovery as hard failures

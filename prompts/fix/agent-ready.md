## Agent readiness

Applies to discoverability and content-access gaps for AI agents: Content Signals / AI bot rules in
robots.txt, `/llms.txt`, Markdown content negotiation, and discovery Link headers / well-known
endpoints.

Aligned with common checks from [isitagentready.com](https://isitagentready.com/).

## Where to fix (typical Next.js / Sanity sites)

- **robots.txt** — `public/robots.txt`, a robots route, or hosting AI Crawl Control (Cloudflare).
  Add `Content-Signal` under `User-agent: *` and explicit `User-agent` blocks for AI crawlers
  (`GPTBot`, `ClaudeBot`, `Google-Extended`, …).
- **llms.txt** — static `public/llms.txt` or a route that returns plain text with an H1 title and
  links to the most important content.
- **Markdown negotiation** — middleware or route that, when `Accept: text/markdown`, returns page
  body as markdown (`Content-Type: text/markdown`) without header/footer chrome. Optional fallback:
  `/path/index.md`.
- **Link headers** — `next.config` headers, middleware, or hosting transform rules pointing at
  machine-readable resources (`rel="api-catalog"`, `service-doc`, …).
- **Protocol discovery** (optional for content sites) — `/.well-known/mcp/server-card.json`,
  `/.well-known/agent-skills/index.json`, `/.well-known/api-catalog`, `/.well-known/ai-catalog.json`.

## Package-specific verification

- `curl -sI https://SITE/` and confirm useful `Link` headers when that issue was raised.
- `curl -s https://SITE/llms.txt` — plain text, starts with `# …`.
- `curl -sH 'Accept: text/markdown' https://SITE/` — `Content-Type: text/markdown`.
- Re-run flightcheck `agent-ready` (or the full default pipeline) and confirm the warnings clear.

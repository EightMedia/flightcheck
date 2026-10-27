# Flightcheck

Pre-launch website audit CLI and library.

Flightcheck crawls a site and checks what is wrong before go-live: missing meta tags,
accessibility issues, weak security headers, DNS settings, robots.txt and sitemap
mismatches, exposed secrets, and more. Every run produces:

- crawl data (`*-raw.json`)
- a structured report (`*-report.json`) — analysis facts + findings
- a plain-language Markdown report (`*-report.md`) rendered from that JSON

## Install

```bash
pnpm add -g @eightmedia/flightcheck
# or: npm install -g @eightmedia/flightcheck
```

Or run without installing:

```bash
pnpm dlx @eightmedia/flightcheck https://example.com
# or: npx @eightmedia/flightcheck https://example.com
```

## How it works

1. **Crawl & checks** — pages are scanned and modular checks run (SEO, a11y, security,
   infra, agent readiness).
2. **Analyze** — issues become a flat `findings[]` list. Each finding has severity,
   category, scope, and a short title/message. Site facts (stack, DNS, …) live under
   `analysis`.
3. **Reports** — `*-report.json` is the source of truth for tools; `*-report.md` is the
   same data in readable form (grouped by severity for humans).

| Output | Audience | Purpose |
| --- | --- | --- |
| `*-raw.json` | Machine | Source data from all checks |
| `*-report.json` | Machine / tools | `analysis` + flat `findings[]` |
| `*-report.md` | Human | Plain-language report from the JSON |

See [docs/analyze.md](docs/analyze.md) for the report schema.

## Quick start

```bash
pnpm add -D @eightmedia/flightcheck
pnpm exec flightcheck https://example.com
```

This writes timestamped files in `./flightcheck/`, for example:

- `./flightcheck/20260618.1413-example.com-raw.json`
- `./flightcheck/20260618.1413-example.com-report.json`
- `./flightcheck/20260618.1413-example.com-report.md`

By default this runs all implemented checks: crawl, security headers, DNS, robots.txt,
sitemap, agent readiness, and analyze. If the start URL is a domain redirect, only
redirect validation, DNS, and analyze run. Use `--checks crawl` to force a full crawl on
redirect domains. Use `--checks` for a subset, or `--json-only` for crawl JSON only.

Re-analyze an existing crawl without re-crawling:

```bash
pnpm exec flightcheck-analyze ./flightcheck/20260618.1413-example.com-raw.json
```

## Documentation

- [What Flightcheck checks](docs/checks.md) — plain-language checklist
- [Analyze reports](docs/analyze.md) — `*-report.json` / `*-report.md`
- [Crawler](docs/crawler.md) — crawl CLI and flags
- [Check API](docs/check-api.md) — modular checks for developers
- [Stack detection](docs/stack.md)
- [Agent readiness](docs/agent-ready.md) — llms.txt, markdown negotiation, …
- [QC checks plan](docs/qc-checks-plan.md) — roadmap
- [Docs index](docs/index.md) · [Changelog](CHANGELOG.md)

## Programmatic API

```typescript
import { runChecks } from "@eightmedia/flightcheck";

const { outputs } = await runChecks({
  startUrl: "https://example.com",
});

const report = outputs.analyze?.report;
// report.analysis.stack, report.findings, …
```

## Development

```bash
nvm use   # see .nvmrc
pnpm install
pnpm test
pnpm build
```

## License

Flightcheck is licensed under [GNU GPL v3.0](LICENSE). You may use, modify, and
distribute it under the GPL terms. Derivative works must also be open source under a
compatible license — it cannot be incorporated into closed-source products without
complying with the GPL (typically by open-sourcing the combined work).

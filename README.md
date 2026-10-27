# 🚀 Flightcheck

**Pre-launch website audit — with a structured report for people and tools.**

Flightcheck crawls a site and checks what's wrong before you go live: missing meta tags,
accessibility issues, weak security headers, DNS settings, robots.txt and sitemap mismatches,
and more. Analyze turns that into one machine-readable JSON report and a plain-language
Markdown report generated from it.

## How it works

1. **Crawl & checks** — Flightcheck scans pages and runs modular checks (SEO, a11y, security,
   infra).
2. **Analyze** — findings become a flat list with severity, category, and scope metadata.
3. **Reports** — `*-report.json` is the source of truth; `*-report.md` is a readable view of
   the same data for less technical readers.

| Output | Audience | Purpose |
| --- | --- | --- |
| `*-raw.json` | Machine | Source data from all checks |
| `*-report.json` | Machine / tools | Analysis facts + findings |
| `*-report.md` | Human | Plain-language report rendered from the JSON |

## Quick start

```bash
pnpm install
pnpm run flightcheck -- https://example.com
```

This writes timestamped files in `./flightcheck/`, for example:

- `./flightcheck/20260618.1413-eight.nl-raw.json` — source data from all checks
- `./flightcheck/20260618.1413-eight.nl-report.json` — structured analysis + findings
- `./flightcheck/20260618.1413-eight.nl-report.md` — human-readable report

By default this runs all implemented checks: crawl, security headers, DNS, robots.txt,
sitemap validation, agent readiness, and analyze. If the start URL is a domain redirect, only redirect
validation, DNS, and analyze run. Use `--checks crawl` to force a full crawl on redirect
domains. Use `--checks` for a subset, or `--json-only` for crawl JSON only.

To re-analyze an existing JSON file without re-crawling:

```bash
pnpm run analyze -- ./flightcheck/20260618.1413-eight.nl-raw.json
```

## Documentation

- `docs/checks.md` — plain-language list of everything Flightcheck checks
- `docs/check-api.md` — modular check API and extension guide
- `docs/agent-ready.md` — AI agent readiness checks (llms.txt, markdown negotiation, …)
- `docs/qc-checks-plan.md` — roadmap for full site QC checks
- `docs/crawler.md`
- `docs/analyze.md`
- `docs/stack.md`
- `docs/changelog/` — branch changelogs
- `docs/index.md` — documentation index

## License

Flightcheck is licensed under [GNU GPL v3.0](LICENSE). You may use, modify, and
distribute it under the GPL terms. Derivative works must also be open source under a
compatible license — it cannot be incorporated into closed-source products without
complying with the GPL (typically by open-sourcing the combined work).

## Programmatic API

```typescript
import { runChecks, runCrawlCheck, runAnalyzeCheck } from "@eightmedia/flightcheck";

const { outputs } = await runChecks({
  startUrl: "https://example.com",
});

const report = outputs.analyze?.report;
```

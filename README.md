# Flightcheck

Crawler voor site-verificatie met output naar JSON.

## Quick start

```bash
pnpm install
pnpm run flightcheck -- https://example.com
```

This writes timestamped files in `./flightcheck/`, for example:

- `./flightcheck/20260618.1413-eight.nl-raw.json`
- `./flightcheck/20260618.1413-eight.nl-report.md`

By default this runs all implemented checks: crawl, security headers, DNS, robots.txt,
sitemap validation, and analyze. If the start URL is a domain redirect, only redirect
validation, DNS, and analyze run. Use `--checks crawl` to force a full crawl on redirect
domains. Use `--checks` for a subset, or `--json-only` for crawl JSON only.

To re-analyze an existing JSON file without re-crawling:

```bash
pnpm run analyze -- ./flightcheck/20260618.1413-eight.nl-raw.json
```

## Documentatie

- `docs/qc-checks-plan.md` — roadmap for full site QC checks
- `docs/checks.md` — modular check API and extension guide
- `docs/agent-fixes.md` — agent-jobs output (one PR per package) and prompt composition
- `docs/crawler.md`
- `docs/analyze.md`
- `docs/stack.md`

## License

Flightcheck is licensed under [GNU GPL v3.0](LICENSE). You may use, modify, and
distribute it under the GPL terms. Derivative works must also be open source under a
compatible license — it cannot be incorporated into closed-source products without
complying with the GPL (typically by open-sourcing the combined work).

Technology fingerprints in `data/webappanalyzer/` are derived from
[enthec/webappanalyzer](https://github.com/enthec/webappanalyzer).

## Programmatic API

```typescript
import { runChecks, runCrawlCheck, runAnalyzeCheck } from "@eightmedia/flightcheck";

const { outputs } = await runChecks({
  startUrl: "https://example.com",
});
```

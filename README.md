# 🚀 Flightcheck

**Pre-launch website audit — with ready-to-use fix instructions for AI agents.**

Flightcheck crawls a site and checks what's wrong before you go live: missing meta tags,
accessibility issues, weak security headers, DNS settings, robots.txt and sitemap mismatches,
and more. The result is structured output that both developers and AI agents can use to get 
started optimizing the site.

## How it works

1. **🕷️ Crawl & checks** — Flightcheck scans pages and runs modular checks (SEO, a11y, security,
   infra).
2. **🕵️‍♀️ Analyze** — findings are grouped by where they need to be fixed: site-wide, per template,
   or per page.
3. **🦾 Agent jobs** — for each fix package, Flightcheck generates a `prompt.md` with concrete
   instructions. AI agents can use these to propose targeted pull requests: one PR per package,
   reviewable and verifiable. The prompt are conservative: it's instructed not to commit/push/change
   without developer consent.

| Output | Audience | Purpose |
| --- | --- | --- |
| `*-report.md` | Human | Summary, priorities, grouped todos |
| `*-fix-manifest.json` | Orchestrator / agents | Work packages, routing, verification hooks |
| `*-agent-jobs/` | AI agents | `BASE.md`, `PLAN.md`, and a `prompt.md` per package |

See [docs/agent-fixes.md](docs/agent-fixes.md) for the full agent workflow.

## Quick start

```bash
pnpm install
pnpm run flightcheck -- https://example.com
```

This writes timestamped files in `./flightcheck/`, for example:

- `./flightcheck/20260618.1413-eight.nl-raw.json` — source data from all checks
- `./flightcheck/20260618.1413-eight.nl-report.md` — human-readable report
- `./flightcheck/20260618.1413-eight.nl-fix-manifest.json` — work packages for agents
- `./flightcheck/20260618.1413-eight.nl-agent-jobs/` — prompts per fix package

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
- `docs/agent-fixes.md` — agent-jobs output (one PR per package) and prompt composition
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
```

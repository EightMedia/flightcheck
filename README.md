# Flightcheck

**Pre-launch audit voor websites — met kant-en-klare fix-instructies voor AI agents.**

Flightcheck crawlt een site en controleert wat er mis is vóór je live gaat: ontbrekende
meta-tags, toegankelijkheidsproblemen, zwakke security headers, DNS-instellingen,
robots.txt- en sitemap-afwijkingen, en meer. Het resultaat is geen vage checklist, maar
gestructureerde output waar zowel developers als AI agents direct mee aan de slag kunnen.

## Hoe het werkt

1. **Crawl & checks** — Flightcheck scant pagina's en draait modulaire checks (SEO, a11y,
   security, infra).
2. **Analyse** — bevindingen worden gegroepeerd op waar ze gefixt moeten worden:
   site-wide, per template, of per pagina.
3. **Agent jobs** — voor elk fix-pakket genereert Flightcheck een `prompt.md` met concrete
   instructies. AI agents kunnen daarmee gerichte pull requests voorstellen: één PR per
   package, reviewbaar en verifieerbaar.

| Output | Voor wie | Doel |
| --- | --- | --- |
| `*-report.md` | Mens | Samenvatting, prioriteiten, gegroepeerde todo's |
| `*-fix-manifest.json` | Orchestrator / agents | Work packages, routing, verificatie-hooks |
| `*-agent-jobs/` | AI agents | `BASE.md`, `PLAN.md`, en per package een `prompt.md` |

Zie [docs/agent-fixes.md](docs/agent-fixes.md) voor het volledige agent-workflow.

## Quick start

```bash
pnpm install
pnpm run flightcheck -- https://example.com
```

This writes timestamped files in `./flightcheck/`, for example:

- `./flightcheck/20260618.1413-eight.nl-raw.json` — brondata van alle checks
- `./flightcheck/20260618.1413-eight.nl-report.md` — menselijk leesbaar rapport
- `./flightcheck/20260618.1413-eight.nl-fix-manifest.json` — work packages voor agents
- `./flightcheck/20260618.1413-eight.nl-agent-jobs/` — prompts per fix-pakket

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

## Programmatic API

```typescript
import { runChecks, runCrawlCheck, runAnalyzeCheck } from "@eightmedia/flightcheck";

const { outputs } = await runChecks({
  startUrl: "https://example.com",
});
```

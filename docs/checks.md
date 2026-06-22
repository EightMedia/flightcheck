# Flightcheck Checks

Flightcheck is built as a modular check system. Each check is a standalone exported
function that can run on its own, be exposed as an API endpoint, or be orchestrated
together by the CLI.

## Available checks

| ID | Status | Description |
| --- | --- | --- |
| `crawl` | implemented | Crawl pages and collect SEO, metadata, tracking, and security data |
| `analyze` | implemented | Turn crawl JSON into an actionable Markdown TODO report |
| `security-headers` | implemented | Verify HTTP security headers (CSP, HSTS, etc.) |
| `dns` | implemented | Verify DNS records, SPF/DMARC, and domain ownership signals |
| `robots-txt` | implemented | Report robots.txt presence, sitemap directives, and crawl blocks |
| `sitemap` | implemented | Verify sitemap exists and exactly matches crawled URLs (same hostname and path; follows sitemap index files; runs after crawl; seeds crawl with sitemap URLs) |
| `lighthouse` | planned | Lighthouse performance, accessibility, and best-practices audits |
| `a11y-axe` | planned | WCAG accessibility via axe-core + Playwright (sampled URLs) |
| `performance` | planned | Core Web Vitals + performance score (optional; replaces lighthouse) |

### Crawl check groups (Tier 1)

When crawling, these optional groups extend per-page extraction:

| Group | Status | Description |
| --- | --- | --- |
| `images` | implemented | Image alt text issues (missing, empty, generic); filenames from `src`/`srcset`/`<picture>` |
| `a11y-static` | implemented | Static accessibility hints (headings, labels, lang, tabindex) |

Use `--only images,a11y-static` or include them in the default crawl groups.

See `docs/qc-checks-plan.md` for the full tiered roadmap:

- **Tier 0/1** — crawl + fetch (SEO, headers, DNS, links, robots, sitemap — no browser)
- **Tier 2** — `a11y-axe` on 3–5 sampled URLs
- **Tier 3** — optional `performance` (Lighthouse or PageSpeed API)

## Programmatic usage

Import from the package root or the checks subpath:

```typescript
import { runChecks, runCrawlCheck, runAnalyzeCheck, listChecks } from "@eightmedia/flightcheck";
// or
import { runCheck, planCheckWaves } from "@eightmedia/flightcheck/checks";
```

Run the default pipeline (all implemented checks):

```typescript
const { outputs, results } = await runChecks({
  startUrl: "https://example.com",
  crawl: { maxPages: 100 },
  analyze: { errorsOnly: false },
});
```

Default checks: `crawl`, `security-headers`, `dns`, `robots-txt`, `sitemap`, `analyze`.

Run a single check:

```typescript
const crawl = await runCrawlCheck({ startUrl: "https://example.com" });
const report = await runAnalyzeCheck({ records: crawl.records });
```

Run independent Tier 1 checks in parallel:

```typescript
await runChecks({
  startUrl: "https://example.com",
  checks: ["crawl", "security-headers", "dns", "robots-txt", "sitemap", "analyze"],
  parallel: true,
});
```

Pure analysis helpers (no network) are also exported for tests and API use:

```typescript
import {
  analyzeSecurityHeaders,
  analyzeRobotsTxt,
  analyzeDnsRecords,
  analyzeSitemapCompare,
} from "@eightmedia/flightcheck/checks";
```

Wave planning:

- Wave 1 (parallel-capable): `crawl`, `lighthouse`, `security-headers`, `dns`, `robots-txt`
- Wave 2 (after crawl): `sitemap`
- Wave 3: `analyze` (uses crawl output when available)

## CLI

```bash
pnpm run flightcheck -- https://example.com
pnpm run flightcheck -- https://example.com --parallel
pnpm run flightcheck -- https://example.com --checks crawl,analyze --parallel
pnpm run flightcheck -- https://example.com --checks crawl --json-only
```

By default, `flightcheck` runs all implemented checks including sitemap validation. When the
start URL returns an HTTP redirect (for example apex → www), flightcheck automatically
switches to **redirect-only mode**: it validates the redirect and skips crawl, sitemap,
robots.txt, and security-headers checks. The redirect check also probes the alternate host
(apex ↔ www): the non-canonical host must permanently redirect to the canonical host implied
by the start URL (or its redirect target). Use `--checks crawl` to force a full crawl anyway.

Use `--checks` to run a subset. Add `--parallel` to run wave 1 checks concurrently.

## Adding a new check

1. Add the check ID to `CHECK_IDS` in `src/checks/types.ts`.
2. Implement `runYourCheck()` in `src/checks/your-check.ts`.
3. Register it in `src/checks/registry.ts` with `implemented: true`.
4. Export it from `src/checks/index.ts`.
5. Update `planCheckWaves()` if the check has special ordering rules.

Each check should:

- Accept typed input options
- Return typed result data
- Avoid coupling to CLI or filesystem when possible (allow in-memory results for API use)

## API endpoint mapping

In a consuming project, map checks to endpoints:

- `POST /checks/crawl` → `runCrawlCheck`
- `POST /checks/analyze` → `runAnalyzeCheck`
- `POST /checks/run` → `runChecks`
- `GET /checks` → `listChecks`

This keeps one check per route and makes it straightforward to run checks in separate
workers or threads.

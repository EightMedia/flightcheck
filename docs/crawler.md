# Flightcheck Crawler

This crawler collects per-URL verification data for SEO, metadata, tracking, and icons.

## Purpose

- Crawl from a start URL; sitemap URLs are added as extra seeds by default so all pages from the sitemap are visited.
- Write incremental JSON output after each processed URL.
- Deduplicate on URL without query/hash.
- Exclude by URL and pathname.
- Safe throttling via concurrency, delay, and burst delay.

## CLI usage

```bash
pnpm run flightcheck -- https://example.com
```

By default, flightcheck writes crawl JSON plus a structured analyze report to `./flightcheck/`,
with filenames based on timestamp and hostname, for example:

- `./flightcheck/20260618.1413-example.com-raw.json`
- `./flightcheck/20260618.1413-example.com-report.json`
- `./flightcheck/20260618.1413-example.com-report.md`

Use `--json-only` to skip the analyze report.

Key flags:

- `--output <file>` default `{timestamp}-{hostname}-raw.json` in `./flightcheck/`
- `--report <file>` default `{timestamp}-{hostname}-report.md` in `./flightcheck/`
  (paired `*-report.json` is written next to it)
- `--json-only` write crawl JSON only; with `--json-only`, default checks fall back to `crawl` only
- `--errors-only` include only critical/error findings in the Markdown report
- `--checks <ids>` comma-separated checks; default: all implemented checks (`crawl`, `security-headers`, `dns`, `robots-txt`, `sitemap`, `analyze`)
- `--parallel` run independent checks in the same wave concurrently
- `--max-pages <n>` (default **100**) — hard crawl budget with smart URL selection (see below)
- `--delay-ms <n>`
- `--timeout-ms <n>`
- `--concurrency <n>`
- `--burst-delay-ms <n>`
- `--sitemap-start` (legacy) limits initial seeds to sitemap URLs plus the start URL; by default sitemap URLs are already added to the crawl queue
- `--sitemap-url <url>`
- `--exclude <pattern1,pattern2>` (repeatable)
- `--respect-robots-txt`
- `--quiet` (suppress Crawlee info/statistics logs; warnings and errors only)
- `--only <groups>` run only these check groups (comma-separated)
- `--skip <groups>` skip these check groups (comma-separated)
- `--reveal-secrets` show full secret values instead of masked

Examples:

```bash
pnpm run flightcheck -- https://example.com --max-pages 200 --concurrency 5 --delay-ms 100
pnpm run flightcheck -- https://example.com --sitemap-start
pnpm run flightcheck -- https://example.com --exclude "/search,/preview"
pnpm run flightcheck -- https://example.com --respect-robots-txt
pnpm run flightcheck -- https://example.com --quiet
pnpm run flightcheck -- https://example.com --only security
pnpm run flightcheck -- https://example.com --skip tracking,social
pnpm run flightcheck -- https://example.com --only security --reveal-secrets
```

## Check groups

Extraction is split into named groups. All groups run by default; with `--only` you run one or a
few, with `--skip` you exclude groups. `--only` and `--skip` cannot be used together.

- `meta` — title, h1, description, robots, template, metaTitle, charset, language,
  viewport, doctype, canonical, color-scheme, theme-color, main landmark count.
- `icons` — favicon and icons.
- `social` — Open Graph and Twitter metadata.
- `tracking` — GTM, GA4, UA, Matomo, Facebook Pixel, Plausible.
- `stack` — technology fingerprints via curated rules (see [stack.md](./stack.md)).
- `security` — scan for leaked API keys and secrets (see below).
- `images` — extracts image-alt issues to `images.issues` (missing-alt,
  empty-alt, generic-alt).
- `a11y-static` — static accessibility checks to `a11yStatic.issues`
  (heading-skip, multiple-h1, missing-lang, unlabeled-input, positive-tabindex).

### Sitemap parsing

`sitemap.xml` can be a **sitemap index** (`<sitemapindex>`) that points to child sitemap files
via nested `<loc>` entries, or a **urlset** with page URLs. The crawler follows sitemap
index files recursively and treats apex and `www` hostnames as the same site (so
`https://example.com/sitemap.xml` can discover URLs on `https://www.example.com/`).

The `security` group scans both page HTML and linked same-origin JavaScript files (`<script src>`)
for leaked API keys and secrets. Shared bundles are cached per URL and fetched only once.
Findings get a severity:

- `critical` — should never be in client code (AWS keys, Stripe secret keys, GitHub
  tokens, private-key blocks, generic `secret`/`password` assignments).
- `review` — normal in client code but should be domain-/referrer-restricted
  (Google API keys, Stripe publishable keys, generic `apiKey`/`token`).

The providers/patterns are: google-api-key (`google`), aws-access-key-id (`aws`),
stripe-secret-key and stripe-publishable-key (`stripe`), github-token (`github`),
private-key, generic-secret and generic-api-key (`generic`).

Secret values are masked by default (`AIzaSy…BC0Y`). The summary then shows a hint to
re-run with `--reveal-secrets` for full values.

When a group is skipped, the corresponding fields stay empty; the output structure never changes.

## Output schema

Each record contains:

- URL and status
- H1/title/meta fields, including `template` (from `meta[name="template"]`) and `metaTitle`
- `mainCount` (number of `<main>` elements, `null` when meta group is skipped)
- canonical/favicon/icons
- OG and Twitter metadata
- tracking detection (GTM, GA4, UA, Matomo, Facebook Pixel, Plausible)
- `stack.detections` — technology fingerprints per page (aggregated in analyze)
- `security` with `secrets` (found keys/secrets) and `scannedAssets` (number of
  scanned JS files)
- `images.issues` — image-alt issues (only when the `images` group runs)
- `a11yStatic.issues` — static a11y findings (only when the `a11y-static` group runs)
- optional `note` and `error`

Text fields are always filled with a string — no `undefined` or `null`.

Each `secrets` finding contains `type`, `provider`, `severity` (`critical` or
`review`), `masked` (masked or — with `--reveal-secrets` — full value) and
`source` (`html` or the URL of the JS file). The closing summary contains
`secretsFound` (total number of findings) and, with masked output and findings, a `hint`.

## Architecture

The CLI runs via the checks layer (`runChecks` in `src/checks/runner.ts`), which drives the
crawler; `src/cli.ts` no longer calls `runCrawler` directly.
The checks layer plans checks in waves and delivers crawl and analyze output.

- Checks layer: `src/checks/runner.ts`, `src/checks/crawl.ts`, `src/checks/types.ts`
- Crawl layer: `src/crawler/runCrawler.ts`
- Extract layer: `src/crawler/extractors.ts`, `src/crawler/tier1Extractors.ts`,
  `src/crawler/tracking.ts`, `src/crawler/secrets.ts` and `src/crawler/stack.ts`
- Report layer: `src/crawler/reporter.ts`

Additionally:

- URL normalization and excludes: `src/crawler/urlUtils.ts`
- Sitemap parsing: `src/crawler/sitemap.ts`
- CLI parsing: `src/cli.ts`

## Behavior

- Only internal links are crawled. Links are discovered via `extractInternalLinks` and added to the queue; Crawlee's `enqueueLinks` is intentionally not used.
- Sitemap URLs are added to the crawl queue by default so pages from `sitemap.xml` are visited even when they are not reachable via internal links.
- `--max-pages` (default **100**) is the hard stop (`maxRequestsPerCrawl`). The crawl stops once this count is processed, even if unvisited links remain. Raise `--max-pages` (for example `1000` or higher) when you need broader coverage of a large site.

### Smart page selection

Large sitemaps often list thousands of archive detail URLs. Selection is based on **URL-tree shape**, not slug names (so `/stories`, `/nieuws`, or `/whatever` all work the same):

1. Build a path tree from known URLs (sitemap seeds and later discoveries)
2. Treat a path as a **list parent** when it has many direct children that are mostly **leaves** (no further subpages) — typical archive indexes
3. Prefer **home**, other **structural** shallow pages, and those **list** indexes
4. Under each list parent, take only a **round-robin sample** of leaf URLs until `--max-pages` is filled

Seed order follows that ranking (FIFO). Structural links discovered from HTML are pushed to the front of the queue (`forefront`); leaf URLs under list parents are capped so one archive cannot flood the budget.

Selection lives in `src/crawler/smartPageSelection.ts`.
- Query parameters and hashes do not count toward URL identity.
- Non-HTML responses are reported with `note`.
- Links to files with a known non-HTML extension (such as `.pdf`, `.zip`, images, video, fonts) are not added to the queue, so Crawlee does not generate unnecessary retries and errors.
- With `--respect-robots-txt`, URLs excluded by `robots.txt` are skipped.
- After each URL, output is written atomically.
- On `SIGINT`, the crawl stops gracefully while preserving partial output.
- Crawlee request-queue files go under `.flightcheckStorage/<run-hash>/` (not the generic
  `storage/` folder). That subdirectory is deleted when the crawl finishes, so a second
  concurrent run keeps its own files until it completes.

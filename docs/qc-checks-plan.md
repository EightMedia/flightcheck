# QC Checks Implementation Plan

Plan to extend Flightcheck into a full quality-control tool for delivered and maintained
sites. Covers hreflang, robots.txt, stack detection, sitemap validation, legal pages,
image alt text, broken links, accessibility, security headers, DNS, and optional
performance auditing.

**Status:** in progress — Phase 1 shipped, Phase 2 mostly shipped  
**Last updated:** 2026-06-23

---

## Goal

Add the checks below as modular, exportable functions (see `docs/checks.md`) so they can:

- Run from the CLI (`pnpm run flightcheck`)
- Run independently via API endpoints in a consuming project
- Execute in parallel where dependencies allow

Each check produces structured JSON output and feeds into the Markdown TODO report via
`analyze`.

---

## Tiered audit strategy

Lighthouse is powerful but heavy (~30s+ per URL, requires Chrome). Most of its **SEO**
and **best-practices** signal is static HTML analysis — which Flightcheck already does
during crawl. Running Lighthouse on every page (or even as the primary a11y engine) is
the wrong default.

Instead, use four tiers:

| Tier | Engine | Chrome? | Covers |
| --- | --- | --- | --- |
| **0** | Crawl + analyze (existing) | No | Meta, OG, tracking, secrets, main landmark |
| **1** | Fetch + cheerio (implemented) | No | SEO depth, headers, DNS, links, robots, sitemap, legal, stack, static a11y hints |
| **2** | axe-core + Playwright (planned) | Yes, 3–5 URLs | Real WCAG a11y (contrast, focus, ARIA in rendered DOM) |
| **3** | Lighthouse or PageSpeed API (optional) | Yes / remote | Performance scores + Core Web Vitals only |

**Design principle:** SEO and best practices default to **Tier 0 + 1**. Accessibility
defaults to **Tier 1 static rules + Tier 2 sampled axe**. Lighthouse is **opt-in** for
client-facing performance reports.

### What each tier replaces from Lighthouse

| Lighthouse category | Flightcheck approach |
| --- | --- |
| **SEO** | Tier 0/1 — crawl meta groups, hreflang, robots, sitemap, structured data (future) |
| **Best practices** | Tier 1 — security headers, HTTPS, mixed content, image alt, deprecated patterns |
| **Accessibility** | Tier 1 static + Tier 2 `@axe-core/playwright` on sampled URLs |
| **Performance** | Tier 3 only — Lighthouse or PageSpeed Insights API on sampled URLs |

### Weight comparison

| Approach | Speed | Chrome? | Best for |
| --- | --- | --- | --- |
| Crawl + custom rules | Fast | No | SEO, metadata, links, infra |
| axe on crawled HTML (jsdom) | Fast | No | Structure-only a11y (partial) |
| `@axe-core/playwright` | ~5–15s × N URLs | Yes | Full a11y on samples |
| Lighthouse | ~30s+ × N URLs | Yes | CWV + performance score |
| PageSpeed Insights API | ~10–20s × N URLs | Remote | CWV without local Chrome |

---

## Current baseline

| Area | Today |
| --- | --- |
| Metadata / SEO | Crawl `meta`, `social`, `icons` groups + analyze report |
| Tracking | GTM, GA4, Matomo, etc. detection |
| Security | Secret scan in HTML + same-origin JS |
| Landmarks | `<main>` count |
| Infra | `robots-txt`, `security-headers`, `dns` checks implemented and reported |
| Sitemap | `sitemap` check implemented — validates and diffs against crawled URLs |
| Standalone checks | `security-headers`, `dns`, `robots-txt`, `sitemap`, `redirect` implemented; `lighthouse` registered but unsupported |

---

## Architecture

### Two integration patterns

**Pattern A — Crawl extensions** (per-page data during crawl)

Best when the check inspects each HTML page:

- hreflang
- image alt (+ static a11y hints: headings, multiple h1, form labels, lang, positive tabindex)
- broken links (internal + optional external)
- stack fingerprints (per-page signals aggregated site-wide)

Add new check groups in `checkGroups.ts`:

```text
meta, icons, social, tracking, security  (existing)
links, images, hreflang, stack, a11y-static (new crawl groups)
```

**Pattern B — Standalone checks** (origin-level or sampled URLs)

Best when the check hits one URL, DNS, or a small URL sample:

- `robots-txt`
- `sitemap`
- `legal-pages`
- `security-headers`
- `dns`
- `a11y-axe` (sampled URLs, Tier 2)
- `performance` (sampled URLs, Tier 3 — optional)

Each gets `src/checks/<id>.ts` + registry entry + analyze report section.

### Execution waves (updated)

```text
Wave 1 (parallel, no browser):
  crawl, robots-txt, security-headers, dns, legal-pages

Wave 2 (after crawl, parallel where possible):
  sitemap (compare with crawledUrls)
  a11y-axe (3–5 sampled URLs via Playwright + axe-core)

Wave 3 (optional, after crawl):
  performance (Lighthouse or PageSpeed API on same URL sample)

Wave 4:
  analyze (merges all check outputs into TODO report)
```

Wave 2 and 3 share a URL sampler (`src/checks/sampleUrls.ts`):

1. Homepage (`startUrl`)
2. One URL per unique `<meta name="template">` value
3. Max 5 URLs (configurable)

### Shared context

Extend `CheckOutputs` in `src/checks/types.ts`:

```typescript
type CheckOutputs = {
  crawl?: CrawlCheckResult;
  analyze?: AnalyzeCheckResult;
  robotsTxt?: RobotsTxtCheckResult;
  sitemap?: SitemapCheckResult;
  legalPages?: LegalPagesCheckResult;
  a11yAxe?: A11yAxeCheckResult;
  performance?: PerformanceCheckResult;
  securityHeaders?: SecurityHeadersCheckResult;
  dns?: DnsCheckResult;
};
```

Crawl result gains optional site-level aggregates:

```typescript
type CrawlCheckResult = {
  records: VerificationRecord[];
  crawledUrls: string[];
  stack?: StackDetectionResult;
  // ...
};
```

---

## Check specifications

### 1. Hreflang (`hreflang` — crawl group)

**Purpose:** Validate multilingual SEO linking.

**Per page, extract:**

- `<link rel="alternate" hreflang="…" href="…">`
- `<html lang="…">` as fallback context

**Rules:**

| Rule | Severity |
| --- | --- |
| Page has hreflang tags but no self-referencing entry | warning |
| `hreflang` value invalid (not BCP 47-ish) | warning |
| Target URL returns non-200 (optional fetch, rate-limited) | error |
| Missing return link (A→B but B→A missing) | error |
| No `x-default` on multilingual sites (≥2 languages detected site-wide) | warning |
| Duplicate `hreflang` for same page | error |

**Output:** `record.hreflang: { tags: HreflangTag[]; issues: HreflangIssue[] }`

**Analyze todos:**

- `Fix hreflang self-reference on page`
- `Add x-default hreflang in site layout`
- `Add return hreflang link: {lang} ↔ {url}`

---

### 2. Robots.txt (`robots-txt` — standalone check) — IMPLEMENTED

**Status:** Implemented in `src/checks/robots-txt.ts` (`runRobotsTxtCheck()`).

**Purpose:** Report robots.txt presence and common misconfigurations.

**Note:** The robots.txt report logic lives in the standalone `src/checks/robots-txt.ts`.
`src/crawler/robots.ts` is separate and only provides `isAllowed()` for `--respect-robots-txt`
crawl behaviour — it is **not** extended by this check.

**Fetch:** `{origin}/robots.txt`

**Rules:**

| Rule | Severity |
| --- | --- |
| robots.txt missing (404) | warning |
| robots.txt not parseable | error |
| `Disallow: /` for `User-agent: *` on production | critical |
| Sitemap directive missing | warning |
| Sitemap URL not reachable | error |
| Crawl-delay extremely high | review |

**Output:**

```typescript
type RobotsTxtCheckResult = {
  url: string;
  status: number | null;
  body?: string;
  sitemapUrls: string[];
  issues: Issue[];
};
```

**Note:** Keep `--respect-robots-txt` as crawl behaviour; this check is **report-only**
by default.

---

### 3. Stack detection (`stack` — crawl group + aggregation) — IMPLEMENTED

**Status:** Implemented — per-page fingerprinting in `src/crawler/stackDetect.ts`,
site-wide aggregation in `src/analyze/stack.ts`.

**Purpose:** Report CMS, framework, and hosting signals for handover docs and debugging.

**Approach:** Heuristic fingerprinting (no Wappalyzer dependency initially). Aggregate
signals across all crawled pages; confidence score per detection.

**Signal sources:**

| Source | Examples |
| --- | --- |
| `<meta name="generator">` | WordPress, Sanity Studio |
| HTML comments / data attributes | `__NEXT_DATA__`, `data-sanity`, `data-nuxt` |
| Script/link paths | `/wp-content/`, `/_next/`, `/@vite/` |
| Response headers (once per origin) | `x-powered-by`, `server`, `x-vercel-id` |
| Cookie names | `__prerender_bypass`, `wp-settings` |
| Existing `<meta name="template">` | Already in crawl |

**Output:**

```typescript
type StackDetectionResult = {
  detections: Array<{
    name: string;
    category: "cms" | "framework" | "hosting" | "analytics" | "other";
    confidence: "high" | "medium" | "low";
    evidence: string[];
  }>;
};
```

**Analyze:** New `## Stack` section (informational, not necessarily todos unless
conflicting signals).

**Future:** Optional `@wappalyzer/wappalyzer-core` if heuristics are insufficient.

---

### 4. Sitemap (`sitemap` — standalone check) — IMPLEMENTED

**Status:** Implemented in `src/checks/sitemap.ts` (`runSitemapCheck()`).

**Purpose:** Verify sitemap exists and matches crawled site.

**Reuse:** `src/crawler/sitemap.ts` → `collectUrlsFromSitemap()`

**Inputs:**

- `startUrl` / origin
- `crawledUrls` from crawl output (normalized, no query/hash)
- Optional `robotsTxt.sitemapUrls` from robots check

**Rules:**

| Rule | Severity |
| --- | --- |
| No sitemap found (robots + `/sitemap.xml` both fail) | error |
| Sitemap URLs not reachable (4xx/5xx) | error |
| In sitemap but not crawled (and not excluded) | warning |
| Crawled but not in sitemap | warning |
| Over N% mismatch | error (configurable threshold, default 10%) |

**Dependency:** Runs in wave 2 after crawl when comparing lists.

---

### 5. Legal pages (`legal-pages` — standalone check)

**Purpose:** Confirm required legal pages exist and are linked.

**Configurable paths (defaults):**

```typescript
const DEFAULT_LEGAL_PATHS = [
  "/privacy", "/privacy-policy", "/privacybeleid",
  "/cookies", "/cookie-policy", "/cookiebeleid",
  "/terms", "/algemene-voorwaarden",
  "/disclaimer",
];
```

**Rules:**

| Rule | Severity |
| --- | --- |
| No privacy page reachable | error |
| No cookie policy (EU/NL sites) | error |
| Linked from footer but 404 | critical |
| Page exists but not linked from any crawled page | warning |

---

### 6. Image alt + static a11y (`images`, `a11y-static` — crawl groups) — IMPLEMENTED

**Status:** Implemented in `src/crawler/tier1Extractors.ts`; output fields `images` and
`a11yStatic` are defined on `VerificationRecord` in `src/crawler/schema.ts`.

**Purpose:** Tier 1 accessibility and SEO — no browser required.

**Image alt (`images` group):**

- `<img>` without `alt` attribute
- `<img alt="">` on non-decorative images
- Generic alt text (`image`, `photo`, filename)

Issue messages include a clickable markdown link `[filename](url)` when the image URL can be
resolved from `src`, `srcset`, `<picture>` / `<source>` elements, or nested `/_next/image?url=…`
proxy URLs.

**Static a11y hints (`a11y-static` group):** implemented rule IDs:

- `heading-skip` — heading hierarchy skips a rank (h1 → h3)
- `multiple-h1` — multiple h1 elements
- `unlabeled-input` — form inputs without associated labels
- `missing-lang` — missing `lang` on `<html>`
- `positive-tabindex` — positive tabindex values

**Decorative image exclusions:**

- `aria-hidden="true"`, `role="presentation"`, ≤2px dimensions

**Output:** `record.images`, `record.a11yStatic: { issues[] }`

**Limitation:** Cannot detect color contrast, focus visibility, or JS-rendered widgets.
Those require Tier 2 axe.

---

### 7. Broken links (`links` — crawl group)

**Purpose:** Find internal broken links and optionally external failures.

**Fetch strategy:**

- Internal: check against crawl status map first; fetch uncached with concurrency limit
- External: optional (`--check-external-links`), HEAD request, timeout 10s, max N per site

**Rules:**

| Rule | Severity |
| --- | --- |
| Internal link → 404/500 | error |
| Internal link → redirect loop | error |
| External link → 4xx/5xx | warning |

---

### 8. Accessibility — axe (`a11y-axe` — standalone check, Tier 2)

**Purpose:** Real WCAG accessibility audit on a small URL sample.

**Why not Lighthouse for a11y:** Lighthouse embeds axe-core but adds performance overhead
and aggregates away detail. Running axe directly via Playwright is faster and gives
better violation output.

**Implementation:** `@axe-core/playwright`

```typescript
import { AxeBuilder } from "@axe-core/playwright";

const results = await new AxeBuilder({ page })
  .withTags(["wcag2a", "wcag2aa", "best-practice"])
  .analyze();
```

**Scope:** Same URL sampler as performance (max 5 URLs).

**Output per URL:**

```typescript
type A11yAxePageResult = {
  url: string;
  violations: Array<{
    id: string;
    impact: "critical" | "serious" | "moderate" | "minor";
    description: string;
    helpUrl: string;
    nodes: Array<{ html: string; target: string[]; failureSummary?: string }>;
  }>;
  passes: number;
  incomplete: number;
};
```

**Thresholds (configurable):**

- Any `critical` violation → error
- Any `serious` violation → warning

**Analyze:** `## Accessibility (axe)` section — group violations by rule ID across
sampled pages; todos reference WCAG rule and affected selector.

**Optional Tier 1 supplement:** Run axe-core against crawled HTML strings via jsdom for
extra coverage on all pages. Disable rules that need computed styles (`color-contrast`,
`link-in-text-block`, `target-size`, etc.). Document as `--a11y-static-axe` experiment;
not required for v1.

---

### 9. Performance (`performance` — standalone check, Tier 3, optional)

**Purpose:** Core Web Vitals and performance scores for client reports. **Not required
for delivery QC** — opt-in via `--checks performance` or `--profile delivery-full`.

**Scope:** Same URL sampler (max 5 URLs).

**Implementation options:**

| Option | Pros | Cons |
| --- | --- | --- |
| `lighthouse` + `chrome-launcher` | Full control, offline | Heavy, needs Chrome |
| PageSpeed Insights API | No local Chrome | API key, rate limits, sends URL to Google |
| `web-vitals` + Playwright | Lightweight CWV only | No full audit categories |

**Recommended default:** PageSpeed Insights API for CI/cloud; local Lighthouse for
offline/dev when Chrome is available.

**Output per URL:**

```typescript
type PerformancePageResult = {
  url: string;
  source: "lighthouse" | "pagespeed-insights";
  scores: { performance: number | null };
  metrics: {
    lcp?: string;
    cls?: string;
    inp?: string;
    ttfb?: string;
    fcp?: string;
  };
  opportunities?: Array<{ id: string; title: string; displayValue?: string }>;
};
```

**Thresholds (configurable):**

- Performance score < 80 → warning
- LCP > 2.5s → warning
- CLS > 0.1 → warning

**Analyze:** `## Performance` section — scores table + top opportunities as todos.

**Note:** Do not duplicate SEO or a11y scores from Lighthouse here; those categories
are covered by Tier 0/1 and `a11y-axe`.

---

### 10. Security headers (`security-headers` — standalone check) — IMPLEMENTED

**Status:** Implemented in `src/checks/security-headers.ts` (`runSecurityHeadersCheck()`).

**Purpose:** Tier 1 best practices — verify HTTP security headers.

**Headers to check:**

| Header | Severity if missing |
| --- | --- |
| `Strict-Transport-Security` | error (if HTTPS) |
| `Content-Security-Policy` | warning |
| `X-Frame-Options` or CSP `frame-ancestors` | warning |
| `X-Content-Type-Options: nosniff` | warning |
| `Referrer-Policy` | review |
| `Permissions-Policy` | review |

Pure fetch — no browser needed.

---

### 11. DNS (`dns` — standalone check) — IMPLEMENTED

**Status:** Implemented in `src/checks/dns.ts` (`runDnsCheck()`).

**Purpose:** Record locations, ownership signals, and email security.

**Queries (Node `dns.promises` + optional `whoiser`):**

| Query | Data |
| --- | --- |
| A / AAAA | IP addresses |
| CNAME | CDN / hosting chain |
| MX / TXT / NS | Mail + SPF/DMARC |
| WHOIS (optional) | Registrar, expiry |

**Geo/locations:** Resolve A records → optional IP geolocation (informational).

**Note:** WHOIS opt-in (`dns: { whois: true }`).

---

### 12. Redirect (`redirect` — standalone check) — IMPLEMENTED

**Status:** Implemented in `src/checks/redirect.ts`. Probes the start URL (and www/non-www
alias), and when the origin is a pure redirect it drives **redirect-only mode** — short-circuiting
the pipeline to a reduced check set instead of a full crawl/analyze. Output feeds the
"Domain redirect" analyze section.

---

## Analyze report integration

Extend `src/analyze/report.ts` to consume a unified `FlightcheckReport` shape:

```typescript
type FlightcheckReport = {
  crawl: VerificationRecord[];
  robotsTxt?: RobotsTxtCheckResult;
  sitemap?: SitemapCheckResult;
  legalPages?: LegalPagesCheckResult;
  a11yAxe?: A11yAxeCheckResult;
  performance?: PerformanceCheckResult;
  securityHeaders?: SecurityHeadersCheckResult;
  dns?: DnsCheckResult;
  stack?: StackDetectionResult;
};
```

The **Issues summary** and Tier 1 infra report sections (redirect, DNS, security headers,
robots.txt, sitemap) are implemented in `src/analyze/reportTier1.ts` and wired into the main
report via `src/analyze/report.ts`.

Report sections (top to bottom):

1. Summary (pages analyzed, fix scopes, **Issues summary** by category: infra, SEO, a11y, best practices, performance)
2. Security (secrets — existing)
3. DNS (infra overview)
4. Security headers
5. Stack (informational)
6. Robots.txt + sitemap
7. Legal pages
8. Accessibility (axe) — Tier 2
9. Performance — Tier 3, if run
10. Fix site-wide
11. Fix in templates
12. Fix per page (hreflang, images, static a11y, broken links)
13. Issue coverage

---

## Implementation phases

### Phase 1 — Tier 1 quick wins (1–2 weeks) — SHIPPED

No browser required. Covers most SEO + best practices.

| Task | Type | Files | Status |
| --- | --- | --- | --- |
| Security headers check | standalone | `src/checks/security-headers.ts` | done |
| Robots.txt check | standalone | `src/checks/robots-txt.ts` | done |
| DNS check | standalone | `src/checks/dns.ts` | done |
| Image alt + static a11y crawl groups | crawl | `src/crawler/tier1Extractors.ts`, `schema.ts` | done |
| Register checks + wave plan | infra | `types.ts`, `registry.ts`, `runner.ts` | done |
| Analyze sections | report | `src/analyze/report.ts`, `src/analyze/reportTier1.ts` | done |
| Tests + docs | | `*.test.ts`, `docs/checks.md` | done |

**Deliverable:**

```bash
pnpm run flightcheck -- https://example.com --checks crawl,security-headers,dns,robots-txt --parallel
```

---

### Phase 2 — Crawl depth + infra (2–3 weeks) — MOSTLY SHIPPED

| Task | Type | Files | Status |
| --- | --- | --- | --- |
| Stack detection | crawl + aggregate | `src/crawler/stackDetect.ts`, `src/analyze/stack.ts` | done |
| Sitemap compare | standalone | `src/checks/sitemap.ts` | done |
| Image alt + static a11y | crawl | `src/crawler/tier1Extractors.ts` | done |
| Broken links group | crawl | `src/crawler/links.ts` | not implemented |
| Hreflang group | crawl | `src/crawler/hreflang.ts` | not implemented |
| Legal pages | standalone | `src/checks/legal-pages.ts` | not implemented |
| URL sampler (shared) | util | `src/checks/sampleUrls.ts` | not implemented |
| Analyze integration | report | `src/analyze/report.ts` | done |

**Deliverable:** Full metadata + link + infra report without any browser.

---

### Phase 3 — Tier 2 accessibility (1 week)

| Task | Notes |
| --- | --- |
| Add `@axe-core/playwright`, `playwright` | Document browser install (`pnpm exec playwright install chromium`) |
| `runA11yAxeCheck()` | Uses shared URL sampler |
| Analyze a11y section | Group violations by rule; WCAG-linked todos |
| Smoke test | Mark `@slow`, skip in default CI |

**Deliverable:**

```bash
pnpm run flightcheck -- https://example.com --checks crawl,a11y-axe --parallel
```

---

### Phase 4 — Tier 3 performance, optional (1 week)

| Task | Notes |
| --- | --- |
| `runPerformanceCheck()` | Lighthouse or PageSpeed Insights adapter pattern |
| `--performance-provider lighthouse\|pagespeed` | Default `pagespeed` in CI, `lighthouse` locally |
| Analyze performance section | CWV metrics + opportunities only |
| Deprecate standalone `lighthouse` check ID | Rename registry entry to `performance` (not yet done — `lighthouse` is still the registered id with `implemented: false` in `src/checks/registry.ts`) |

**Deliverable:**

```bash
pnpm run flightcheck -- https://example.com --profile delivery-full
# runs crawl + tier 1 + a11y-axe + performance on sampled URLs
```

---

### Phase 5 — Polish & maintenance (ongoing)

- Baseline diff (compare to last approved JSON)
- External link checking toggle
- Config profiles: `delivery`, `delivery-full`, `maintenance`
- Per-client `.flightcheck.json` (legal paths, thresholds)
- API endpoint wiring guide for consuming project

---

## Profiles (CLI)

| Profile | Checks | Browser? |
| --- | --- | --- |
| `default` | crawl + security-headers + dns + robots-txt + sitemap + analyze (`DEFAULT_CHECK_IDS` in `src/checks/types.ts`) | No |
| `delivery` | crawl + all Tier 1 + sitemap + legal + a11y-axe + analyze | Yes, 3–5 URLs |
| `delivery-full` | `delivery` + performance | Yes, 3–5 URLs |
| `maintenance` | crawl + analyze + baseline-diff (future) | No |

```bash
pnpm run flightcheck -- https://example.com --profile delivery
```

---

## New check IDs (registry)

Currently registered in `src/checks/registry.ts`:

```text
crawl            (implemented)
analyze          (implemented)
security-headers (implemented)
dns              (implemented)
robots-txt       (implemented)
sitemap          (implemented)
lighthouse       (registered, implemented: false — NOT yet renamed to performance)
```

Still to add / rename:

```text
legal-pages
a11y-axe
performance   (optional Tier 3; planned to replace lighthouse — rename not done yet)
```

Crawl groups:

```text
links, images, hreflang, stack, a11y-static
```

Updated wave plan:

```typescript
// Wave 1
["crawl", "robots-txt", "security-headers", "dns", "legal-pages"]

// Wave 2 (after crawl)
["sitemap", "a11y-axe"]

// Wave 3 (optional)
["performance"]

// Wave 4
["analyze"]
```

Still to do in `src/checks/types.ts` — rename `lighthouse` → `performance` (not yet done),
add `a11y-axe` and `legal-pages`. (`robots-txt` and `sitemap` are already present.)

---

## Dependencies (estimated)

| Package | Used by | Tier | Notes |
| --- | --- | --- | --- |
| None extra | security-headers, robots, dns, links, hreflang | 1 | fetch + cheerio |
| `@axe-core/playwright` | a11y-axe | 2 | Real a11y on sampled URLs |
| `playwright` | a11y-axe, performance (optional) | 2–3 | `playwright install chromium` |
| `lighthouse` + `chrome-launcher` | performance (local adapter) | 3 | Optional, heavy |
| PageSpeed Insights API | performance (remote adapter) | 3 | `GOOGLE_PAGESPEED_API_KEY` |
| `whoiser` | dns (optional) | 1 | WHOIS opt-in |

**Not recommended as dependencies:**

- Full Lighthouse for SEO/a11y — overlap with Tier 0/1/2
- `@capgo/seo-checker` — useful reference for rule ideas; crawl already covers live sites
- Wappalyzer — defer; heuristics sufficient initially

---

## Testing strategy

| Layer | Approach |
| --- | --- |
| Pure extractors | vitest + HTML fixtures |
| Standalone checks (Tier 1) | vitest + mocked `fetch` / DNS |
| Sitemap compare | Fixture XML + crawl URL sets |
| a11y-axe (Tier 2) | Smoke test on local HTML fixture server, `@slow` |
| performance (Tier 3) | Mock PageSpeed API response; Lighthouse smoke `@slow` |
| Integration | Golden-file report snapshot for eight.nl fixture |

---

## Open decisions

1. **External links** — opt-in (recommended).
2. **Performance provider** — PageSpeed API default in CI; Lighthouse for local dev (recommended).
3. **WHOIS** — opt-in (recommended).
4. **Legal page paths** — per-client `.flightcheck.json` (recommended).
5. **axe on all crawled HTML via jsdom** — experiment later; Tier 2 sample is sufficient for v1.
6. **Stack detection** — heuristics first; Wappalyzer as optional plugin later.

---

## Success criteria

A site like `https://eight.nl` run with `--profile delivery` should report:

- Missing Twitter/OG tags (Tier 0 — existing)
- robots.txt and sitemap status (Tier 1)
- Sitemap vs crawl diff (Tier 1)
- Privacy/cookie pages present and linked (Tier 1)
- Image alt gaps + static a11y hints on all pages (Tier 1)
- Broken internal links (Tier 1)
- Detected stack — Next.js + Sanity + Vercel (Tier 1)
- Security header gaps (Tier 1)
- DNS / SPF / DMARC overview (Tier 1)
- axe WCAG violations on homepage + template samples (Tier 2)
- Core Web Vitals on homepage + template samples (Tier 3, `--profile delivery-full` only)
- Single Markdown report ready for an AI agent or client handover doc

Without `--profile delivery-full`, the run completes **without Chrome** and still covers
the majority of delivery QC.

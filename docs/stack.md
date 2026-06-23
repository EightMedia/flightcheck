# Stack detection

Flightcheck fingerprints the technology stack of a crawled site for handover docs and agent
routing. Results appear as an informational `## Stack` section in the analyze report.

Detection uses **curated flightcheck rules** in `src/crawler/stackDetect.ts` — not the full
Wappalyzer / webappanalyzer database. Rules only fire on strong signals (script URLs, distinctive
HTML markers, response headers, DNS). This avoids false positives from loose substring matches.

## Categories

| Category | Examples |
| --- | --- |
| Platform | PHP, Node.js, Ruby on Rails, Django, ASP.NET |
| Framework | Next.js, Nuxt, Vue, Angular, Astro, Gatsby, Remix, SvelteKit |
| CMS | WordPress, Sanity, Contentful, Storyblok, Shopify, Drupal, Webflow, Prismic |
| Search | Algolia, Meilisearch, Typesense |
| Hosting | Vercel, Netlify |
| CDN | Cloudflare, AWS CloudFront |

Tracking (Google Tag Manager, GA4, Universal Analytics, Facebook Pixel, Matomo, Plausible) is
detected separately by the `tracking` crawl group and shown under **Tracking (flightcheck crawl)**
in the stack section.

## Signal sources

| Source | When collected | Module |
| --- | --- | --- |
| HTML crawl | `stack` group (default on) | `detectStackFromHtml()` |
| Response headers | `security-headers` check | `detectStackFromHeaders()` |
| DNS records | `dns` check | `detectStackFromDns()` |
| Tracking IDs | `tracking` crawl group | `extractTracking()` in `src/crawler/tracking.ts` |

Without a headless browser, stack detection is limited to static HTML and infrastructure signals.
Late-loaded scripts (GTM after consent, client-only frameworks) may be missed unless they appear in
the initial HTML.

## Crawl group

The `stack` group runs during crawl by default:

```bash
pnpm run flightcheck -- https://example.com --skip stack
```

Per-page detections are stored as `stack.detections` on each crawl record. Detections are tagged
with `detector: "flightcheck-v1"` so older crawl JSON from the webappanalyzer era is ignored
during analyze.

## Analyze output

```markdown
## Stack

### Framework
- **Next.js** (high, site-wide)
  - html: `data-next-head`

### Platform
- **Node.js** (medium, site-wide)
  - implied by Next.js

### Hosting
- **Vercel** (high, origin)
  - header: x-vercel-id

### Tracking (flightcheck crawl)
- Tag managers:
  - Google Tag Manager: `GTM-XXXX`
```

Run with infra checks for the fullest picture:

```bash
pnpm run flightcheck -- https://example.com --checks crawl,security-headers,dns,robots-txt,analyze --parallel
```

## Architecture

```text
src/crawler/stackDetect.ts   (curated fingerprint rules)
        ↓
src/crawler/stack.ts         (re-exports detect helpers)
        ↓
src/crawler/runCrawler.ts    (per-page detect during crawl)
        ↓
src/analyze/stack.ts         (aggregate site-wide + analyze report)
```

## Adding fingerprints

Add a rule to `HTML_RULES`, `HEADER_RULES`, or `DNS_RULES` in `src/crawler/stackDetect.ts`.
Each rule must match on a **specific** signal — never run loose patterns against the full HTML
document.

Use `IMPLIED` for safe parent technology inference (e.g. Next.js → Node.js).
Use `EXCLUDES` to suppress redundant detections (e.g. Next.js excludes generic React).

Add tests in `src/crawler/stackDetect.test.ts`.

## Legacy webappanalyzer data

The `data/webappanalyzer/` directory and `pnpm run sync:webappanalyzer` script remain in the repo
but are **no longer used** for stack detection. They may be removed in a future cleanup.

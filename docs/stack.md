# Stack detection

Flightcheck fingerprints the technology stack of a crawled site for handover docs and
debugging. Results appear as an informational `## Stack` section in the analyze report.

Detection uses the community-maintained [enthec/webappanalyzer](https://github.com/enthec/webappanalyzer)
fingerprint database (~7,500 technologies). Flightcheck is licensed under **GPL-3.0**
(see repository root `LICENSE`).

## Fingerprint data

| Item | Location |
| --- | --- |
| Technologies | `data/webappanalyzer/technologies.json` |
| Categories | `data/webappanalyzer/categories.json` |
| Attribution | `data/webappanalyzer/LICENSE` |

Refresh fingerprints:

```bash
pnpm run sync:webappanalyzer
```

Fingerprint JSON is derived from enthec/webappanalyzer and shipped as part of flightcheck
under the same GPL-3.0 license.

## Signal sources

| Source | When collected | Wappalyzer fields used |
| --- | --- | --- |
| HTML crawl | `stack` group (default on) | `html`, `text`, `scripts`, `scriptSrc`, `meta`, `dom`, `url` |
| Response headers | `security-headers` check | `headers` |
| DNS records | `dns` check | `dns` |
| robots.txt | `robots-txt` check | `robots` |
| Tracking IDs | `tracking` crawl group | Shown separately (GTM, GA4, Matomo, etc.) |

### Tier 1 limits

Without a headless browser, these Wappalyzer fields are **not** used today:

- `js` — JavaScript globals (needs script execution)
- `cookies` — response cookies (not collected yet)
- `xhr` — network requests during page load
- `probe` — extra HTTP probes
- `css` — stylesheet content rules

Late-loaded tags (GTM after consent, lazy analytics) may be missed unless they appear in
static HTML.

## Crawl group

The `stack` group runs during crawl by default:

```bash
pnpm run flightcheck -- https://example.com --skip stack
```

Per-page detections are stored as `stack.detections` on each crawl record.

## Analyze output

Categories come from webappanalyzer (CMS, PaaS, Analytics, JavaScript frameworks, etc.).

```markdown
## Stack

### JavaScript frameworks
- **Next.js** (high, site-wide)
  - html: `__NEXT_DATA__`

### PaaS
- **Vercel** (high, origin)
  - headers: `iad1::abc-123`

### Tracking (flightcheck crawl)
- Tag managers:
  - Google Tag Manager: `GTM-XXXX`
```

Run with infra checks for the fullest picture:

```bash
pnpm run flightcheck -- https://example.com --checks crawl,security-headers,dns,robots-txt,analyze --parallel
```

## Why not the Wappalyzer npm package?

| Factor | `wapalyzer-core` npm | Flightcheck approach |
| --- | --- | --- |
| Fingerprints | Frozen 2023 snapshot in npm | Synced from enthec (actively maintained) |
| Crawl model | Expects browser for full coverage | Tier 1 HTML + headers + DNS |
| Dependencies | Bundled engine + data | Vendored data, zero runtime deps |

The npm `wapalyzer-core` package points at enthec for updates but is not refreshed on npm.
We sync JSON directly and run our own matcher.

## Architecture

```text
data/webappanalyzer/*.json
        ↓
src/crawler/webappanalyzer/engine.ts   (pattern matching)
        ↓
src/crawler/stack.ts                   (per-page detect during crawl)
        ↓
src/analyze/stack.ts                   (aggregate site-wide + analyze report)
```

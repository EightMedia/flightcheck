# Flightcheck Security Scan — Design

Date: 2026-06-15
Status: Approved (pending spec review)

## Goal

Add a security scan to Flightcheck that detects exposed API keys and secrets in a
site's client-side code (page HTML + same-origin JavaScript), and introduce a
check-group system so any scan can be opted out of or run on its own (e.g. run
*only* the security scan).

## Motivation

A Google API key was found publicly exposed but its owning project was unknown.
Grepping local sources missed it because such keys typically live in deployed JS
bundles, not inline HTML. Flightcheck already crawls sites pre-launch, so it is the
natural place to catch exposed secrets before they go live.

## 1. Check-group system (toggle backbone)

Today every page receives the same full extraction with no way to toggle parts.
We introduce named check groups so extraction is selectable.

New module `src/crawler/checkGroups.ts`:

- Canonical groups: `meta`, `icons`, `social`, `tracking`, `security`.
  - `meta` — title, h1, description, robots, charset, language, viewport, doctype,
    canonical, colorScheme, themeColor.
  - `icons` — favicon + icons array.
  - `social` — og + twitter.
  - `tracking` — GTM, GA4, UA, Matomo, Facebook Pixel, Plausible.
  - `security` — API-key / secret scan (new).
- `resolveActiveGroups({ only, skip }): Set<CheckGroup>`:
  - `--only` and `--skip` are mutually exclusive → error if both supplied.
  - Unknown group name → error listing the valid names.
  - Neither flag → all groups active (unchanged default behavior).

CLI (`cli.ts`) gains `--only <groups>` and `--skip <groups>` (comma-separated).
The resolved active set flows through `RunCrawlerOptions` into the extractor.

`extractVerificationRecord(html, url, status, contentType, activeGroups)` runs each
extraction block conditionally. Skipped groups keep their empty defaults from
`createEmptyVerificationRecord`, so the output shape never changes — skipped fields
are simply blank. The existing analyzer keeps working without modification.

Usage:

```
flightcheck https://site.com --only security
flightcheck https://site.com --skip tracking,social
```

## 2. Secret scanner

New module `src/crawler/secrets.ts`, pure and synchronous over a text blob.

- `scanText(text, source): SecretFinding[]` runs a pattern table.
- Patterns (broad set), classified by **severity**:
  - **critical** — must never appear in client code:
    - AWS access key `AKIA[0-9A-Z]{16}`
    - Stripe secret key `sk_live_[0-9a-zA-Z]{24,}`
    - GitHub tokens `gh[posru]_[0-9A-Za-z]{36,}`
    - Private key blocks `-----BEGIN ... PRIVATE KEY-----`
    - Generic `secret`/`password` assignments with real-looking values
  - **review** — normal client-side, but should be domain/referrer restricted:
    - Google API key `AIzaSy[0-9A-Za-z_-]{33}`
    - Firebase config blocks
    - Stripe publishable key `pk_live_[0-9a-zA-Z]{24,}`
    - Generic `apiKey`/`token` assignments

  Rationale: a Google `AIzaSy…` key in client JS is expected (Maps/Firebase) and
  only needs referrer restrictions; flagging it as a critical breach would cry wolf.
  It is reported as "review" so the user can verify restrictions.

- `SecretFinding`: `{ type, provider, severity, masked, source }`.
  - `masked` shows first 6 + last 4 characters, e.g. `AIzaSy…EBC0Y`.
  - Dedupe by `type:masked`.

## 3. Where it runs (HTML + same-origin JS)

Security needs network access, so it lives in `runCrawler.ts`, not the synchronous
extractor.

- New module `src/crawler/jsAssets.ts`: `extractSameOriginScripts(html, url, origin)`
  returns the list of same-origin `<script src>` URLs.
- In the crawler request handler, when `security` is active:
  1. Scan the page HTML with `scanText(html, "html")`.
  2. Fetch each same-origin script and scan it with `scanText(js, <jsUrl>)`.
- A module-level cache (`Map<jsUrl, SecretFinding[]>`) ensures shared bundles are
  fetched and scanned once across all pages.
- Fetches use the existing `timeoutMs`. A failed asset fetch is recorded as a
  per-asset note and never crashes the crawl.
- Findings attach to `record.security.secrets`, each tagged with `source` =
  `"html"` or the originating JS URL.

## 4. Output shape

`VerificationRecord` gains:

```ts
security: {
  secrets: Array<{
    type: string;
    provider: string;
    severity: "critical" | "review";
    masked: string;       // or full value when --reveal-secrets is set
    source: string;       // "html" or the JS asset URL
  }>;
  scannedAssets: number;  // count of JS files fetched and scanned
}
```

`--reveal-secrets` CLI flag (default off): stores the full unmasked value instead of
`masked`. Off by default so the report file is not itself a secret-leak vector.

When the crawl finds secrets and `--reveal-secrets` was not used, the final CLI
summary JSON includes a `hint`:
`"N secret(s) found (masked). Re-run with --reveal-secrets to show full values."`
The hint appears only when there are findings AND values are masked.

## 5. Analyzer report

`analyze.ts`:

- Extend the Zod `recordSchema` with the `security` block.
- `buildMarkdown` gains a **"🔑 Security" section at the top** (above the priority
  overview) listing every page with findings — critical first, grouped by severity,
  showing provider + masked value + source.
- The same masked-mode hint is shown at the top of the Security section when
  findings exist and values are masked.
- Under `--errors-only`, a page is kept when it has security findings even if it has
  no missing meta fields.

## 6. Testing

The project has no test runner wired yet. Verification will be pragmatic:

- A small fixture HTML/JS blob exercising each pattern (true positives) plus clean
  text (no false positives), run via a `tsx` script.
- A live smoke run against one real site.

If a proper test runner (vitest) is preferred, it can be added — flagged as an open
choice rather than assumed.

## Out of scope

- Cross-origin / third-party script scanning (noisy; legitimate third-party keys).
- Network-level checks (headers, TLS, CSP) — separate future check groups.
- Auto-remediation. The scan reports; it does not modify the site.

# Flightcheck Analyze Script

This script reads a crawl JSON file and produces a Markdown TODO report with missing attributes.

The main CLI (`flightcheck`) generates this report by default after every crawl. Use this
standalone script only when you want to re-analyze an existing JSON file without re-crawling.

## Purpose

- Create actionable TODO lists for developers or AI agents.
- Group issues by where they need to be fixed: site-wide, template, or per page.
- Show how broadly an issue occurs across all scanned pages.

## Usage

```bash
pnpm run analyze -- ./flightcheck/20260618.1413-eight.nl-raw.json
```

Include only errors and missing fields:

```bash
pnpm run analyze -- ./flightcheck/20260618.1413-eight.nl-raw.json --errors-only
```

Without `--output`, the Markdown file is derived from the input: `-raw.json` becomes
`-report.md`. The same basename also gets `-fix-manifest.json` and `-agent-jobs/` for
agent orchestration (automatic during analyze).

## Output structure

The report is structured for AI agents and developers. Work through it from top to bottom.

The report opens with a title block: a `# Flightcheck TODO Report` heading, followed by
a `Generated:` line (ISO timestamp) and an `Input:` line with the path to the analyzed
JSON file.

## Summary

A short count: how many pages were scanned, how many pages have issues, site-wide fixes,
which templates need fixes, and an **Issues summary** per category.

Example:

```markdown
- Pages analyzed: 24
- Pages with issues: 13
- Site-wide fixes: 3
- Templates that need fixes: `work`, `blog`
- Pages with page-specific fixes: 5

When no page exposes `<meta name="template">`, template grouping is unavailable and the summary
shows `Unavailable, template meta missing` instead of `none`.

### Issues summary

- **Infra:** 4 issue(s) — DNS (1 issue(s)), security headers (2 issue(s)), robots.txt (1 issue(s))
- **SEO:** 42 issue(s) on 18 page(s)
- **A11y:** 8 issue(s) on 6 page(s) — image alt + static hints
- **Best practices:** 3 issue(s) on 2 page(s) — landmarks, robots, template meta
- **Security:** 2 finding(s) on 1 page(s)
- **Performance:** not checked
```

Categories:

| Category | Source | Examples |
| --- | --- | --- |
| **Infra** | Tier 1 checks | Redirect, DNS, security headers, robots.txt, sitemap |
| **SEO** | Crawl metadata | Missing title, meta, OG, Twitter, canonical, favicon |
| **A11y** | Crawl groups `images` + `a11y-static` | Image alt, heading hierarchy, form labels, lang, tabindex |
| **Best practices** | Crawl warnings | Main landmark, noindex/nofollow, template meta tag |
| **Security** | Crawl secrets scan | Only shown when secrets are found |
| **Performance** | `lighthouse` / `performance` check (planned) | `not checked` until Tier 3 is active |

## How to use this report

A step-by-step plan for iterative improvement. Placed directly under the summary so you know
the fix order before working through the todo sections.

## Issue coverage

Reference table: how often each issue occurs and whether it is site-wide, template-scoped, or
page-specific. Placed at the top as an overview before you start fixing.

Example:

```markdown
- `colorScheme`: 20/20 pages (site-wide)
- `h1`: 1/20 pages (page-specific)
```

## 🔑 Security

Secrets/API keys per URL (`critical` severity first). When values are masked, a hint is shown
to re-crawl with `--reveal-secrets`.

## DNS

Overview of A/MX/NS records, SPF/DMARC signals, and actionable todos for missing mail-security
records.

## Stack

Placed as a `## Stack` heading within the infra block, directly after the DNS section and before
security headers and robots.txt. Informational section with detected hosting, framework, CMS,
backend services, and tracking scripts. Aggregated from crawl records via
`aggregateStackFromRecords(records)` (or a provided `options.stackProfile`) — not from the
Tier 1 security-headers or DNS results. See [stack.md](./stack.md).

## Security headers

Result of the `security-headers` check: missing HSTS, CSP, clickjacking protection, etc.

## Robots.txt & sitemap

Result of the `robots-txt` and `sitemap` checks (skipped in redirect-only mode).

Sitemap comparison requires an exact match between sitemap and crawl URLs, including hostname
(apex vs www). Each mismatch gets `critical` severity, with tips about the likely cause
(for example wrong hostname in the sitemap or a failing sitemap build/cron job).

## Domain redirect

When the start URL returns an HTTP redirect, flightcheck switches to redirect-only mode. The
report shows status code, `Location`, target reachability, and redirect issues. The alternate
host (apex ↔ www) is also checked: the non-canonical host must permanently redirect to the
canonical host from the start URL (or the redirect target). No crawling is performed.

## Fix site-wide (all pages)

Issues that occur on **every** scanned page. Fix once in root layout, shared head partial, or
global SEO config.

Example:

```markdown
- [ ] Add color-scheme meta tag to site layout head
- [ ] Add Open Graph meta tags to site layout head: og:url, og:site_name
- [ ] Add Twitter meta tags to site layout head: twitter:card, twitter:title, twitter:description, twitter:image
```

## Fix in templates

Only when `<meta name="template">` tags are found. Issues that occur on **all** pages with the
same template, but not site-wide. Fix in the template file.

Example:

```markdown
### Template: `work` (15 page(s))

- [ ] Add color-scheme meta tag to template head
- [ ] Add Twitter meta tags to template head: twitter:card, twitter:title, twitter:description, twitter:image
```

## Fix per page

Remaining issues per URL — usually page-specific content. Site-wide and template fixes are not
repeated here. Also includes Tier 1 crawl issues such as missing image alt text and static
a11y hints when the `images` or `a11y-static` crawl groups are active.
Image-alt issues show a clickable markdown link `[filename](url)` when the URL can be derived
from `src`, `srcset`, `<picture>`, or Next.js `/_next/image?url=…`.

## Checks

### Missing fields

Missing SEO/metadata fields are reported as actionable todos. `og.*` and `twitter.*` fields
are grouped.

### Robots meta

A missing robots meta tag is not a missing field. Only explicit `noindex`/`nofollow` (or `none`)
produce a todo:

- Site-wide: `Remove noindex from shared robots meta tag in site layout`
- Per page: `Remove noindex from page robots meta tag`

### Template meta

A missing `<meta name="template">` tag is not a missing SEO field, but it is a warning.
Flightcheck uses this tag to group issues per template in the report.

- Site-wide: `Add template meta tag to site layout head — helps flightcheck give better tailored reports`
- Per page: `Add template meta tag to page head — helps flightcheck give better tailored reports`

### Main landmark

Every page must contain exactly one `<main>`. Issues are reported site-wide, template-wide, or
per page.

### Tier 1 checks in analyze

When you run multiple checks via `runChecks`, analyze automatically passes through Tier 1 output
from earlier waves:

```bash
pnpm run flightcheck -- https://example.com --checks crawl,security-headers,dns,robots-txt,sitemap,analyze --parallel
```

Programmatic:

```typescript
await runAnalyzeCheck({
  records: crawl.records,
  tier1: {
    securityHeaders,
    dns,
    robotsTxt,
    sitemap,
  },
});
```

## Notes

- The script validates input against the expected flightcheck report schema.
- On schema errors, the script stops with a clear error message.

## AI agents

For automated fixes via agents: see [agent-fixes.md](./agent-fixes.md) (fix manifest,
`*-agent-jobs/` prompts, work packages, PR conventions, and `prompts/fix/`).

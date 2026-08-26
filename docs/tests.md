# What Flightcheck tests

Simple overview of everything Flightcheck looks at when it audits a site.
Written for anyone who wants to know what is covered — no technical setup required.

For developers implementing or extending checks, see [checks.md](./checks.md).

## On every page (SEO & basics)

| What is checked |
| --- |
| Page title |
| Heading (h1) |
| Meta description |
| Robots meta (e.g. noindex / nofollow) |
| Template marker |
| Meta title |
| Character encoding (charset) |
| Language |
| Viewport (mobile-friendly) |
| Doctype |
| Canonical URL |
| Color scheme |
| Theme color |
| Main content landmark (`<main>` — exactly one) |

## Sharing & social previews

| What is checked |
| --- |
| Open Graph title |
| Open Graph description |
| Open Graph image |
| Open Graph URL |
| Open Graph type |
| Open Graph site name |
| Twitter card type |
| Twitter title |
| Twitter description |
| Twitter image |

## Icons

| What is checked |
| --- |
| Favicon |
| Other site icons |

## Tracking (detected if present)

| What is checked |
| --- |
| Google Tag Manager |
| Google Analytics 4 |
| Universal Analytics |
| Matomo |
| Facebook Pixel |
| Plausible |

## Images

| What is checked |
| --- |
| Missing image alt text |
| Empty image alt text |
| Generic / unhelpful image alt text |

## Accessibility (static checks)

| What is checked |
| --- |
| Multiple h1 headings on one page |
| Skipped heading levels |
| Missing language on the page |
| Form fields without a label |
| Positive tabindex (keyboard focus order) |

## Security (secrets on the page)

| What is checked |
| --- |
| Leaked API keys / secrets in page HTML |
| Leaked API keys / secrets in same-site JavaScript |

## Security headers (site-wide)

| What is checked |
| --- |
| HSTS (force HTTPS) |
| Content Security Policy |
| Clickjacking protection (X-Frame-Options or CSP) |
| X-Content-Type-Options (nosniff) |
| Referrer-Policy |
| Permissions-Policy |

## Domain & redirects

| What is checked |
| --- |
| Domain redirect (e.g. apex → www) |
| Redirect is permanent (301/308) |
| Redirect target is reachable |
| www and non-www both point to the same preferred host |
| SPF (email authentication) |
| DMARC (email authentication) |

## Search engines (robots & sitemap)

| What is checked |
| --- |
| robots.txt exists |
| robots.txt is valid |
| robots.txt does not block the whole site |
| robots.txt lists a sitemap |
| Sitemap exists and is reachable |
| Sitemap is not empty |
| Sitemap URLs match the pages found on the site |
| Pages found on the site are listed in the sitemap |

## Technology (informational)

| What is checked |
| --- |
| Platform / framework / CMS / hosting / CDN fingerprints |

## Note on redirect-only runs

If the start URL only redirects (for example a domain move), Flightcheck skips most
page checks and only covers redirects, DNS (SPF/DMARC), and the report.

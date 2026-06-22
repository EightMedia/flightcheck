# SEO — template fixes

Applies to issues that appear on **every page sharing the same** `<meta name="template">` value, but
not site-wide.

## Where to fix

**Search the codebase** for the route, layout, or component tied to the template name in the work
package (`template` field).

Useful searches:

- The template meta value (e.g. `work`, `blog`)
- Route segments matching URL paths from affected pages in `issues[].urls`
- Shared layout files under `app/` or `pages/` for that section
- CMS query or type mapping if content-driven

Match the project's existing metadata pattern for that template — do not copy paths from stack hints
without verifying they exist.

## Fix strategy

1. Fix all listed issues once for this template — not per URL unless page package covers the rest.
2. Bundle `og.*` and `twitter.*` fields as the manifest groups them.
3. Reuse site-wide metadata helpers when the project already has them.

## Package-specific verification

1. View source on one page using this template — confirm tags are present.
2. Re-run flightcheck and confirm template-scoped issue counts drop.

## Out of scope (typical)

- Site-wide gaps → `seo-site-wide`
- Single-page gaps on this template → `seo-pages`

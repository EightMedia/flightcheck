## Best practices — site-wide fixes

Applies to best-practice issues present on **every** scanned page: missing `<main>` landmark,
missing `<meta name="template">`, or site-wide `robots` directives (noindex/nofollow).

## Where to fix

Fix once in the shared layer, not per route:

- **main landmark** → the shared layout/wrapper that renders page content (e.g. Pages Router
  `wrappers`/`_app`, App Router `app/layout.tsx`). Wrap content in a single `<main>`.
- **template meta** → the shared `<head>` layer; emit `<meta name="template" content="…">` from the
  document/page type so flightcheck can give template-scoped reports.
- **robots noindex/nofollow** → only remove if the site is meant to be indexed; confirm intent first.

## Fix strategy

1. Add exactly **one** `<main>` in the shared layout — check templates don't already render their own.
2. Source the template value from existing page data (CMS `_type`, route name) — don't hardcode.

## Package-specific verification

- View source on the homepage and one inner page: one `<main>`, and `<meta name="template">` present.
- After flightcheck, `main-missing` and `missing-template` should clear site-wide.

## Best practices — page-specific fixes

Applies to best-practice issues left on **individual pages** after site-wide fixes: a missing
`<main>` landmark, a missing `<meta name="template">`, or per-page `robots` directives.

## Where to fix

**Search for the page/template component behind each URL.** These usually cluster by template — a
single component fix often clears many of the listed URLs at once.

- **main-missing** → wrap the page body in one `<main>`, ideally in the shared layout if all pages lack it.
- **missing-template** → emit the template meta from the page/document type.
- **noindex/nofollow** → confirm the page is supposed to be indexable before removing directives.

## Fix strategy

1. Look for the smallest shared component covering the listed URLs; fix there, not per route.
2. If pages span several templates, note which templates you touched in **Changes**.

## Package-specific verification

- Pick URLs from 2 different templates in the list; confirm `<main>` and template meta are present.
- After flightcheck, `main-missing`/`missing-template` should drop for these URLs.

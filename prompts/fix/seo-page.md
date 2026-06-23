## SEO — page-specific fixes

Applies to metadata still missing on **individual pages** after site-wide and template fixes were
removed (so the markup fields here are genuinely per-page, not site-wide gaps).

## Where to fix

**Search the codebase first** for the route/page component behind each URL. In a CMS-backed site the
value usually comes from a content field, not hardcoded markup — confirm which before editing.

- Markup fields (`canonical`, `og.url`) → derive from the route/URL in the shared metadata layer.
- Content fields (`metaDescription`, `og.description`, `title`) → if a CMS owns them, that work is in
  the `cms-content` package, not here. Only edit the repo when the value is meant to live in code.

## Fix strategy

1. Group pages by route/template — most "page-specific" gaps share a component.
2. Prefer a derived default (e.g. description from intro text) over editing each route by hand.
3. If the only fix is authoring CMS content, say so in **Out of scope** and defer to `cms-content`.

## Package-specific verification

- View source on 2–3 of the listed URLs and confirm the field is now present.
- After re-running flightcheck, the listed `metaDescription`/`og.*` ids should drop for these URLs.

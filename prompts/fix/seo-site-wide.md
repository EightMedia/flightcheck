# SEO — site-wide fixes

Applies to issues in **Fix site-wide (all pages)** — missing meta, Open Graph, Twitter, favicon, etc.
on every scanned page.

## Where to fix

**Search the codebase first.** Do not assume paths from stack hints — find where this project defines
site-wide metadata today.

Typical locations by framework (confirm in repo):

- Next.js App Router — `app/layout.tsx`, `generateMetadata`, shared `lib/seo.ts`
- Next.js Pages Router — `pages/_app.tsx`, `_document.tsx`, shared Head component
- Other — root layout, shared `<head>` partial, central SEO module

Use `searchHints` from the work package as search terms. Stack detection adds framework-specific
hints (e.g. `generateMetadata`, `netlify.toml`) but the agent must verify files exist.

## Fix strategy

1. Identify which fields are missing on all pages (from manifest `issues`).
2. Add them once in the shared layer — not per route.
3. Derive values from existing page data where possible (title → `og:title`, canonical from URL).
4. Bundle `og.*` and `twitter.*` tags as the report groups them.

## Package-specific verification

Add to **How to verify** in the PR:

1. View source on homepage and one inner page — tags should match without per-page duplication.
2. After flightcheck, **Fix site-wide** section should shrink; site-wide issue counts in **Issue
   coverage** should drop for the listed field IDs.

## Out of scope (typical)

- Template-only gaps → `seo-template-*` package
- Single-page gaps → `seo-pages` package
- CMS-sourced OG images → `cms-content` package if content lives in Sanity/etc.

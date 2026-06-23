## CMS content — author missing descriptions and alt text

Applies to editorial fields that are empty in the CMS: meta/social **descriptions**, page **titles**,
and image **alt text**. These are content, not code — the fix is authoring values in the CMS, so the
**approval flow in `../BASE.md` is mandatory**. Inspect only until the user approves.

## Required flow (summary — see BASE.md)

1. Use the CMS MCP (or Studio) to **inspect** the documents behind the listed URLs and find the fields
   backing each issue (e.g. `seo.description`, image `alt`).
2. **Propose** concrete values per document/field in plain language — do not write yet.
3. **Wait for explicit approval**, then apply only the agreed changes and summarize what you wrote.

## Authoring guidance

- **Descriptions:** unique per page, ~120–160 chars, drawn from the page's own content. No
  boilerplate repeated across pages.
- **Image alt:** describe the image's content/purpose; leave truly decorative images with empty alt
  in code, not in the CMS.
- Do not bulk-fill with placeholder text — empty is better than wrong/duplicated.

## If approval is not given

Open a draft PR / note documenting exactly which documents and fields need values (a checklist the
editor can work through), and do not perform any CMS writes.

## Package-specific verification

- After publishing, view source on a few listed URLs: description/alt present and meaningful.
- Re-run flightcheck: `metaDescription`, `og.description`, and `empty-alt`/`missing-alt` ids drop.

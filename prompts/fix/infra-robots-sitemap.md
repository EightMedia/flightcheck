## Infra — robots.txt & sitemap

Applies to robots.txt problems and sitemap mismatches (URLs crawled but absent from the sitemap, or
listed but unreachable).

## Before you "fix" anything

**Many sitemap mismatches are not real.** Check `../REVIEW.md` first: URLs that are 404s, emails,
phone numbers, or dynamic-route placeholders (`[slug]`) should **not** be added to the sitemap — they
are crawler artifacts or broken links. Adding them makes the sitemap worse.

For each "missing from sitemap" URL, decide:

- Real, indexable page wrongly excluded → fix the sitemap generation so it is included.
- 404 / junk / placeholder → leave it out; if it is linked somewhere, fix the link instead (note it
  in **Out of scope** if the link lives outside this package).

## Where to fix

- **next-sitemap** → `next-sitemap.config.js` (excludes, additional paths, dynamic routes).
- Static `public/robots.txt` / `public/sitemap.xml`, or a sitemap route/build step.

## Package-specific verification

- Fetch `/robots.txt` and `/sitemap.xml`; confirm only real pages are listed.
- After flightcheck, the robots/sitemap issues should clear (genuine 404s stay in REVIEW, not sitemap).

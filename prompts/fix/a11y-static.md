## Accessibility — static fixes

Applies to accessibility issues detectable from the HTML: heading-order skips, missing `lang`,
unlabeled inputs, positive tabindex, and image `alt` problems.

## Where to fix

**Search for the component or route behind each URL.** Structural issues are almost always code:

- **heading-skip** → fix the heading levels in the template/component (don't jump h1→h3). If headings
  come from CMS rich text, the structure may be authored content — note it and defer to `cms-content`.
- **missing-lang** → set `lang` on the root `<html>` (shared document/layout).
- **unlabeled-input** → add a `<label>`/`aria-label` in the form component.
- **image alt** → if images come from a CMS, alt text is editorial content and belongs in the
  `cms-content` package, **not** here. Only add `alt` in code for decorative/static images (use `alt=""`).

## Fix strategy

1. Group by template/component — one fix usually covers many listed URLs.
2. Don't invent alt text for content images; route those to the CMS owner.

## Package-specific verification

- Re-check a couple of the listed URLs with the same heading/lang/label assertion.
- After flightcheck, the listed a11y ids (`heading-skip`, `missing-lang`, …) should drop for them.

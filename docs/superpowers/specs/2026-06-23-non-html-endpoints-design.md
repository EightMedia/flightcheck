# Non-HTML endpoints: skip from analysis, document in Infrastructure

## Problem

The crawler discovers and fetches internal links that are not HTML pages —
API routes such as `/wp-json/`, `/api/...`, GraphQL endpoints, etc. These
slip past the existing extension blocklist (`extractors.ts:117-164`) because
they have no file extension.

When fetched, they produce records that are wrong to analyse as pages:

- A successful JSON endpoint (`application/json`, 200) yields an empty
  `VerificationRecord` carrying only
  `note: "Skipped non-HTML content-type: application/json"`. Its blank
  title/H1/meta fields then generate false per-page fixes.
- An errored endpoint such as `/api/download` returning **401** is routed by
  Crawlee through `failedRequestHandler`, producing a record with
  `status: null`, no content-type, plus an error. This generates the full
  cascade of bogus fixes *and* a "Resolve page fetch error":

  ```
  ### https://www.reto-arnhem.nl/api/download
  - Status: `error`
  - Note: Skipped non-HTML content-type: unknown
  - Error: Request blocked - received 401 status code.
  - [ ] Resolve page fetch error
  - [ ] Add h1 to page
  - [ ] Add title element to page head
  ...12 more bogus fixes...
  ```

These endpoints should not be analysed as pages or counted as issues. They
should instead be documented as discovered non-HTML endpoints.

## Goals

1. Non-HTML responses are excluded from per-page analysis: no page fixes, not
   counted in page/issue totals.
2. Discovered non-HTML endpoints are documented in a new Infrastructure
   subsection.
3. A genuinely broken **content page** (e.g. `/about` returning 404, which is
   not an API path) keeps its existing "Resolve page fetch error" handling.

## Non-goals

- Changing how robots-blocked records are handled (out of scope; left as-is).
- Skipping API URLs at enqueue time. We still fetch them so we can document
  their real status and content-type. (Link extraction already only runs on
  `text/html` responses, so endpoints never spawn child crawls.)

## Detection rule

A record is a **non-HTML endpoint** when:

- `record.contentType` is set and does not include `text/html` (clean
  JSON/XML/other case), **or**
- `record.contentType` is empty/unknown (errored fetch) **and** the URL
  matches an API path pattern.

A response whose content-type includes `text/html` is always treated as a
page. A broken non-API page (unknown content-type, non-API URL) falls through
to existing page-error handling.

### API path patterns

Matched against the URL (case-insensitive). Small, documented, extendable
list:

- a `/api/` path segment (or path ending in `/api`)
- `/wp-json/` (WordPress REST), or path equal to `/wp-json`
- `rest_route` present in the query string (WordPress REST alt form)
- a `/graphql` path segment
- path ending in `/xmlrpc.php`

## Changes

### 1. `src/crawler/schema.ts`

Add an optional field to `VerificationRecord`:

```ts
contentType?: string;
```

### 2. `src/crawler/runCrawler.ts`

Set `record.contentType` on every fetched record so analyze has a reliable
signal:

- In `requestHandler`, set `record.contentType = effectiveContentType`.
- In `failedRequestHandler`, the content-type is unknown; leave it
  unset/empty (the path heuristic covers these).

### 3. `src/analyze/report.ts`

- Add `isNonHtmlEndpoint(record): boolean` implementing the detection rule
  above, plus an `isApiPath(url)` helper for the path patterns.
- Partition records before fix generation: non-HTML endpoints are removed
  from the `pageFixes` pipeline, from `totalPages`, and from issue counts.
- Add `buildNonHtmlEndpointsSection(endpoints)` and append its output to
  `infraLines`, after the Stack section. Renders all non-HTML responses
  regardless of status, e.g.:

  ```markdown
  ### API / non-HTML endpoints

  Discovered URLs that returned a non-HTML response. These are not analysed
  as pages.

  - `https://www.reto-arnhem.nl/wp-json/` — `application/json` (status `200`)
  - `https://www.reto-arnhem.nl/api/download` — unknown (error: 401)
  ```

  The section is omitted when there are no such endpoints.

Non-HTML endpoint records remain in the raw JSON output unchanged.

### 4. Documentation

- `docs/crawler.md` — note that fetched records now carry `contentType`, and
  describe non-HTML / API endpoint handling.
- `docs/analyze.md` — document the new Infrastructure subsection and that
  non-HTML endpoints are excluded from per-page fixes and counts.

## Testing

Add a unit test to the analyze/report suite feeding a mix of records:

- a normal HTML page (with some real fixes),
- a JSON endpoint (`application/json`, 200),
- an API error endpoint (`/api/download`, status null, unknown content-type,
  401 error),
- a broken **non-API** page (`/about`, status null, unknown content-type),
- a robots-blocked record.

Assert:

1. The JSON and API-401 endpoints produce **no** per-page fixes and are not
   included in page/issue counts.
2. Both appear in the "API / non-HTML endpoints" section with their
   content-type/status/error.
3. The broken non-API `/about` page still gets its "Resolve page fetch error"
   handling and is not listed as an endpoint.
4. The HTML page's real fixes are unaffected.

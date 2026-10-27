# Flightcheck Analyze Script

This script reads a crawl JSON file and produces a structured report:

- `*-report.json` — machine-readable analysis + findings
- `*-report.md` — plain-language Markdown rendered from that JSON

The main CLI (`flightcheck`) generates both by default after every crawl. Use this
standalone script only when you want to re-analyze an existing JSON file without re-crawling.

## Purpose

- Give tools a stable JSON schema (`analysis` + flat `findings[]`).
- Give people a readable Markdown report generated from the same model.
- Keep severity, category, and scope on every finding.

## Usage

```bash
pnpm run analyze -- ./flightcheck/20260618.1413-example.com-raw.json
```

Include only critical/error findings in the Markdown view:

```bash
pnpm run analyze -- ./flightcheck/20260618.1413-example.com-raw.json --errors-only
```

Without `--output`, paths are derived from the input: `-raw.json` becomes
`-report.md` and `-report.json`.

## Output structure

### `*-report.json`

```json
{
  "version": 1,
  "generatedAt": "2026-10-27T12:00:00.000Z",
  "source": "./flightcheck/example-raw.json",
  "redirectOnly": false,
  "analysis": {
    "pagesAnalyzed": 24,
    "pagesWithIssues": 13,
    "findingCounts": {
      "critical": 1,
      "error": 12,
      "warning": 8,
      "review": 3
    },
    "stack": [
      {
        "name": "Next.js",
        "categories": ["JavaScript frameworks"],
        "confidence": "high",
        "evidence": ["Next.js runtime markers in HTML"],
        "pageCount": 24
      }
    ],
    "templates": ["work", "blog"],
    "reviewPages": []
  },
  "findings": [
    {
      "id": "missing-hsts",
      "severity": "error",
      "category": "infra",
      "scope": "origin",
      "title": "Missing Hsts",
      "message": "Strict-Transport-Security header is missing on HTTPS."
    }
  ]
}
```

Findings are a flat list (no severity buckets), sorted critical → review. Each finding
includes metadata so consumers can filter or regroup.

| Field | Meaning |
| --- | --- |
| `severity` | `critical` \| `error` \| `warning` \| `review` |
| `category` | `infra` \| `seo` \| `a11y` \| `best-practices` \| `security` \| `performance` |
| `scope` | `site-wide` \| `template` \| `page` \| `origin` |
| `title` | Short human title |
| `message` | What to do / what was found |
| `template` | Present when `scope` is `template` |
| `urls` / `count` | Affected pages when relevant |

### `*-report.md`

Generated from the JSON. Structure:

1. **At a glance** — page counts and finding totals
2. **Stack / DNS / redirect** — factual context when available
3. **Findings** — grouped by severity for reading order, with plain-language titles

## Notes

- The script validates crawl input against the expected flightcheck report schema.
- On schema errors, the script stops with a clear error message.
- Fix-manifest and agent-jobs output are no longer generated. Prefer `*-report.json`
  for machine consumers. See the design note in
  [superpowers/specs/2026-10-27-structured-report-design.md](./superpowers/specs/2026-10-27-structured-report-design.md).

# Structured report design

## Goal

Replace the fix-manifest + agent-jobs output with one machine-readable
`*-report.json` that is also the source of truth for a human-friendly
`*-report.md`.

## Decisions

- JSON shape: `{ analysis, findings[] }` — flat findings, no severity buckets
- Each finding carries `severity`, `category`, `scope`, and other metadata
- Markdown is rendered from the JSON model (single source of truth)
- Readable for less technical readers: plain language, grouped by severity
- Drop default generation of `*-fix-manifest.json` and `*-agent-jobs/`

## JSON schema (v1)

```ts
type FlightcheckReport = {
  version: 1;
  generatedAt: string;
  source: string;
  redirectOnly: boolean;
  analysis: {
    pagesAnalyzed: number;
    pagesWithIssues: number;
    findingCounts: Record<Severity, number>;
    stack: StackEntry[];
    templates: string[];
    dns?: { hostname: string; summary: string[] };
    redirect?: { url: string; status: number | null; location: string | null; issueCount: number };
    reviewPages: Array<{ url: string; status: number | null; reason: string }>;
  };
  findings: Finding[];
};

type Finding = {
  id: string;
  severity: "critical" | "error" | "warning" | "review";
  category: "infra" | "seo" | "a11y" | "best-practices" | "security" | "performance";
  scope: "site-wide" | "template" | "page" | "origin";
  title: string;
  message: string;
  template?: string;
  urls?: string[];
  count?: number;
};
```

## Files

| File | Role |
| --- | --- |
| `*-raw.json` | Crawl/check source data |
| `*-report.json` | Structured analysis + findings |
| `*-report.md` | Human report rendered from `*-report.json` |

## Out of scope for this change

- Rebuilding agent orchestration on top of the new JSON
- Changing crawl/`*-raw.json` schema

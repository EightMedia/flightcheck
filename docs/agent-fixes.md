# Agent fixes

Flightcheck output is designed to feed AI agents that propose fixes as **small, reviewable pull
requests**. Humans use the Markdown report; agents use a fix manifest plus modular prompt files.

**Status:** fix manifest, orchestrator, and agent-jobs output implemented; stack detection implemented (WIP heuristics).

Agent jobs are designed for **consumability**: shared rules live once in `BASE.md` (referenced, not
inlined), per-package `prompt.md` files stay small (issues summarized, full list in `package.json`),
issues are deduped against site-wide coverage and routed by fix surface, and non-fixable crawl
artifacts are quarantined in `REVIEW.md`. See **Agent jobs** below.

See [stack.md](./stack.md) for detection rules and report output.

---

## Stack detection (implemented)

Stack fingerprinting is live and feeds the `## Stack` section in analyze reports. It is
**informational only** today — no fix todos from stack alone.

### Signal sources

| Source | Module | When |
| --- | --- | --- |
| HTML fingerprints | `src/crawler/stack.ts` (`stack` crawl group, on by default) | Per page during crawl |
| Response headers | `src/analyze/stack.ts` (`detectStackFromHeaders`) | When `security-headers` check runs |
| DNS records | `src/analyze/stack.ts` (`detectStackFromDns`) | When `dns` check runs |
| Tracking IDs | `tracking` crawl group | Aggregated in `buildStackProfile` |

Aggregation happens in `buildStackProfile()` → `buildStackSection()` in `src/analyze/stack.ts`,
called from `buildMarkdown()` when not in redirect-only mode.

### Data shape

Per-page crawl records carry `stack.detections[]`. The aggregated profile (`StackProfile`) adds
`pageCount` per detection and deduped tracking IDs:

```typescript
type StackDetection = {
  name: string;           // e.g. "Next.js", "Sanity", "Netlify"
  category: StackCategory; // hosting | cdn | framework | cms | backend | analytics | other
  confidence: "high" | "medium" | "low";
  evidence: string[];
};
```

### Stack → agent routing (implemented)

`buildFixManifest()` maps non-low-confidence detections to work package hints:

| Detection | Category | Affects packages | MCP / prompt hints |
| --- | --- | --- | --- |
| Next.js, Nuxt, Gatsby, Astro, … | framework | `seo-*`, `a11y-pages` | Pages vs App Router hints (`pages/_app.tsx` / `app/layout.tsx`, `next/head` / `generateMetadata`) |
| Sanity, Contentful, WordPress, Prismic, … | cms | `cms-content` (descriptions, image alt) | CMS MCP (e.g. `sanity`), `cms-content.md` |
| Vercel | hosting | `infra-headers` | `vercel` MCP or `next.config` headers |
| Netlify | hosting | `infra-headers` | `netlify` MCP, `netlify.toml` |

Low-confidence signals (e.g. nginx from `Server` header) do not affect routing — `mcpServers` and the
CMS-content split require `confidence !== "low"`.

When a CMS is detected, editorial content (meta/social **descriptions** and image **alt text**) is
split out of the repo SEO/a11y packages into a dedicated `cms-content` package (`fixSurface: cms`,
`locationDiscovery: cms-studio`) gated by the approval flow. Conservatively, `title`/`h1` stay in the
repo packages — a missing one is usually a template bug, not empty content.

Example manifest `stack` block (derived from `StackProfile`):

```json
"stack": [
  {
    "name": "Next.js",
    "categories": ["JavaScript frameworks"],
    "confidence": "high",
    "scope": "site-wide",
    "evidence": ["Next.js runtime markers in HTML"]
  },
  {
    "name": "Sanity",
    "category": "backend",
    "confidence": "high",
    "scope": "12/24 page(s)",
    "evidence": ["cdn.sanity.io images in HTML"]
  },
  {
    "name": "Vercel",
    "category": "hosting",
    "confidence": "high",
    "scope": "origin",
    "evidence": ["x-vercel-id: iad1::abc-123"]
  }
]
```

### Still WIP

- Conflicting-signal warnings as todos
- Per-client prompt overrides (`.flightcheck/prompts/`)
- Stack fingerprint sync removed from active path — see [stack.md](./stack.md) for curated rules.

---

## Outputs

| File | Audience | Purpose |
| --- | --- | --- |
| `*-raw.json` | Machine | Source of truth from all checks |
| `*-report.md` | Human | Summary, priorities, grouped todos |
| `*-fix-manifest.json` | Agents / orchestrator | Work packages, routing, `reviewItems`, verification hooks |
| `*-agent-jobs/` | Agents | `BASE.md`, `PLAN.md`, `REVIEW.md`, README, and one folder per package |
| `*-agent-jobs/{pkg}/prompt.md` | Sub-agents | Small per-package brief that references `BASE.md` |
| `*-agent-jobs/{pkg}/package.json` | Machine | Full work package incl. every issue URL |
| `prompts/fix/*.md` | Sub-agents | How to fix each domain (composed at runtime) |

The Markdown report stays client-friendly. Do **not** embed full agent prompts in the report.

---

## Work packages

Each work package maps to **one pull request**. Bundle by fix surface, not only by category.

Packages are emitted only when the run produces matching issues. Page-level packages contain only
what remains **after** site-wide and template coverage is removed (no duplication), and only pages
that returned HTTP 200 (non-200 URLs go to `REVIEW.md`).

| Package ID | Fix surface | Contents | Typical PR repo |
| --- | --- | --- | --- |
| `seo-site-wide` | repo | Metadata/social tags missing on every page | Site repo |
| `seo-template-{name}` | repo | Metadata missing across one template | Site repo |
| `seo-pages` | repo | Per-page markup gaps (e.g. `h1`, page-specific `canonical`) | Site repo |
| `best-practices-site-wide` | repo | `<main>` landmark, `template` meta, robots — site-wide | Site repo |
| `best-practices-template-{name}` | repo | Same, scoped to one template | Site repo |
| `best-practices-pages` | repo | Per-page landmark / template / robots | Site repo |
| `a11y-site-wide` / `a11y-template-{name}` | repo | Structural a11y across all/one template | Site repo |
| `a11y-pages` | repo | Per-page structural a11y (heading order, lang, labels) | Site repo |
| `cms-content` | cms | Editorial content (descriptions, image alt) — **only when a CMS is detected** | CMS dataset (approval-gated) |
| `infra-headers` | hosting | Security headers | Site or infra repo |
| `infra-robots-sitemap` | repo | Robots.txt & sitemap | Site repo |
| `agent-ready` | repo | Agent readiness (llms.txt, Content Signals, markdown negotiation, Link headers) | Site repo |
| `infra-redirect` | hosting | Domain redirect config | Hosting/infra |
| `infra-dns` | dns | SPF/DMARC etc. | Registrar / DNS panel (manual) |
| `secrets` | manual | Exposed secrets — key rotation | Manual — not auto-fixed |

All page-level packages (`promptId`s `seo-page`, `best-practices-page`, `a11y-static`) carry granular
issue ids (`empty-alt`, `heading-skip`, `h1`, …) so a fix maps back to a verifiable id. Stack
detection sets `mcpServers` and `searchHints` per package. See **Stack detection** above.

---

## Fix manifest

Analyze writes `*-fix-manifest.json` and `*-agent-jobs/` alongside `*-report.md` (same basename as
`*-raw.json`). Each auto-fixable work package gets a ready-to-paste `prompt.md` in its own folder.

The standalone `flightcheck-orchestrate` CLI can re-generate agent jobs from an existing manifest
(e.g. after adding `.flightcheck/prompts/` overrides in the site repo).

### Codebase discovery (not hardcoded paths)

Repo-scoped packages use `locationDiscovery: "search-codebase"`. Agents receive `searchHints` —
search terms and common patterns — but **must search the project source** to find the real layout,
metadata helper, or template files. Stack detection adds framework hints (e.g. `generateMetadata`,
`netlify.toml`) as optional search terms, not as fixed paths.

```json
{
  "id": "seo-site-wide",
  "locationDiscovery": "search-codebase",
  "searchHints": [
    "Search the codebase for the root layout, shared head, or site-wide metadata configuration",
    "generateMetadata",
    "app/layout.tsx"
  ],
  "mcpServers": []
}
```

### Example manifest

```json
{
  "source": "20260618.1413-eight.nl",
  "reportPath": "20260618.1413-eight.nl-report.md",
  "stack": [],
  "workPackages": [
    {
      "id": "seo-site-wide",
      "promptId": "seo-site-wide",
      "fixSurface": "repo",
      "priority": 1,
      "scope": "site-wide",
      "issues": [
        {
          "id": "og.siteName",
          "severity": "error",
          "scope": "site-wide",
          "count": 24,
          "todo": "Missing og.siteName on site-wide"
        }
      ],
      "locationDiscovery": "search-codebase",
      "searchHints": [
        "Search the codebase for the root layout, shared head, or site-wide metadata configuration",
        "generateMetadata",
        "app/layout.tsx"
      ],
      "mcpServers": [],
      "prTitle": "fix(seo): add site-wide Open Graph and Twitter tags",
      "autoFixable": true
    }
  ]
}
```

Fields:

- `promptId` — references `prompts/fix/{promptId}.md`
- `fixSurface` — `repo` | `hosting` | `cms` | `dns` | `manual`
- `locationDiscovery` — `search-codebase` | `hosting-panel` | `cms-studio` | `dns-panel` | `manual`
- `searchHints` — terms for codebase/hosting search (not guaranteed file paths)
- `mcpServers` — e.g. `netlify`, `sanity` (from stack detection)
- `autoFixable` — `false` for secrets and DNS unless an integration exists

---

## Prompt composition

The shared base rules (`prompts/fix/_base.md`) are written **once** to `BASE.md` at the agent-jobs
root. Each `prompt.md` references it rather than inlining ~120 lines, so per-package prompts stay
small (a few KB instead of hundreds). A package `prompt.md` is:

```text
# Fix `{id}`  + "read ../BASE.md first"
+ prompts/fix/{promptId}.md          (domain guidance)
+ optional project override (.flightcheck/prompts/{promptId}.md in consuming repo)
+ work package slice: issues (summarized; full list in package.json), search hints, stack,
  references, runnable verify command
```

Project-specific conventions (App Router `generateMetadata`, Sanity as OG source, etc.) belong in
the consuming repo override, not in flightcheck defaults.

---

## Pull request requirements

Every agent **must** follow `prompts/fix/_base.md`. One work package → one PR.

### MCP and external systems

When a work package lists `mcpServers` (Sanity, Netlify, Vercel, etc.), agents **must not** write
to the CMS or hosting environment without user approval:

1. Explain the proposed changes in simple, non-jargon language.
2. Wait for explicit confirmation.
3. Apply only what was approved, then report what changed.

Repo-only fixes (code, `netlify.toml`, `next.config`) proceed in the normal PR flow. Live CMS
publishes and hosting dashboard changes always require ask-first validation.

See **MCP and external systems (ask first)** in `prompts/fix/_base.md`.

### Title

Conventional commits, scoped to the package:

```text
fix(seo): add site-wide Open Graph tags
fix(a11y): add alt text to shared image components
fix(infra): add HSTS and security headers on Netlify
```

### Scope

- Touch only files required for **this** work package.
- Do not mix unrelated fixes (no drive-by refactors, formatting-only changes, or dependency bumps).
- Prefer the smallest diff that resolves all issues in the package.

### Description template

Agents must fill every section:

```markdown
## Flightcheck

- **Work package:** `seo-site-wide`
- **Issues addressed:** `og.siteName`, `og.url`, `twitter.card` (24/24 pages, site-wide)
- **Report:** [link or path to *-report.md]

## Changes

- Added `og:site_name` and `og:url` in root layout metadata helper
- Set default `twitter:card` to `summary_large_image`

## How to verify

1. Check out this branch and run the site locally (or preview deploy).
2. View source on the homepage — confirm OG and Twitter meta tags are present.
3. Re-run flightcheck (from wherever flightcheck is installed — usually not a script in the site repo):
   `npx @eightmedia/flightcheck https://example.com --checks crawl,analyze`
4. Confirm **Issues summary → SEO** counts drop for the items above.

## Out of scope

- Per-page OG images (separate `seo-pages` package)
- Template-specific Twitter copy (`seo-template-work`)

## Checklist

- [ ] Only files for this work package were changed
- [ ] No unrelated refactors or dependency updates
- [ ] Flightcheck re-run shows improvement for listed issue IDs
```

### Reviewer-friendly rules

| Rule | Why |
| --- | --- |
| One package = one PR | Reviewer knows exactly what to expect |
| List issue IDs from manifest | Maps PR back to flightcheck output |
| Explicit verify steps | Developer can confirm without re-reading the full report |
| **Out of scope** section | Prevents "why didn't you fix X?" confusion |
| Link/report path | Traceability to the audit run |

Hosting and CMS PRs use the same template; **How to verify** references the right tool (Netlify
deploy preview, Sanity Studio, DNS panel).

---

## Agent jobs (automatic)

Every analyze run writes `*-agent-jobs/` next to the manifest. This folder is the **agent
workbench** — one subfolder per work package, one pull request each.

### What it means in practice

```text
flightcheck crawl  →  analyze  →  *-fix-manifest.json
                              →  *-agent-jobs/
                                   ├── BASE.md                  → shared rules (read once)
                                   ├── PLAN.md                  → recommended order + dependencies
                                   ├── REVIEW.md                → non-200 URLs to investigate, not fix
                                   ├── README.md
                                   ├── seo-site-wide/prompt.md  → agent → PR 1
                                   ├── infra-headers/prompt.md  → agent → PR 2
                                   └── infra-dns/MANUAL.md      → human
```

Each `prompt.md` references `../BASE.md` and adds:

- Domain guidance (`prompts/fix/{promptId}.md`)
- Optional project override (`.flightcheck/prompts/{promptId}.md` in the site repo)
- The work package issues (summarized; full list in `package.json`), search hints, stack, and verify command

Pass `--repo <path>` on the main CLI to pick up project prompt overrides from
`.flightcheck/prompts/` in the site repo.

### Re-run orchestrator (optional)

Use `flightcheck-orchestrate` when you already have a manifest and want to regenerate agent jobs
without re-crawling — for example after adding project prompt overrides:

```bash
pnpm exec tsx src/orchestrate.ts ./flightcheck/20260618.1413-eight.nl-fix-manifest.json \
  --repo ../eight.nl \
  --site-url https://eight.nl
```

Output defaults to `*-agent-jobs/` next to the manifest (e.g. `20260618.1413-eight.nl-agent-jobs/`).

### Workflow for developers

1. Run flightcheck on the site (`pnpm start https://www.example.com` or your usual command).
2. Open the site repo in your agent tool; read `*-agent-jobs/BASE.md` once and `PLAN.md` for the order.
3. Work packages in `PLAN.md` order (site-wide first): point the agent at a package folder, let it
   read that folder's `prompt.md`, review the PR. Re-run flightcheck and regenerate before the next.
4. Check `REVIEW.md` for crawled URLs that are not real pages — fix the links, don't add metadata.

Manual packages (`autoFixable: false`) get `MANUAL.md` instead (DNS, secrets).

---

## Orchestrator CLI (`flightcheck-orchestrate`)

Thin wrapper around the same `writeAgentJobs()` logic used by analyze. Prefer the automatic output
from a full flightcheck run; use this CLI only to regenerate jobs from an existing manifest.

---

## Orchestrator behaviour (manifest level)

1. Read fix manifest; sort by `priority`.
2. Skip packages with `autoFixable: false` (surface as manual todos).
3. Spawn one agent per package with composed prompt + manifest slice.
4. Require each agent to open a PR using the description template.
5. After merge (or on draft PR), re-run flightcheck and compare issue IDs.

Parallel agents are safe when `fixSurface` differs (e.g. `seo-site-wide` + `infra-headers`). Avoid
parallel agents on the same repo paths.

---

## Related docs

- [analyze.md](./analyze.md) — Markdown report structure
- [stack.md](./stack.md) — stack detection rules, categories, limitations
- [qc-checks-plan.md](./qc-checks-plan.md) — full tiered QC roadmap

# Agent fixes

Flightcheck output is designed to feed AI agents that propose fixes as **small, reviewable pull
requests**. Humans use the Markdown report; agents use a fix manifest plus modular prompt files.

**Status:** fix manifest export implemented; stack detection implemented (WIP heuristics).

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

### Stack → agent routing (for fix manifest)

When `buildFixManifest()` lands, map high-confidence detections to work package hints:

| Detection | Category | Affects packages | MCP / prompt hints |
| --- | --- | --- | --- |
| Next.js, Nuxt, Gatsby, Astro, … | framework | `seo-*`, `a11y-static` | `app/layout.tsx`, `generateMetadata`, `lib/seo.ts` |
| Sanity, Contentful, Storyblok, Prismic | backend | `cms-content`, image alt from CDN | `sanity` MCP, `cms-sanity-metadata.md` |
| Vercel | hosting | `infra-headers` | `vercel` MCP or `next.config` headers |
| Netlify | hosting | `infra-headers` | `netlify` MCP, `netlify.toml` |
| WordPress, Shopify, Webflow, … | cms | `seo-*`, `cms-content` | CMS-specific prompts (future) |

Low-confidence signals (e.g. nginx from `Server` header) should not override routing — use
`confidence === "high"` or corroboration across HTML + headers + DNS before setting `mcpServers`.

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
- Optional Wappalyzer / webappanalyzer rule sync (see [stack.md](./stack.md))

---

## Outputs

| File | Audience | Purpose |
| --- | --- | --- |
| `*-raw.json` | Machine | Source of truth from all checks |
| `*-report.md` | Human | Summary, priorities, grouped todos |
| `*-fix-manifest.json` | Orchestrator | Work packages, routing, verification hooks |
| `prompts/fix/*.md` | Sub-agents | How to fix each domain (composed at runtime) |

The Markdown report stays client-friendly. Do **not** embed full agent prompts in the report.

---

## Work packages

Each work package maps to **one pull request**. Bundle by fix surface, not only by category.

| Package ID | Report section | Fix surface | Typical PR repo |
| --- | --- | --- | --- |
| `seo-site-wide` | Fix site-wide | Code (layout, shared SEO) | Site repo |
| `seo-template-{name}` | Fix in templates | Code (template files) | Site repo |
| `seo-pages` | Fix per page | Code (routes, page components) | Site repo |
| `a11y-static` | Image alt, a11y-static | Code ± CMS | Site repo (+ CMS PR if needed) |
| `infra-headers` | Security headers | Hosting config or `next.config` | Site or infra repo |
| `infra-robots-sitemap` | Robots.txt & sitemap | `public/`, sitemap build | Site repo |
| `infra-dns` | DNS | Registrar / DNS panel | Usually no PR |
| `cms-content` | Content-backed SEO/a11y | CMS documents | CMS dataset (separate PR) |
| `secrets` | Security (secrets) | Env vars, key rotation | Manual — not auto-fixed |

Stack detection sets `mcpServers`, `suggestedPaths`, and optional `stackPromptHints` on each
package. See **Stack detection** above and [stack.md](./stack.md).

---

## Fix manifest

Analyze writes `*-fix-manifest.json` alongside `*-report.md` (same basename as `*-raw.json`).

Orchestrator reads the manifest and spawns one agent per work package (parallel when surfaces do
not conflict).

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

Runtime prompt for a sub-agent:

```text
prompts/fix/_base.md
+ prompts/fix/{promptId}.md
+ optional project override (.flightcheck/prompts/{promptId}.md in consuming repo)
+ manifest work package slice (issues, paths, stack)
```

Project-specific conventions (App Router `generateMetadata`, Sanity as OG source, etc.) belong in
the consuming repo override, not in flightcheck defaults.

---

## Pull request requirements

Every agent **must** follow `prompts/fix/_base.md`. One work package → one PR.

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
3. Re-run flightcheck:
   `pnpm run flightcheck -- https://example.com --checks crawl,analyze`
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

## Orchestrator (`flightcheck-orchestrate`)

The orchestrator is a small script that **prepares agent work** from a fix manifest. It does not run
agents itself — it writes ready-to-paste prompt files, one per PR.

### What it means in practice

```text
flightcheck crawl  →  *-fix-manifest.json  →  orchestrate  →  *-agent-jobs/
                                                              ├── README.md
                                                              ├── seo-site-wide/prompt.md  → Cursor agent → PR 1
                                                              ├── infra-headers/prompt.md  → Cursor agent → PR 2
                                                              └── secrets/MANUAL.md          → human
```

Each `prompt.md` combines:

- Base PR rules (`prompts/fix/_base.md`)
- Domain guidance (`prompts/fix/{promptId}.md`)
- Optional project override (`.flightcheck/prompts/{promptId}.md` in the site repo)
- The work package issues, search hints, stack, and verify command

### Usage

```bash
# After flightcheck analyze produced *-fix-manifest.json
pnpm run orchestrate -- ./flightcheck/20260618.1413-eight.nl-fix-manifest.json

# With site repo (for .flightcheck/prompts overrides) and verify URL
pnpm run orchestrate -- ./flightcheck/20260618.1413-eight.nl-fix-manifest.json \
  --repo ../eight.nl \
  --site-url https://eight.nl
```

Output defaults to `*-agent-jobs/` next to the manifest (e.g. `20260618.1413-eight.nl-agent-jobs/`).

### Workflow for developers

1. Run flightcheck on the site.
2. Run orchestrate on the manifest.
3. Open the site repo in Cursor.
4. For each auto-fixable folder: new agent chat → paste `prompt.md` → review PR.
5. Re-run flightcheck; repeat for remaining packages.

Manual packages (`autoFixable: false`) get `MANUAL.md` instead (DNS, secrets).

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

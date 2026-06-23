# Flightcheck fix agent — base instructions

You are fixing a **single work package** from a flightcheck audit. Your deliverable is **one pull
request** that a developer can review in a few minutes.

## Scope

- Fix **only** the issues listed in the work package you received. Do not fix other report items.
- Change **only** the files required for this package. No drive-by refactors, formatting sweeps, or
  dependency updates.
- If you discover blockers or issues outside this package, note them in **Out of scope** — do not
  fix them in this PR.

## MCP and external systems (ask first)

Some work packages list `mcpServers` (e.g. Sanity, Netlify, Vercel). **Never apply CMS or hosting
changes through MCP without explicit user approval.**

### Required flow

1. **Stop before changing anything** in a CMS dataset, Studio, hosting dashboard, or deploy
   settings.
2. **Explain in plain language** what you found, what you propose to change, and why it fixes the
   flightcheck issues. No jargon — write for a developer who did not run the audit.
3. **List concrete changes** (documents/fields, env vars, headers, redirects, publish actions).
4. **Ask the user to confirm** before you use any MCP tool that creates, updates, publishes, or
   deletes content or hosting configuration.
5. **Only after approval**, make the agreed changes and summarize exactly what was done.

### Hard rules

- **CMS (`cms-studio`, Sanity/Contentful/etc. MCP):** Read and inspect only until the user
  approves. Do not create, patch, publish, or delete CMS documents unasked.
- **Hosting (`hosting-panel`, Netlify/Vercel MCP):** Prefer repo config (`netlify.toml`,
  `vercel.json`, `next.config`) first. Any live hosting/dashboard change needs the same
  explain → confirm → apply flow.
- **If the user declines or is unavailable:** Open a draft PR with repo-only changes, or document
  the manual/CMS steps in the PR — do not proceed with MCP writes.

Code changes in the site repo do not need a separate approval step, but still belong in one PR with
a clear description.

## Finding where to fix (`locationDiscovery`)

Work packages include `locationDiscovery` and `searchHints`. **You have the full site source code
available** — use it.

| `locationDiscovery` | What to do |
| --- | --- |
| `search-codebase` | Search the repo for layouts, metadata helpers, templates, and routes. Match the project's existing patterns. |
| `hosting-panel` | Prefer repo config (`netlify.toml`, `vercel.json`, `next.config`) via codebase search first. Hosting MCP: explain proposed changes and get user approval before any live change. |
| `cms-studio` | CMS MCP: inspect only until the user approves. Then apply only the agreed document/field updates — never edit CMS content silently. |
| `dns-panel` | Manual DNS/registrar change — document steps in the PR, do not guess record values. |
| `manual` | Do not auto-fix — explain required human action in the PR. |

`searchHints` are **starting points**, not guaranteed paths. Always confirm files exist in the
project before editing. Mention which files you found and chose in **Changes**.

For template fixes, search using the `<meta name="template">` value from the work package.

## Pull request title

Use conventional commits, scoped to this package:

```text
fix(seo): <short description>
fix(a11y): <short description>
fix(infra): <short description>
chore(cms): <short description>
```

Use the `prTitle` from the work package when provided.

## Pull request description

Copy this structure exactly. Fill every section; omit nothing.

```markdown
## Flightcheck

- **Work package:** `{workPackageId}`
- **Issues addressed:** {comma-separated issue IDs with counts/scope from manifest}
- **Report:** {reportPath or link}

## Changes

- {One bullet per logical change — include the file path you found via codebase search and what you changed}

## How to verify

1. {Concrete step — e.g. checkout branch, open preview URL}
2. {What to inspect — view source, Studio field, Netlify headers, etc.}
3. Re-run flightcheck:
   `{flightcheckCommand}`
4. Confirm these issue IDs improved or cleared: `{issueIds}`

## Out of scope

- {Anything you intentionally did not fix, with package ID if known}

## Checklist

- [ ] Only files for this work package were changed
- [ ] No unrelated refactors or dependency updates
- [ ] Any CMS or hosting MCP changes were approved by the user before applying
- [ ] PR is compact and reviewable in under 10 minutes
- [ ] Verification steps are reproducible without reading the full audit report
```

## Code quality

- Match existing project conventions (imports, naming, metadata patterns).
- Prefer extending shared helpers (e.g. one SEO/metadata module) over duplicating tags per file.
- Add or update tests only when the project already tests the area you changed.

## When done

- Open **one** PR with the title and description above.
- Do not combine multiple work packages into a single PR.
- If the fix cannot be completed safely, open a draft PR explaining the blocker and what was tried.

# Agent fixes (deprecated)

**Status:** deprecated. Analyze no longer writes `*-fix-manifest.json` or
`*-agent-jobs/`.

Use the structured report instead:

- [Analyze reports](./analyze.md) — `*-report.json` + `*-report.md`
- [Design](./superpowers/specs/2026-10-27-structured-report-design.md)

The previous agent-jobs / fix-manifest workflow (work packages, `prompt.md` per
package, orchestrate helpers) may still exist in the source tree for reference, but
it is not part of the published package or default CLI output. Prefer building any
new agent automation on `findings[]` in `*-report.json`.

Stack detection still feeds the report `analysis.stack` block. See
[stack.md](./stack.md).

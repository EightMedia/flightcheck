import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const MAX_SAMPLE_URLS = 5;
const moduleDir = dirname(fileURLToPath(import.meta.url));
export function defaultPromptsDir() {
    // dist/orchestrate -> package root prompts/fix; src/orchestrate -> same
    return resolve(moduleDir, "..", "..", "prompts", "fix");
}
function readPromptFile(dir, name) {
    const filePath = join(dir, `${name}.md`);
    if (!existsSync(filePath))
        return null;
    return readFileSync(filePath, "utf8").trim();
}
/** The shared base instructions, written once to BASE.md at the agent-jobs root. */
export function readBasePrompt(promptsDir = defaultPromptsDir()) {
    return readPromptFile(promptsDir, "_base") ?? "";
}
/**
 * Compact, readable issue summary. Site-wide issues (with a `count`) are listed directly.
 * Page-specific issues (one row per URL) are grouped by id with a count and a few sample
 * URLs — the full per-URL list lives in package.json so the prompt stays small enough to read.
 */
function formatIssueList(issues) {
    const direct = issues.filter((issue) => !issue.urls || issue.urls.length === 0);
    const perUrl = issues.filter((issue) => issue.urls && issue.urls.length > 0);
    const lines = [];
    for (const issue of direct) {
        const count = issue.count ? ` (${issue.count} pages, ${issue.scope})` : ` (${issue.scope})`;
        lines.push(`- **${issue.id}** [${issue.severity}]${count}: ${issue.todo}`);
    }
    if (perUrl.length > 0) {
        const groups = new Map();
        for (const issue of perUrl) {
            const group = groups.get(issue.id) ?? { id: issue.id, severity: issue.severity, todo: issue.todo, urls: [] };
            group.urls.push(...(issue.urls ?? []));
            groups.set(issue.id, group);
        }
        for (const group of groups.values()) {
            const samples = group.urls.slice(0, MAX_SAMPLE_URLS);
            const extra = group.urls.length - samples.length;
            const sampleLines = samples.map((url) => `  - ${url}`).join("\n");
            const more = extra > 0 ? `\n  - …and ${extra} more (full list in \`package.json\`)` : "";
            lines.push(`- **${group.id}** [${group.severity}] (${group.urls.length} page(s)): ${group.todo}\n${sampleLines}${more}`);
        }
    }
    return lines.join("\n");
}
function formatStack(manifest) {
    if (manifest.stack.length === 0)
        return "- No stack detections in this manifest.";
    return manifest.stack
        .map((entry) => `- **${entry.name}** (${entry.confidence}, ${entry.scope}) — ${entry.categories.join(", ")}`)
        .join("\n");
}
function buildFlightcheckCommand(siteUrl) {
    // Flightcheck is its own package and usually is NOT a script in the site repo, so do not
    // emit `pnpm run flightcheck` here — run the published binary from wherever it is installed.
    const target = siteUrl ?? "<site-url>";
    return `npx @eightmedia/flightcheck ${target} --checks crawl,analyze`;
}
export function composeAgentPrompt(manifest, workPackage, options = {}) {
    const promptsDir = options.promptsDir ?? defaultPromptsDir();
    const projectPromptsDir = options.projectPromptsDir;
    const sections = [];
    // Shared rules live once in BASE.md at the agent-jobs root (written by writeAgentJobs).
    // Reference it instead of inlining ~120 lines into every package prompt.
    sections.push([
        `# Fix \`${workPackage.id}\``,
        "",
        "**Before you start, read [`../BASE.md`](../BASE.md)** — it defines the rules that apply to every",
        "package (scope discipline, the CMS/hosting approval flow, PR title and description format).",
        "This file only adds what is specific to this package.",
    ].join("\n"));
    const domain = readPromptFile(promptsDir, workPackage.promptId) ??
        (projectPromptsDir ? readPromptFile(projectPromptsDir, workPackage.promptId) : null);
    if (domain) {
        sections.push(domain);
    }
    else {
        sections.push(`## Domain guidance\n\nNo dedicated prompt file for \`${workPackage.promptId}\`. Use the work package details below and project conventions.`);
    }
    if (projectPromptsDir) {
        const override = readPromptFile(projectPromptsDir, workPackage.promptId);
        if (override) {
            sections.push(`## Project-specific override\n\n${override}`);
        }
    }
    const mcpLine = workPackage.mcpServers.length > 0
        ? workPackage.mcpServers.join(", ")
        : "none (codebase only)";
    sections.push([
        "## Work package",
        "",
        `- **ID:** \`${workPackage.id}\``,
        `- **PR title:** \`${workPackage.prTitle}\``,
        `- **Scope:** ${workPackage.scope}`,
        workPackage.template ? `- **Template:** \`${workPackage.template}\`` : "",
        `- **Fix surface:** ${workPackage.fixSurface}`,
        `- **Location discovery:** ${workPackage.locationDiscovery}`,
        `- **MCP servers (if available):** ${mcpLine}`,
        "",
        "### Issues to fix",
        "",
        formatIssueList(workPackage.issues),
        "",
        "### Search hints",
        "",
        ...workPackage.searchHints.map((hint) => `- ${hint}`),
        "",
        "### Detected stack",
        "",
        formatStack(manifest),
        "",
        "### References",
        "",
        `- Full issue list with every URL: \`package.json\` (in this folder)`,
        `- Report: \`${basename(manifest.reportPath)}\` (in the flightcheck output)`,
        "",
        "### Verification command",
        "",
        "```bash",
        buildFlightcheckCommand(options.siteUrl),
        "```",
        "",
        "Replace issue IDs in the PR description with those listed above.",
    ]
        .filter((line) => line !== "")
        .join("\n"));
    return {
        workPackageId: workPackage.id,
        promptId: workPackage.promptId,
        autoFixable: workPackage.autoFixable,
        markdown: `${sections.join("\n\n")}\n`,
    };
}
export function composeAllAgentPrompts(manifest, options = {}) {
    return manifest.workPackages.map((workPackage) => composeAgentPrompt(manifest, workPackage, options));
}

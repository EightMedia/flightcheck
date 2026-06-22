import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
function formatIssueList(issues) {
    return issues
        .map((issue) => {
        const count = issue.count ? ` (${issue.count} pages, ${issue.scope})` : ` (${issue.scope})`;
        const urls = issue.urls?.length ? `\n  - URLs: ${issue.urls.join(", ")}` : "";
        return `- **${issue.id}** [${issue.severity}]${count}: ${issue.todo}${urls}`;
    })
        .join("\n");
}
function formatStack(manifest) {
    if (manifest.stack.length === 0)
        return "- No stack detections in this manifest.";
    return manifest.stack
        .map((entry) => `- **${entry.name}** (${entry.confidence}, ${entry.scope}) — ${entry.categories.join(", ")}`)
        .join("\n");
}
function buildFlightcheckCommand(siteUrl) {
    if (siteUrl) {
        return `pnpm run flightcheck -- ${siteUrl} --checks crawl,analyze`;
    }
    return "pnpm run flightcheck -- <site-url> --checks crawl,analyze";
}
export function composeAgentPrompt(manifest, workPackage, options = {}) {
    const promptsDir = options.promptsDir ?? defaultPromptsDir();
    const projectPromptsDir = options.projectPromptsDir;
    const sections = [];
    const base = readPromptFile(promptsDir, "_base");
    if (base)
        sections.push(base);
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
        `- Report: \`${manifest.reportPath}\``,
        `- Manifest source: \`${manifest.source}\``,
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

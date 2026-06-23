import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { defaultAgentJobsPathForInput } from "../crawler/outputPaths.js";
import { composeAgentPrompt, readBasePrompt } from "./composePrompt.js";
function defaultOutputDirForManifest(manifestPath) {
    return defaultAgentJobsPathForInput(manifestPath);
}
function buildReadme(manifest, summary) {
    const lines = [
        "# Flightcheck agent jobs",
        "",
        "This folder was generated from a flightcheck fix manifest. Each subfolder is **one pull request**.",
        "",
        "## What to do",
        "",
        "1. Open your **site repo** in your agent tool (Claude Code, Cursor, …).",
        "2. Read [`BASE.md`](./BASE.md) once — the shared rules for every package.",
        "3. Read [`PLAN.md`](./PLAN.md) for the recommended order (site-wide first, then page-level).",
        "4. Point the agent at a package folder and let it read that folder's `prompt.md`.",
        "5. Review the PR it proposes — one package = one PR.",
        "6. After merge, re-run flightcheck and move to the next package.",
        "",
        "Packages marked manual need a human (DNS panel, secret rotation, etc.) — see `MANUAL.md` in those folders.",
        `Crawled URLs that are not real pages are listed in [\`REVIEW.md\`](./REVIEW.md) — investigate, do not auto-fix.`,
        "",
        "## Packages",
        "",
    ];
    for (const pkg of summary.packages) {
        const label = pkg.autoFixable ? "agent" : "manual";
        lines.push(`- \`${pkg.id}\` (${label}) — \`${pkg.promptPath}\``);
    }
    lines.push("", "## Source", "", `- Manifest: \`${manifest.source}\``, `- Report: \`${manifest.reportPath}\``, `- Generated: ${manifest.generatedAt}`, `- Auto-fixable: ${summary.autoFixableCount}`, `- Manual: ${summary.manualCount}`, "");
    return lines.join("\n");
}
const SURFACE_NOTE = {
    repo: "code change in the site repo",
    hosting: "hosting/deploy config (vercel.json, netlify.toml, next.config) — confirm before live dashboard edits",
    cms: "CMS content — inspect only, propose values, and get approval before any write",
    dns: "manual DNS/registrar change",
    manual: "manual action by a human",
};
function buildPlan(manifest, summary) {
    const byId = new Map(manifest.workPackages.map((wp) => [wp.id, wp]));
    const lines = [
        "# Fix plan",
        "",
        "Recommended order. **Site-wide and template packages first** — they clear the same issue across",
        "many pages, so doing them first shrinks (or empties) the page-level packages. After each merge,",
        "**re-run flightcheck and regenerate this folder** before starting the next package, so page-level",
        "lists reflect what is actually left.",
        "",
        "| Order | Package | Surface | Auto | Issues | Notes |",
        "| --- | --- | --- | --- | --- | --- |",
    ];
    summary.packages.forEach((pkg, index) => {
        const wp = byId.get(pkg.id);
        const surface = wp?.fixSurface ?? "repo";
        const issueCount = wp?.issues.length ?? 0;
        const auto = pkg.autoFixable ? "yes" : "manual";
        lines.push(`| ${index + 1} | \`${pkg.id}\` | ${surface} | ${auto} | ${issueCount} | ${SURFACE_NOTE[surface] ?? ""} |`);
    });
    lines.push("", "## Dependencies", "", "- Do **site-wide** SEO/best-practice/a11y packages before their **page-level** counterparts.", "- **cms-content** depends on nothing in the repo but needs CMS access and user approval.", "- **infra** packages (headers, robots/sitemap, DNS) are independent and can go in any order.", "", `Re-run after each merge: \`npx @eightmedia/flightcheck ${manifest.reportPath ? "<site-url>" : "<site-url>"} --checks crawl,analyze\``, "");
    return lines.join("\n");
}
function buildReview(manifest) {
    const lines = [
        "# Review — crawled URLs that are not fixable pages",
        "",
        "These URLs were reached by the crawler but returned non-200 (404, auth error, or fetch error),",
        "or look like mis-parsed links (emails, phone numbers, dynamic-route placeholders). **Do not add",
        "metadata or h1s to these** — instead find where they are linked and fix or remove the link, or",
        "confirm they are expected.",
        "",
    ];
    if (manifest.reviewItems.length === 0) {
        lines.push("_No review items — every crawled URL returned 200._", "");
        return lines.join("\n");
    }
    lines.push("| URL | Status | Why it is here |", "| --- | --- | --- |");
    for (const item of manifest.reviewItems) {
        const status = item.status === null ? "error" : String(item.status);
        lines.push(`| \`${item.url}\` | ${status} | ${item.reason} |`);
    }
    lines.push("");
    return lines.join("\n");
}
export function writeAgentJobs(manifest, options = {}) {
    const outputDir = resolve(options.outputDir ?? (options.manifestPath ? defaultOutputDirForManifest(options.manifestPath) : "./flightcheck-agent-jobs"));
    const projectPromptsDir = options.projectRepo
        ? join(resolve(options.projectRepo), ".flightcheck", "prompts")
        : undefined;
    mkdirSync(outputDir, { recursive: true });
    const packages = [];
    for (const workPackage of manifest.workPackages) {
        const packageDir = join(outputDir, workPackage.id);
        mkdirSync(packageDir, { recursive: true });
        const composed = composeAgentPrompt(manifest, workPackage, {
            promptsDir: options.promptsDir,
            projectPromptsDir,
            siteUrl: options.siteUrl,
        });
        if (workPackage.autoFixable) {
            const promptPath = join(packageDir, "prompt.md");
            writeFileSync(promptPath, composed.markdown, "utf8");
            packages.push({ id: workPackage.id, autoFixable: true, promptPath: `${workPackage.id}/prompt.md` });
        }
        else {
            const manualPath = join(packageDir, "MANUAL.md");
            const manual = [
                "# Manual action required",
                "",
                `Work package \`${workPackage.id}\` is not auto-fixable by a code agent.`,
                "",
                "## Why",
                "",
                `- Fix surface: ${workPackage.fixSurface}`,
                `- Location: ${workPackage.locationDiscovery}`,
                "",
                "## Issues",
                "",
                ...workPackage.issues.map((issue) => `- **${issue.id}**: ${issue.todo}`),
                "",
                "## Suggested steps",
                "",
                ...workPackage.searchHints.map((hint) => `- ${hint}`),
                "",
            ].join("\n");
            writeFileSync(manualPath, manual, "utf8");
            packages.push({ id: workPackage.id, autoFixable: false, promptPath: `${workPackage.id}/MANUAL.md` });
        }
        writeFileSync(join(packageDir, "package.json"), `${JSON.stringify(workPackage, null, 2)}\n`, "utf8");
    }
    const summary = {
        outputDir,
        autoFixableCount: packages.filter((pkg) => pkg.autoFixable).length,
        manualCount: packages.filter((pkg) => !pkg.autoFixable).length,
        packages,
    };
    const basePrompt = readBasePrompt(options.promptsDir);
    if (basePrompt) {
        writeFileSync(join(outputDir, "BASE.md"), `${basePrompt}\n`, "utf8");
    }
    writeFileSync(join(outputDir, "PLAN.md"), buildPlan(manifest, summary), "utf8");
    writeFileSync(join(outputDir, "REVIEW.md"), buildReview(manifest), "utf8");
    writeFileSync(join(outputDir, "README.md"), buildReadme(manifest, summary), "utf8");
    writeFileSync(join(outputDir, "summary.json"), `${JSON.stringify({ manifest: { source: manifest.source, reportPath: manifest.reportPath }, ...summary }, null, 2)}\n`, "utf8");
    return summary;
}
export { defaultOutputDirForManifest };

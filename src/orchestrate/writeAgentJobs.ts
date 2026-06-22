import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { FixManifest } from "../analyze/fixManifest.js";
import { composeAgentPrompt } from "./composePrompt.js";

export type WriteAgentJobsOptions = {
  outputDir: string;
  promptsDir?: string;
  projectRepo?: string;
  siteUrl?: string;
};

export type AgentJobSummary = {
  outputDir: string;
  autoFixableCount: number;
  manualCount: number;
  packages: Array<{ id: string; autoFixable: boolean; promptPath: string }>;
};

function defaultOutputDirForManifest(manifestPath: string): string {
  if (manifestPath.endsWith("-fix-manifest.json")) {
    return `${manifestPath.slice(0, -"-fix-manifest.json".length)}-agent-jobs`;
  }
  return `${manifestPath}-agent-jobs`;
}

function buildReadme(manifest: FixManifest, summary: AgentJobSummary): string {
  const lines = [
    "# Flightcheck agent jobs",
    "",
    "This folder was generated from a flightcheck fix manifest. Each subfolder is **one pull request**.",
    "",
    "## What to do",
    "",
    "1. Open your **site repo** in Cursor (or your agent tool).",
    "2. For each auto-fixable package below, open `prompt.md` in that package folder.",
    "3. Start a **new agent chat**, paste the full `prompt.md` contents, and let it work.",
    "4. Review the PR it proposes — one package = one PR.",
    "5. After merge, re-run flightcheck and move to the next package.",
    "",
    "Packages marked manual need a human (DNS panel, secret rotation, etc.) — see `MANUAL.md` in those folders.",
    "",
    "## Packages",
    "",
  ];

  for (const pkg of summary.packages) {
    const label = pkg.autoFixable ? "agent" : "manual";
    lines.push(`- \`${pkg.id}\` (${label}) — \`${pkg.promptPath}\``);
  }

  lines.push(
    "",
    "## Source",
    "",
    `- Manifest: \`${manifest.source}\``,
    `- Report: \`${manifest.reportPath}\``,
    `- Generated: ${manifest.generatedAt}`,
    `- Auto-fixable: ${summary.autoFixableCount}`,
    `- Manual: ${summary.manualCount}`,
    ""
  );

  return lines.join("\n");
}

export function writeAgentJobs(manifest: FixManifest, options: Partial<WriteAgentJobsOptions> & { manifestPath?: string } = {}): AgentJobSummary {
  const outputDir = resolve(options.outputDir ?? (options.manifestPath ? defaultOutputDirForManifest(options.manifestPath) : "./flightcheck-agent-jobs"));
  const projectPromptsDir = options.projectRepo
    ? join(resolve(options.projectRepo), ".flightcheck", "prompts")
    : undefined;

  mkdirSync(outputDir, { recursive: true });

  const packages: AgentJobSummary["packages"] = [];

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
    } else {
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

  const summary: AgentJobSummary = {
    outputDir,
    autoFixableCount: packages.filter((pkg) => pkg.autoFixable).length,
    manualCount: packages.filter((pkg) => !pkg.autoFixable).length,
    packages,
  };

  writeFileSync(join(outputDir, "README.md"), buildReadme(manifest, summary), "utf8");
  writeFileSync(
    join(outputDir, "summary.json"),
    `${JSON.stringify({ manifest: { source: manifest.source, reportPath: manifest.reportPath }, ...summary }, null, 2)}\n`,
    "utf8"
  );

  return summary;
}

export { defaultOutputDirForManifest };

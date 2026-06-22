#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { Command } from "commander";
import type { FixManifest } from "./analyze/fixManifest.js";
import { FIX_MANIFEST_VERSION } from "./analyze/fixManifest.js";
import { writeAgentJobs } from "./orchestrate/writeAgentJobs.js";

function loadManifest(path: string): FixManifest {
  const raw = JSON.parse(readFileSync(path, "utf8")) as FixManifest;
  if (raw.version !== FIX_MANIFEST_VERSION) {
    throw new Error(`Unsupported manifest version: ${String(raw.version)}`);
  }
  if (!Array.isArray(raw.workPackages)) {
    throw new Error("Invalid manifest: missing workPackages array.");
  }
  return raw;
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .name("flightcheck-orchestrate")
    .description(
      "Turn a fix-manifest.json into per-package agent prompts (one folder per PR)."
    )
    .argument("<manifest>", "Path to *-fix-manifest.json from flightcheck analyze")
    .option("--output <dir>", "Output directory for agent job folders")
    .option("--repo <path>", "Site repo path (loads .flightcheck/prompts/ overrides if present)")
    .option("--site-url <url>", "Site URL for the verification command in prompts")
    .action((manifestArg: string, options: { output?: string; repo?: string; siteUrl?: string }) => {
      const manifestPath = resolve(manifestArg);
      const manifest = loadManifest(manifestPath);
      const summary = writeAgentJobs(manifest, {
        manifestPath,
        outputDir: options.output ? resolve(options.output) : undefined,
        projectRepo: options.repo ? resolve(options.repo) : undefined,
        siteUrl: options.siteUrl,
      });

      process.stdout.write(
        `${JSON.stringify(
          {
            message: "Agent jobs written",
            manifest: basename(manifestPath),
            outputDir: summary.outputDir,
            autoFixable: summary.autoFixableCount,
            manual: summary.manualCount,
            packages: summary.packages,
            nextStep:
              "Open README.md in the output folder — paste each prompt.md into a separate Cursor agent chat.",
          },
          null,
          2
        )}\n`
      );
    });

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildMarkdown, parseReport } from "../analyze/report.js";
import { buildStackProfile } from "../analyze/stack.js";
import { defaultReportPathForInput, defaultManifestPathForInput, defaultAgentJobsPathForInput } from "../crawler/outputPaths.js";
import { buildFixManifest } from "../analyze/fixManifest.js";
import { writeAgentJobs } from "../orchestrate/writeAgentJobs.js";
function loadRecords(options) {
    if (options.records !== undefined) {
        return {
            records: options.records,
            inputPath: options.inputPath ?? "in-memory-crawl.json",
        };
    }
    if (!options.inputPath) {
        throw new Error("Analyze check requires crawl records or an inputPath to an existing JSON report.");
    }
    const inputPath = resolve(options.inputPath);
    const raw = readFileSync(inputPath, "utf8");
    const json = JSON.parse(raw);
    return {
        records: parseReport(json),
        inputPath,
    };
}
function resolveSiteUrl(options, records) {
    if (options.siteUrl)
        return options.siteUrl;
    return records[0]?.url;
}
export async function runAnalyzeCheck(options) {
    const { records, inputPath } = loadRecords(options);
    const reportPath = resolve(options.reportPath ?? defaultReportPathForInput(inputPath));
    const manifestPath = resolve(options.manifestPath ?? defaultManifestPathForInput(inputPath));
    const agentJobsPath = resolve(options.agentJobsPath ?? defaultAgentJobsPathForInput(inputPath));
    const redirectOnly = options.redirectOnly ?? false;
    const stackProfile = redirectOnly
        ? { detections: [], tracking: { tagManager: [], analytics: [] } }
        : buildStackProfile(records, {
            securityHeaders: options.tier1?.securityHeaders,
            dns: options.tier1?.dns,
            robotsTxt: options.tier1?.robotsTxt,
        });
    const markdown = await buildMarkdown(inputPath, records, options.errorsOnly ?? false, options.tier1, {
        redirectOnly,
        stackProfile,
    });
    const manifest = await buildFixManifest(inputPath, records, options.tier1, {
        redirectOnly,
        reportPath,
        stackProfile,
    });
    if (options.writeReport !== false) {
        mkdirSync(dirname(reportPath), { recursive: true });
        writeFileSync(reportPath, markdown, "utf8");
    }
    if (options.writeManifest !== false) {
        mkdirSync(dirname(manifestPath), { recursive: true });
        writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    }
    let agentJobs;
    if (options.writeAgentJobs !== false && options.writeManifest !== false) {
        agentJobs = writeAgentJobs(manifest, {
            manifestPath,
            outputDir: agentJobsPath,
            projectRepo: options.projectRepo,
            siteUrl: resolveSiteUrl(options, records),
        });
    }
    return {
        inputPath,
        reportPath,
        manifestPath,
        agentJobsPath: agentJobs?.outputDir ?? agentJobsPath,
        agentJobs,
        markdown,
        manifest,
        pagesAnalyzed: records.length,
    };
}

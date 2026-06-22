import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildMarkdown, parseReport } from "../analyze/report.js";
import { defaultReportPathForInput } from "../crawler/outputPaths.js";
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
export async function runAnalyzeCheck(options) {
    const { records, inputPath } = loadRecords(options);
    const reportPath = resolve(options.reportPath ?? defaultReportPathForInput(inputPath));
    const markdown = buildMarkdown(inputPath, records, options.errorsOnly ?? false, options.tier1, {
        redirectOnly: options.redirectOnly ?? false,
    });
    if (options.writeReport !== false) {
        mkdirSync(dirname(reportPath), { recursive: true });
        writeFileSync(reportPath, markdown, "utf8");
    }
    return {
        inputPath,
        reportPath,
        markdown,
        pagesAnalyzed: records.length,
    };
}

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseReport, type ReportRecord, type Tier1ReportData } from "../analyze/report.js";
import { buildStackProfile } from "../analyze/stack.js";
import {
  buildStructuredReport,
  renderReportMarkdown,
  type FlightcheckReport,
} from "../analyze/structuredReport.js";
import {
  defaultReportJsonPathForInput,
  defaultReportPathForInput,
} from "../crawler/outputPaths.js";
import type { AnalyzeCheckResult } from "./types.js";

export type AnalyzeCheckOptions = {
  records?: ReportRecord[];
  inputPath?: string;
  reportPath?: string;
  reportJsonPath?: string;
  siteUrl?: string;
  errorsOnly?: boolean;
  writeReport?: boolean;
  redirectOnly?: boolean;
  tier1?: Tier1ReportData;
};

function loadRecords(options: AnalyzeCheckOptions): { records: ReportRecord[]; inputPath: string } {
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
  const json = JSON.parse(raw) as unknown;
  return {
    records: parseReport(json),
    inputPath,
  };
}

export async function runAnalyzeCheck(options: AnalyzeCheckOptions): Promise<AnalyzeCheckResult> {
  const { records, inputPath } = loadRecords(options);
  const reportPath = resolve(options.reportPath ?? defaultReportPathForInput(inputPath));
  const reportJsonPath = resolve(options.reportJsonPath ?? defaultReportJsonPathForInput(inputPath));
  const redirectOnly = options.redirectOnly ?? false;
  const stackProfile = redirectOnly
    ? { detections: [], tracking: { tagManager: [], analytics: [] } }
    : buildStackProfile(records, {
        securityHeaders: options.tier1?.securityHeaders,
        dns: options.tier1?.dns,
        robotsTxt: options.tier1?.robotsTxt,
      });

  const report: FlightcheckReport = await buildStructuredReport(inputPath, records, options.tier1, {
    redirectOnly,
    stackProfile,
  });

  // errorsOnly currently filters only the Markdown presentation of page-level noise;
  // the structured JSON keeps the full finding set for machine consumers.
  const markdown = renderReportMarkdown(
    options.errorsOnly
      ? {
          ...report,
          findings: report.findings.filter((finding) => finding.severity === "critical" || finding.severity === "error"),
        }
      : report
  );

  if (options.writeReport !== false) {
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, markdown, "utf8");
    mkdirSync(dirname(reportJsonPath), { recursive: true });
    writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  return {
    inputPath,
    reportPath,
    reportJsonPath,
    markdown,
    report,
    pagesAnalyzed: records.length,
  };
}

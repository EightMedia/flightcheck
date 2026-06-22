export * from "./checks/index.js";

export { buildMarkdown, parseReport, reportSchema, buildReportAnalysis } from "./analyze/report.js";
export { buildFixManifest, FIX_MANIFEST_VERSION } from "./analyze/fixManifest.js";
export type { ReportRecord, Tier1ReportData, BuildMarkdownOptions, ReportAnalysis } from "./analyze/report.js";
export type {
  FixManifest,
  WorkPackage,
  ManifestIssue,
  LocationDiscovery,
  FixSurface,
} from "./analyze/fixManifest.js";
export { runCrawler } from "./crawler/runCrawler.js";
export type { VerificationRecord } from "./crawler/schema.js";
export { CHECK_GROUPS, resolveActiveGroups } from "./crawler/checkGroups.js";
export type { CheckGroup } from "./crawler/checkGroups.js";

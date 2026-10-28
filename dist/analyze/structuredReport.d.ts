import type { CheckIssueSeverity } from "../checks/issues.js";
import { type BuildMarkdownOptions, type ReportRecord, type Tier1ReportData } from "./report.js";
export declare const FLIGHTCHECK_REPORT_VERSION: 1;
export type FindingSeverity = CheckIssueSeverity;
export type FindingCategory = "infra" | "seo" | "a11y" | "best-practices" | "security" | "performance";
export type FindingScope = "site-wide" | "template" | "page" | "origin";
export type ReportStackEntry = {
    name: string;
    categories: string[];
    confidence: string;
    evidence: string[];
    pageCount?: number;
};
export type ReportFinding = {
    id: string;
    severity: FindingSeverity;
    category: FindingCategory;
    scope: FindingScope;
    title: string;
    message: string;
    /** Concrete remediation suggestion when available. */
    fix?: string;
    template?: string;
    urls?: string[];
    count?: number;
};
export type ReportReviewPage = {
    url: string;
    status: number | null;
    reason: string;
};
export type FlightcheckReportAnalysis = {
    pagesAnalyzed: number;
    pagesWithIssues: number;
    findingCounts: Record<FindingSeverity, number>;
    stack: ReportStackEntry[];
    templates: string[];
    dns?: {
        hostname: string;
        summary: string[];
    };
    redirect?: {
        url: string;
        status: number | null;
        location: string | null;
        issueCount: number;
    };
    reviewPages: ReportReviewPage[];
};
export type FlightcheckReport = {
    /** Report JSON schema version (not the npm package version). */
    version: typeof FLIGHTCHECK_REPORT_VERSION;
    /** npm package version of Flightcheck that produced this report. */
    flightcheckVersion: string;
    /** CLI argv flags used for this run (after node/script); empty when programmatic without flags. */
    flags: string[];
    generatedAt: string;
    source: string;
    redirectOnly: boolean;
    analysis: FlightcheckReportAnalysis;
    findings: ReportFinding[];
};
export type BuildStructuredReportOptions = BuildMarkdownOptions & {
    generatedAt?: string;
    flightcheckVersion?: string;
    flags?: string[];
};
export declare function buildStructuredReport(sourcePath: string, records: ReportRecord[], tier1?: Tier1ReportData, options?: BuildStructuredReportOptions): Promise<FlightcheckReport>;
/** Human-friendly Markdown rendered from the structured report (single source of truth). */
export declare function renderReportMarkdown(report: FlightcheckReport): string;
//# sourceMappingURL=structuredReport.d.ts.map
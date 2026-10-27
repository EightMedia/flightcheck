import { type CheckIssue } from "./issues.js";
export type AnalyzeRobotsTxtInput = {
    url: string;
    status: number | null;
    body?: string;
};
export type RobotsTxtCheckResult = {
    url: string;
    status: number | null;
    body?: string;
    sitemapUrls: string[];
    issues: CheckIssue[];
};
export declare function analyzeRobotsTxt(input: AnalyzeRobotsTxtInput): RobotsTxtCheckResult;
export declare function runRobotsTxtCheck(startUrl: string, timeoutMs?: number): Promise<RobotsTxtCheckResult>;
//# sourceMappingURL=robots-txt.d.ts.map
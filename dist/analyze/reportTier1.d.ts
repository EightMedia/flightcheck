import type { AgentReadyCheckResult } from "../checks/agent-ready.js";
import type { DnsCheckResult } from "../checks/dns.js";
import type { RedirectCheckResult } from "../checks/redirect.js";
import type { RobotsTxtCheckResult } from "../checks/robots-txt.js";
import type { SecurityHeadersCheckResult } from "../checks/security-headers.js";
import type { SitemapCheckResult } from "../checks/sitemap.js";
export type Tier1ReportData = {
    redirect?: RedirectCheckResult;
    securityHeaders?: SecurityHeadersCheckResult;
    dns?: DnsCheckResult;
    robotsTxt?: RobotsTxtCheckResult;
    sitemap?: SitemapCheckResult;
    agentReady?: AgentReadyCheckResult;
};
export type BuildMarkdownOptions = {
    redirectOnly?: boolean;
    stackProfile?: import("./stack.js").StackProfile;
};
export declare function buildRedirectSection(result: RedirectCheckResult): string[];
export declare function buildDnsSection(dns: DnsCheckResult): string[];
export declare function buildSecurityHeadersSection(result: SecurityHeadersCheckResult): string[];
export declare function buildRobotsTxtSection(result: RobotsTxtCheckResult): string[];
export declare function buildSitemapSection(result: SitemapCheckResult): string[];
export declare function buildRobotsAndSitemapSection(robotsTxt?: RobotsTxtCheckResult, sitemap?: SitemapCheckResult): string[];
export declare function buildAgentReadySection(result: AgentReadyCheckResult): string[];
export declare function countTier1InfraIssues(tier1: Tier1ReportData): number;
export type CrawlIssueCounts = {
    seo: {
        issueCount: number;
        pageCount: number;
    };
    a11y: {
        issueCount: number;
        pageCount: number;
    };
    bestPractices: {
        issueCount: number;
        pageCount: number;
    };
    security: {
        issueCount: number;
        pageCount: number;
    };
};
export declare function buildIssuesSummarySection(tier1: Tier1ReportData, crawlCounts: CrawlIssueCounts, redirectOnly: boolean, performanceChecked?: boolean, performanceIssueCount?: number, performancePageCount?: number): string[];
//# sourceMappingURL=reportTier1.d.ts.map
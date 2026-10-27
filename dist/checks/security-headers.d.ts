import { type CheckIssue } from "./issues.js";
export type AnalyzeSecurityHeadersOptions = {
    isHttps?: boolean;
};
export declare function analyzeSecurityHeaders(headers: Headers, options?: AnalyzeSecurityHeadersOptions): CheckIssue[];
export type SecurityHeadersCheckResult = {
    url: string;
    headers: Record<string, string>;
    issues: CheckIssue[];
};
export declare function runSecurityHeadersCheck(startUrl: string): Promise<SecurityHeadersCheckResult>;
//# sourceMappingURL=security-headers.d.ts.map
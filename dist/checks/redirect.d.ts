import { type CheckIssue } from "./issues.js";
import type { CheckId } from "./types.js";
export declare const REDIRECT_STATUS_CODES: Set<number>;
export declare const PERMANENT_REDIRECT_STATUS_CODES: Set<number>;
export type RedirectProbeInput = {
    url: string;
    status: number | null;
    location: string | null;
    resolvedTarget: string | null;
    headers: Record<string, string>;
    targetStatus: number | null;
};
export type WwwAliasRedirectProbe = {
    canonicalUrl: string;
    alternateUrl: string;
    status: number | null;
    location: string | null;
    resolvedTarget: string | null;
    targetStatus: number | null;
};
export type RedirectCheckResult = RedirectProbeInput & {
    isRedirect: boolean;
    redirectOnly: boolean;
    issues: CheckIssue[];
    wwwAlias?: WwwAliasRedirectProbe;
};
export declare function toggleWwwHostname(hostname: string): string;
export declare function buildAlternateHostUrl(url: string): string;
export declare function resolveCanonicalUrl(startUrl: string, probe: Pick<RedirectProbeInput, "resolvedTarget">): string;
export declare function shouldCheckWwwAlias(hostname: string): boolean;
export declare const REDIRECT_ONLY_CHECK_IDS: CheckId[];
export declare function analyzeRedirect(input: RedirectProbeInput): RedirectCheckResult;
export declare function analyzeWwwAliasRedirect(canonicalUrl: string, probe: Pick<RedirectProbeInput, "url" | "status" | "location" | "resolvedTarget" | "targetStatus">): CheckIssue[];
export declare function isDefaultCheckSet(requestedChecks: CheckId[]): boolean;
export declare function resolveChecksForRedirect(requestedChecks: CheckId[], redirect: Pick<RedirectCheckResult, "redirectOnly">): CheckId[];
export declare function checksSkippedByRedirect(requestedChecks: CheckId[], effectiveChecks: CheckId[]): CheckId[];
export declare function runRedirectCheck(startUrl: string, timeoutMs?: number): Promise<RedirectCheckResult>;
//# sourceMappingURL=redirect.d.ts.map
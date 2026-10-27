import type { StackProfile } from "./stack.js";
import type { Tier1ReportData } from "./reportTier1.js";
import type { ReportRecord } from "./report.js";
import { defaultManifestPathForInput } from "../crawler/outputPaths.js";
export declare const FIX_MANIFEST_VERSION: 1;
export type LocationDiscovery = "search-codebase" | "hosting-panel" | "dns-panel" | "cms-studio" | "manual";
export type FixSurface = "repo" | "hosting" | "cms" | "dns" | "manual";
export type ManifestStackEntry = {
    name: string;
    categories: string[];
    confidence: string;
    scope: string;
    evidence: string[];
};
export type ManifestIssue = {
    id: string;
    severity: string;
    scope: string;
    count?: number;
    todo: string;
    urls?: string[];
};
/**
 * A crawled URL that is not a real fixable page (404/401/error — often emails, phone
 * numbers, or dynamic-route placeholders crawled as paths). Surfaced for human review
 * instead of generating "add metadata" todos against pages that do not exist.
 */
export type ReviewItem = {
    url: string;
    status: number | null;
    reason: string;
};
export type WorkPackage = {
    id: string;
    promptId: string;
    fixSurface: FixSurface;
    priority: number;
    scope: string;
    template?: string;
    issues: ManifestIssue[];
    locationDiscovery: LocationDiscovery;
    searchHints: string[];
    mcpServers: string[];
    prTitle: string;
    autoFixable: boolean;
};
export type FixManifest = {
    version: typeof FIX_MANIFEST_VERSION;
    generatedAt: string;
    source: string;
    reportPath: string;
    redirectOnly: boolean;
    stack: ManifestStackEntry[];
    workPackages: WorkPackage[];
    /** Non-200 crawled URLs that should be investigated, not auto-fixed. */
    reviewItems: ReviewItem[];
};
export type BuildFixManifestOptions = {
    redirectOnly?: boolean;
    reportPath?: string;
    stackProfile?: StackProfile;
};
export declare function buildFixManifest(sourcePath: string, records: ReportRecord[], tier1?: Tier1ReportData, options?: BuildFixManifestOptions): Promise<FixManifest>;
export { defaultManifestPathForInput };
//# sourceMappingURL=fixManifest.d.ts.map
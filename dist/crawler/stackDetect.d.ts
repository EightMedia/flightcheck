export type StackCategory = "Platform" | "Framework" | "CMS" | "Search" | "Hosting" | "CDN";
export type StackDetection = {
    name: string;
    categories: string[];
    confidence: "high" | "medium" | "low";
    evidence: string[];
    website?: string;
    version?: string;
    detector?: "flightcheck-v1";
};
export declare function detectStackFromHtml(html: string, pageUrl: string): StackDetection[];
export declare function detectStackFromHeaders(headers: Record<string, string>): StackDetection[];
export declare function detectStackFromDns(records: {
    cname: string[];
    ns: string[];
    mx: Array<{
        exchange: string;
    }>;
    txt: string[];
}): StackDetection[];
export declare function detectStackFromRobots(_body: string): StackDetection[];
export declare const CURATED_STACK_NAMES: Set<string>;
export declare function isCuratedStackName(name: string): boolean;
//# sourceMappingURL=stackDetect.d.ts.map
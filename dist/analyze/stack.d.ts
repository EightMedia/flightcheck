import type { DnsCheckResult } from "../checks/dns.js";
import type { RobotsTxtCheckResult } from "../checks/robots-txt.js";
import type { SecurityHeadersCheckResult } from "../checks/security-headers.js";
import { type StackDetection } from "../crawler/stack.js";
import type { TrackingItem } from "../crawler/schema.js";
export type StackRecord = {
    url: string;
    stack?: {
        detections: StackDetection[];
    };
    tracking: {
        tagManager: TrackingItem[];
        analytics: TrackingItem[];
    };
};
export type AggregatedStackDetection = StackDetection & {
    pageCount: number;
};
export type StackProfile = {
    detections: AggregatedStackDetection[];
    tracking: {
        tagManager: TrackingItem[];
        analytics: TrackingItem[];
    };
};
export declare function aggregateStackFromRecords(records: StackRecord[]): StackProfile;
export declare function buildStackProfile(records: StackRecord[], options?: {
    securityHeaders?: SecurityHeadersCheckResult;
    dns?: DnsCheckResult;
    robotsTxt?: RobotsTxtCheckResult;
}): StackProfile;
export declare function buildStackSection(profile: StackProfile, totalPages: number): string[];
//# sourceMappingURL=stack.d.ts.map
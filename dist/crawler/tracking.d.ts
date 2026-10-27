import type { TrackingItem } from "./schema.js";
type TrackingResult = {
    tagManager: TrackingItem[];
    analytics: TrackingItem[];
};
export declare function extractTracking(html: string): TrackingResult;
export {};
//# sourceMappingURL=tracking.d.ts.map
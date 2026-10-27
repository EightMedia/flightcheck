import type { VerificationRecord } from "./schema.js";
export type CrawlState = {
    records: VerificationRecord[];
    interrupted: boolean;
};
export declare function createCrawlState(): CrawlState;
//# sourceMappingURL=crawlState.d.ts.map
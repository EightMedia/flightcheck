import { type CheckGroup } from "./checkGroups.js";
import type { VerificationRecord } from "./schema.js";
export type RunCrawlerOptions = {
    startUrl: string;
    outputPath: string;
    maxPages?: number;
    delayMs?: number;
    timeoutMs?: number;
    concurrency?: number;
    burstDelayMs?: number;
    seedUrls?: string[];
    excludePatterns?: string[];
    respectRobotsTxt?: boolean;
    activeGroups?: Set<CheckGroup>;
    revealSecrets?: boolean;
    quiet?: boolean;
};
export declare function runCrawler(options: RunCrawlerOptions): Promise<{
    records: VerificationRecord[];
    interrupted: boolean;
}>;
//# sourceMappingURL=runCrawler.d.ts.map
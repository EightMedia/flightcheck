import type { CheerioAPI } from "cheerio";
import type { CrawlIssue } from "./schema.js";
export declare function extractImageIssues($: CheerioAPI, pageUrl: string): CrawlIssue[];
export declare function extractA11yStaticIssues($: CheerioAPI): CrawlIssue[];
//# sourceMappingURL=tier1Extractors.d.ts.map
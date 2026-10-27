import { type VerificationRecord } from "./schema.js";
import { type CheckGroup } from "./checkGroups.js";
export declare function extractVerificationRecord(html: string, url: string, status: number | null, contentType: string, activeGroups?: Set<CheckGroup>): VerificationRecord;
export declare function extractInternalLinks(html: string, currentUrl: string, origin: string): Set<string>;
//# sourceMappingURL=extractors.d.ts.map
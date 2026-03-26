import type { VerificationRecord } from "./schema.js";

export type CrawlState = {
  records: VerificationRecord[];
  interrupted: boolean;
};

export function createCrawlState(): CrawlState {
  return {
    records: [],
    interrupted: false,
  };
}

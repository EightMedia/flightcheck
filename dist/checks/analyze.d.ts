import { type ReportRecord, type Tier1ReportData } from "../analyze/report.js";
import type { AnalyzeCheckResult } from "./types.js";
export type AnalyzeCheckOptions = {
    records?: ReportRecord[];
    inputPath?: string;
    reportPath?: string;
    reportJsonPath?: string;
    siteUrl?: string;
    errorsOnly?: boolean;
    writeReport?: boolean;
    redirectOnly?: boolean;
    tier1?: Tier1ReportData;
    /** npm package version recorded in the report (defaults to installed package). */
    flightcheckVersion?: string;
    /** CLI flags recorded in the report. */
    flags?: string[];
};
export declare function runAnalyzeCheck(options: AnalyzeCheckOptions): Promise<AnalyzeCheckResult>;
//# sourceMappingURL=analyze.d.ts.map
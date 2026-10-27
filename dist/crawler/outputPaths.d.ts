export declare function formatRunTimestamp(date: Date): string;
export declare function hostnameFromUrl(url: string): string;
export declare function buildDefaultOutputPaths(startUrl: string, now?: Date): {
    rawJson: string;
    reportMd: string;
    reportJson: string;
};
export declare function defaultReportPathForInput(inputPath: string): string;
export declare function defaultReportJsonPathForInput(inputPath: string): string;
/** @deprecated Fix-manifest output is removed; kept for callers that still resolve paths. */
export declare function defaultManifestPathForInput(inputPath: string): string;
/** @deprecated Agent-jobs output is removed; kept for callers that still resolve paths. */
export declare function defaultAgentJobsPathForInput(inputPath: string): string;
//# sourceMappingURL=outputPaths.d.ts.map
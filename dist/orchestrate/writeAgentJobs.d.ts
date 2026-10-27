import type { FixManifest } from "../analyze/fixManifest.js";
export type WriteAgentJobsOptions = {
    outputDir: string;
    promptsDir?: string;
    projectRepo?: string;
    siteUrl?: string;
};
export type AgentJobSummary = {
    outputDir: string;
    autoFixableCount: number;
    manualCount: number;
    packages: Array<{
        id: string;
        autoFixable: boolean;
        promptPath: string;
    }>;
};
declare function defaultOutputDirForManifest(manifestPath: string): string;
export declare function writeAgentJobs(manifest: FixManifest, options?: Partial<WriteAgentJobsOptions> & {
    manifestPath?: string;
}): AgentJobSummary;
export { defaultOutputDirForManifest };
//# sourceMappingURL=writeAgentJobs.d.ts.map
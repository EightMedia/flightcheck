import type { FixManifest, WorkPackage } from "../analyze/fixManifest.js";
export type ComposePromptOptions = {
    promptsDir?: string;
    projectPromptsDir?: string;
    siteUrl?: string;
};
export type ComposedAgentPrompt = {
    workPackageId: string;
    promptId: string;
    autoFixable: boolean;
    markdown: string;
};
export declare function defaultPromptsDir(): string;
/** The shared base instructions, written once to BASE.md at the agent-jobs root. */
export declare function readBasePrompt(promptsDir?: string): string;
export declare function composeAgentPrompt(manifest: FixManifest, workPackage: WorkPackage, options?: ComposePromptOptions): ComposedAgentPrompt;
export declare function composeAllAgentPrompts(manifest: FixManifest, options?: ComposePromptOptions): ComposedAgentPrompt[];
//# sourceMappingURL=composePrompt.d.ts.map
import { type CheckIssue } from "./issues.js";
/** AI crawler user-agents commonly expected in robots.txt (isitagentready / IETF drafts). */
export declare const AI_BOT_USER_AGENTS: readonly ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-Web", "anthropic-ai", "Google-Extended", "Amazonbot", "Applebot-Extended", "Bytespider", "CCBot", "PerplexityBot"];
/** Link relation types useful for agent discovery (RFC 8288 / RFC 9727). */
export declare const AGENT_LINK_RELS: readonly ["api-catalog", "service-desc", "service-doc", "describedby"];
export type AgentReadyProbeStatus = {
    url: string;
    status: number | null;
    contentType?: string;
    body?: string;
    headers?: Record<string, string>;
};
export type AgentReadyFindings = {
    robotsTxt: {
        status: number | null;
        hasContentSignals: boolean;
        contentSignals: string[];
        aiBotUserAgents: string[];
    };
    llmsTxt: {
        url: string;
        status: number | null;
        hasTitle: boolean;
    };
    markdownNegotiation: {
        url: string;
        status: number | null;
        contentType?: string;
        supportsMarkdown: boolean;
    };
    linkHeaders: {
        relations: string[];
    };
    wellKnown: {
        mcpServerCard: boolean;
        agentSkills: boolean;
        apiCatalog: boolean;
        ard: boolean;
        a2aAgentCard: boolean;
    };
};
export type AgentReadyCheckResult = {
    url: string;
    findings: AgentReadyFindings;
    issues: CheckIssue[];
};
export type AnalyzeAgentReadyInput = {
    origin: string;
    robotsTxt?: AgentReadyProbeStatus;
    llmsTxt?: AgentReadyProbeStatus;
    markdown?: AgentReadyProbeStatus;
    homepage?: AgentReadyProbeStatus;
    wellKnown?: {
        mcpServerCard?: AgentReadyProbeStatus;
        agentSkills?: AgentReadyProbeStatus;
        apiCatalog?: AgentReadyProbeStatus;
        ard?: AgentReadyProbeStatus;
        a2aAgentCard?: AgentReadyProbeStatus;
    };
};
export declare function analyzeAgentReady(input: AnalyzeAgentReadyInput): AgentReadyCheckResult;
export declare function runAgentReadyCheck(startUrl: string, timeoutMs?: number): Promise<AgentReadyCheckResult>;
//# sourceMappingURL=agent-ready.d.ts.map
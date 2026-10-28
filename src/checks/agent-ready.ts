import { issue, type CheckIssue } from "./issues.js";
import { DEFAULT_USER_AGENT } from "../crawler/defaults.js";

/** AI crawler user-agents commonly expected in robots.txt (isitagentready / IETF drafts). */
export const AI_BOT_USER_AGENTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "Google-Extended",
  "Amazonbot",
  "Applebot-Extended",
  "Bytespider",
  "CCBot",
  "PerplexityBot",
] as const;

/** Link relation types useful for agent discovery (RFC 8288 / RFC 9727). */
export const AGENT_LINK_RELS = ["api-catalog", "service-desc", "service-doc", "describedby"] as const;

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

function isSuccessfulStatus(status: number | null | undefined): boolean {
  return typeof status === "number" && status >= 200 && status < 300;
}

function looksLikeHtml(body: string | undefined, contentType: string | undefined): boolean {
  const type = (contentType ?? "").toLowerCase();
  if (type.includes("text/html") || type.includes("application/xhtml")) return true;
  if (!body) return false;
  const trimmed = body.trimStart().slice(0, 200).toLowerCase();
  return trimmed.startsWith("<!doctype html") || trimmed.startsWith("<html");
}

function extractContentSignals(body: string): string[] {
  const signals: string[] = [];
  for (const line of body.split("\n")) {
    const match = line.match(/^\s*content-signal:\s*(.+)\s*$/i);
    if (match) signals.push(match[1].trim());
  }
  return signals;
}

function extractAiBotUserAgents(body: string): string[] {
  const found = new Set<string>();
  for (const bot of AI_BOT_USER_AGENTS) {
    const pattern = new RegExp(`^\\s*user-agent:\\s*${bot}\\s*$`, "im");
    if (pattern.test(body)) found.add(bot);
  }
  return [...found].sort((a, b) => a.localeCompare(b));
}

function parseLinkRelations(linkHeader: string | undefined): string[] {
  if (!linkHeader) return [];
  const relations = new Set<string>();
  for (const part of linkHeader.split(/,(?=\s*<)/)) {
    const relMatch = part.match(/\brel\s*=\s*"([^"]+)"/i) ?? part.match(/\brel\s*=\s*'([^']+)'/i) ?? part.match(/\brel\s*=\s*([^\s;]+)/i);
    if (!relMatch) continue;
    for (const rel of relMatch[1].split(/\s+/)) {
      const normalized = rel.trim().toLowerCase();
      if (normalized) relations.add(normalized);
    }
  }
  return [...relations].sort((a, b) => a.localeCompare(b));
}

function isPresentJsonOrDocument(probe: AgentReadyProbeStatus | undefined): boolean {
  if (!probe || !isSuccessfulStatus(probe.status)) return false;
  if (looksLikeHtml(probe.body, probe.contentType)) return false;
  return true;
}

export function analyzeAgentReady(input: AnalyzeAgentReadyInput): AgentReadyCheckResult {
  const issues: CheckIssue[] = [];
  const robotsBody = input.robotsTxt?.body ?? "";
  const contentSignals = robotsBody ? extractContentSignals(robotsBody) : [];
  const aiBotUserAgents = robotsBody ? extractAiBotUserAgents(robotsBody) : [];

  const llmsStatus = input.llmsTxt?.status ?? null;
  const llmsBody = input.llmsTxt?.body ?? "";
  const llmsIsHtml = looksLikeHtml(llmsBody, input.llmsTxt?.contentType);
  const llmsOk = isSuccessfulStatus(llmsStatus) && !llmsIsHtml && llmsBody.trim().length > 0;
  const llmsHasTitle = /^#\s+\S+/m.test(llmsBody);

  const markdownType = input.markdown?.contentType ?? "";
  const markdownOk =
    isSuccessfulStatus(input.markdown?.status ?? null) &&
    /text\/markdown|text\/x-markdown/i.test(markdownType) &&
    !looksLikeHtml(input.markdown?.body, markdownType);

  const linkHeader = input.homepage?.headers?.link ?? input.homepage?.headers?.Link;
  const linkRelations = parseLinkRelations(linkHeader);
  const agentLinkRelations = linkRelations.filter((rel) =>
    (AGENT_LINK_RELS as readonly string[]).includes(rel)
  );

  const wellKnown = {
    mcpServerCard: isPresentJsonOrDocument(input.wellKnown?.mcpServerCard),
    agentSkills: isPresentJsonOrDocument(input.wellKnown?.agentSkills),
    apiCatalog: isPresentJsonOrDocument(input.wellKnown?.apiCatalog),
    ard: isPresentJsonOrDocument(input.wellKnown?.ard),
    a2aAgentCard: isPresentJsonOrDocument(input.wellKnown?.a2aAgentCard),
  };

  const robotsStatus = input.robotsTxt?.status ?? null;
  if (!isSuccessfulStatus(robotsStatus) || !robotsBody.trim()) {
    issues.push(
      issue(
        "agent-robots-missing",
        "warning",
        "robots.txt is missing or empty; agents cannot discover crawl policy or Content Signals.",
        "Add a robots.txt at the site root (for example public/robots.txt) with at least `User-agent: *` and a Sitemap line."
      )
    );
  } else {
    if (contentSignals.length === 0) {
      issues.push(
        issue(
          "agent-missing-content-signals",
          "warning",
          "robots.txt has no Content-Signal directives (ai-train / search / ai-input).",
          "Add a Content-Signal under `User-agent: *` in robots.txt, for example `Content-Signal: search=yes,ai-train=no`."
        )
      );
    }
    if (aiBotUserAgents.length === 0) {
      issues.push(
        issue(
          "agent-missing-ai-bot-rules",
          "warning",
          "robots.txt has no explicit AI bot User-agent rules (e.g. GPTBot, ClaudeBot, Google-Extended).",
          "Add explicit `User-agent` blocks for AI crawlers (GPTBot, ClaudeBot, Google-Extended, …) with Allow/Disallow as intended."
        )
      );
    }
  }

  if (!llmsOk) {
    issues.push(
      issue(
        "agent-missing-llms-txt",
        "warning",
        "llms.txt is missing or not a plain-text overview at /llms.txt.",
        "Add /llms.txt as plain text with an H1 title (`# Site Name`) and links to the most important content."
      )
    );
  } else if (!llmsHasTitle) {
    issues.push(
      issue(
        "agent-llms-txt-incomplete",
        "review",
        "llms.txt exists but has no H1 title line (# Site Name).",
        "Start llms.txt with an H1 line, for example `# Site Name`."
      )
    );
  }

  if (!markdownOk) {
    issues.push(
      issue(
        "agent-missing-markdown-negotiation",
        "warning",
        "Homepage does not negotiate Markdown (Accept: text/markdown → Content-Type: text/markdown).",
        "When the request has `Accept: text/markdown`, return the page body as Markdown with `Content-Type: text/markdown` (middleware or route)."
      )
    );
  }

  if (agentLinkRelations.length === 0) {
    issues.push(
      issue(
        "agent-missing-link-headers",
        "review",
        'Homepage has no agent-useful Link headers (rel="api-catalog", "service-doc", "service-desc", or "describedby").',
        'Add Link response headers on the homepage, for example `Link: </.well-known/api-catalog>; rel="api-catalog"`.'
      )
    );
  }

  const wellKnownPresent = Object.values(wellKnown).some(Boolean);
  if (!wellKnownPresent) {
    issues.push(
      issue(
        "agent-missing-protocol-discovery",
        "review",
        "No agent protocol discovery endpoints found (MCP Server Card, Agent Skills, API Catalog, ARD, or A2A Agent Card).",
        "Add /.well-known/agent-skills/index.json. Use an empty array if no skills are available (`skills: []`)."
      )
    );
  }

  const findings: AgentReadyFindings = {
    robotsTxt: {
      status: robotsStatus,
      hasContentSignals: contentSignals.length > 0,
      contentSignals,
      aiBotUserAgents,
    },
    llmsTxt: {
      url: input.llmsTxt?.url ?? `${input.origin}/llms.txt`,
      status: llmsStatus,
      hasTitle: llmsHasTitle,
    },
    markdownNegotiation: {
      url: input.markdown?.url ?? input.origin,
      status: input.markdown?.status ?? null,
      contentType: input.markdown?.contentType,
      supportsMarkdown: markdownOk,
    },
    linkHeaders: {
      relations: agentLinkRelations,
    },
    wellKnown,
  };

  return {
    url: input.origin,
    findings,
    issues,
  };
}

async function fetchProbe(url: string, init: RequestInit = {}, timeoutMs = 10_000): Promise<AgentReadyProbeStatus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      ...init,
      headers: {
        "user-agent": DEFAULT_USER_AGENT,
        ...(init.headers ?? {}),
      },
    });
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    const contentType = headers["content-type"];
    const body = await response.text();
    return {
      url,
      status: response.status,
      contentType,
      body: body.slice(0, 100_000),
      headers,
    };
  } catch {
    return { url, status: null };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runAgentReadyCheck(startUrl: string, timeoutMs = 10_000): Promise<AgentReadyCheckResult> {
  const origin = new URL(startUrl).origin;

  const [
    robotsTxt,
    llmsTxt,
    markdown,
    homepage,
    mcpServerCard,
    agentSkills,
    apiCatalog,
    ard,
    a2aAgentCard,
  ] = await Promise.all([
    fetchProbe(`${origin}/robots.txt`, {}, timeoutMs),
    fetchProbe(`${origin}/llms.txt`, {}, timeoutMs),
    fetchProbe(
      origin,
      {
        headers: {
          accept: "text/markdown, text/x-markdown;q=0.9, text/plain;q=0.8, */*;q=0.1",
        },
      },
      timeoutMs
    ),
    fetchProbe(origin, {}, timeoutMs),
    fetchProbe(`${origin}/.well-known/mcp/server-card.json`, {}, timeoutMs),
    fetchProbe(`${origin}/.well-known/agent-skills/index.json`, {}, timeoutMs),
    fetchProbe(`${origin}/.well-known/api-catalog`, {}, timeoutMs),
    fetchProbe(`${origin}/.well-known/ai-catalog.json`, {}, timeoutMs),
    fetchProbe(`${origin}/.well-known/agent-card.json`, {}, timeoutMs),
  ]);

  return analyzeAgentReady({
    origin,
    robotsTxt,
    llmsTxt,
    markdown,
    homepage,
    wellKnown: {
      mcpServerCard,
      agentSkills,
      apiCatalog,
      ard,
      a2aAgentCard,
    },
  });
}

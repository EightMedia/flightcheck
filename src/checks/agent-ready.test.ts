import { describe, expect, it } from "vitest";
import { analyzeAgentReady } from "./agent-ready.js";

describe("analyzeAgentReady", () => {
  it("flags missing content signals, AI bot rules, llms.txt, markdown, and discovery", () => {
    const result = analyzeAgentReady({
      origin: "https://example.com",
      robotsTxt: {
        url: "https://example.com/robots.txt",
        status: 200,
        body: "User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n",
      },
      llmsTxt: { url: "https://example.com/llms.txt", status: 404 },
      markdown: {
        url: "https://example.com",
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: "<html><body>Hello</body></html>",
      },
      homepage: {
        url: "https://example.com",
        status: 200,
        contentType: "text/html",
        headers: {},
      },
      wellKnown: {},
    });

    expect(result.issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        "agent-missing-content-signals",
        "agent-missing-ai-bot-rules",
        "agent-missing-llms-txt",
        "agent-missing-markdown-negotiation",
        "agent-missing-link-headers",
        "agent-missing-protocol-discovery",
      ])
    );
  });

  it("passes content-site essentials when signals, llms.txt, markdown, and links are present", () => {
    const result = analyzeAgentReady({
      origin: "https://example.com",
      robotsTxt: {
        url: "https://example.com/robots.txt",
        status: 200,
        body: [
          "User-agent: *",
          "Allow: /",
          "Content-Signal: ai-train=no, search=yes, ai-input=yes",
          "User-agent: GPTBot",
          "Disallow: /",
          "User-agent: ClaudeBot",
          "Allow: /",
          "Sitemap: https://example.com/sitemap.xml",
        ].join("\n"),
      },
      llmsTxt: {
        url: "https://example.com/llms.txt",
        status: 200,
        contentType: "text/plain; charset=utf-8",
        body: "# Example\n\n> A demo site.\n\n## Docs\n- [Start](https://example.com/docs)\n",
      },
      markdown: {
        url: "https://example.com",
        status: 200,
        contentType: "text/markdown; charset=utf-8",
        body: "# Example\n\nHello agents.\n",
      },
      homepage: {
        url: "https://example.com",
        status: 200,
        headers: {
          link: '</.well-known/api-catalog>; rel="api-catalog", </docs>; rel="service-doc"',
        },
      },
      wellKnown: {
        mcpServerCard: {
          url: "https://example.com/.well-known/mcp/server-card.json",
          status: 200,
          contentType: "application/json",
          body: '{"version":"1.0"}',
        },
      },
    });

    expect(result.findings.robotsTxt.hasContentSignals).toBe(true);
    expect(result.findings.robotsTxt.aiBotUserAgents).toEqual(["ClaudeBot", "GPTBot"]);
    expect(result.findings.llmsTxt.hasTitle).toBe(true);
    expect(result.findings.markdownNegotiation.supportsMarkdown).toBe(true);
    expect(result.findings.linkHeaders.relations).toEqual(["api-catalog", "service-doc"]);
    expect(result.findings.wellKnown.mcpServerCard).toBe(true);

    const blocking = result.issues.filter(
      (entry) => entry.severity === "warning" || entry.severity === "error" || entry.severity === "critical"
    );
    expect(blocking).toHaveLength(0);
  });

  it("treats HTML responses at /llms.txt as missing", () => {
    const result = analyzeAgentReady({
      origin: "https://example.com",
      llmsTxt: {
        url: "https://example.com/llms.txt",
        status: 200,
        contentType: "text/html",
        body: "<!DOCTYPE html><html><body>Not found</body></html>",
      },
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        id: "agent-missing-llms-txt",
        severity: "warning",
      })
    );
  });

  it("reviews incomplete llms.txt without an H1 title", () => {
    const result = analyzeAgentReady({
      origin: "https://example.com",
      robotsTxt: {
        url: "https://example.com/robots.txt",
        status: 200,
        body: [
          "User-agent: *",
          "Content-Signal: search=yes",
          "User-agent: GPTBot",
          "Allow: /",
        ].join("\n"),
      },
      llmsTxt: {
        url: "https://example.com/llms.txt",
        status: 200,
        contentType: "text/plain",
        body: "Just a list of links without a title\n",
      },
      markdown: {
        url: "https://example.com",
        status: 200,
        contentType: "text/markdown",
        body: "# Hi\n",
      },
      homepage: {
        url: "https://example.com",
        status: 200,
        headers: { link: '</.well-known/api-catalog>; rel="api-catalog"' },
      },
      wellKnown: {
        apiCatalog: {
          url: "https://example.com/.well-known/api-catalog",
          status: 200,
          contentType: "application/linkset+json",
          body: "{}",
        },
      },
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        id: "agent-llms-txt-incomplete",
        severity: "review",
      })
    );
  });
});

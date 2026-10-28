import { describe, expect, it } from "vitest";
import {
  buildStructuredReport,
  renderReportMarkdown,
} from "../src/analyze/structuredReport.js";
import type { ReportRecord } from "../src/analyze/report.js";

function makeRecord(overrides: Partial<ReportRecord> = {}): ReportRecord {
  return {
    url: "https://example.com/",
    status: 200,
    h1: "Hello",
    title: "Hello",
    metaTitle: "",
    metaDescription: "",
    robots: "",
    template: "",
    mainCount: 1,
    charset: "utf-8",
    language: "en",
    colorScheme: "",
    themeColor: "",
    doctype: "html5",
    viewport: "width=device-width",
    canonical: "https://example.com/",
    favicon: "https://example.com/favicon.ico",
    icons: [],
    og: { title: "", description: "", image: "", url: "", type: "", siteName: "" },
    twitter: { card: "", title: "", description: "", image: "" },
    tracking: { tagManager: [], analytics: [] },
    ...overrides,
  };
}

describe("buildStructuredReport", () => {
  it("emits analysis facts and flat findings with severity metadata", async () => {
    const report = await buildStructuredReport(
      "fixture-raw.json",
      [makeRecord(), makeRecord({ url: "https://example.com/about", colorScheme: "" })],
      {
        securityHeaders: {
          url: "https://example.com/",
          headers: {},
          issues: [
            {
              id: "missing-hsts",
              severity: "error",
              message: "Strict-Transport-Security header is missing on HTTPS.",
            },
          ],
        },
      },
      {
        generatedAt: "2026-10-27T12:00:00.000Z",
        flightcheckVersion: "1.0.1",
        flags: ["https://example.com", "--quiet"],
      }
    );

    expect(report.version).toBe(1);
    expect(report.flightcheckVersion).toBe("1.0.1");
    expect(report.flags).toEqual(["https://example.com", "--quiet"]);
    expect(report.analysis.pagesAnalyzed).toBe(2);
    expect(report.findings.some((finding) => finding.id === "missing-hsts")).toBe(true);
    expect(report.findings.some((finding) => finding.id === "colorScheme")).toBe(true);

    for (const finding of report.findings) {
      expect(finding).toMatchObject({
        id: expect.any(String),
        severity: expect.stringMatching(/^(critical|error|warning|review)$/),
        category: expect.any(String),
        scope: expect.any(String),
        title: expect.any(String),
        message: expect.any(String),
      });
    }

    const severities = report.findings.map((finding) => finding.severity);
    const order = ["critical", "error", "warning", "review"];
    const ranks = severities.map((severity) => order.indexOf(severity));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("renders plain-language Markdown from the JSON model", async () => {
    const report = await buildStructuredReport(
      "fixture-raw.json",
      [makeRecord()],
      {
        dns: {
          hostname: "example.com",
          records: { a: ["1.2.3.4"], aaaa: [], cname: [], mx: [], txt: [], ns: [] },
          mail: {},
          issues: [
            {
              id: "missing-dmarc",
              severity: "warning",
              message: "No DMARC TXT record found.",
              fix: "Add a TXT record on `_dmarc.example.com` starting with `v=DMARC1;`.",
            },
          ],
        },
        agentReady: {
          url: "https://example.com",
          findings: {
            robotsTxt: { status: 200, hasContentSignals: false, contentSignals: [], aiBotUserAgents: [] },
            llmsTxt: { url: "https://example.com/llms.txt", status: 404, hasTitle: false },
            markdownNegotiation: {
              url: "https://example.com",
              status: 200,
              contentType: "text/html",
              supportsMarkdown: false,
            },
            linkHeaders: { relations: [] },
            wellKnown: {
              mcpServerCard: false,
              agentSkills: false,
              apiCatalog: false,
              ard: false,
              a2aAgentCard: false,
            },
          },
          issues: [
            {
              id: "agent-missing-protocol-discovery",
              severity: "review",
              message:
                "No agent protocol discovery endpoints found (MCP Server Card, Agent Skills, API Catalog, ARD, or A2A Agent Card).",
              fix: "Add /.well-known/agent-skills/index.json. Use an empty array if no skills are available (`skills: []`).",
            },
          ],
        },
      },
      {
        flightcheckVersion: "1.0.1",
        flags: ["https://example.com", "--errors-only"],
      }
    );
    const markdown = renderReportMarkdown(report);
    const protocol = report.findings.find((finding) => finding.id === "agent-missing-protocol-discovery");

    expect(protocol?.fix).toContain("agent-skills/index.json");
    expect(markdown).toContain("# Flightcheck report");
    expect(markdown).toContain("Flightcheck: 1.0.1");
    expect(markdown).toContain("Flags: `https://example.com --errors-only`");
    expect(markdown).toContain("## At a glance");
    expect(markdown).toContain("### DNS");
    expect(markdown).toContain("## Findings");
    expect(markdown).toContain("Missing color-scheme meta tag");
    expect(markdown).toContain(
      "- Fix: Add /.well-known/agent-skills/index.json. Use an empty array if no skills are available (`skills: []`)."
    );
    expect(markdown).not.toContain("fix-manifest");
    expect(markdown).not.toContain("agent-jobs");
  });
});


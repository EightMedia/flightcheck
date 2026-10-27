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
      { generatedAt: "2026-10-27T12:00:00.000Z" }
    );

    expect(report.version).toBe(1);
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
    const report = await buildStructuredReport("fixture-raw.json", [makeRecord()], {
      dns: {
        hostname: "example.com",
        records: { a: ["1.2.3.4"], aaaa: [], cname: [], mx: [], txt: [], ns: [] },
        mail: {},
        issues: [{ id: "missing-dmarc", severity: "warning", message: "No DMARC TXT record found." }],
      },
    });
    const markdown = renderReportMarkdown(report);

    expect(markdown).toContain("# Flightcheck report");
    expect(markdown).toContain("## At a glance");
    expect(markdown).toContain("### DNS");
    expect(markdown).toContain("## Findings");
    expect(markdown).toContain("Missing color-scheme meta tag");
    expect(markdown).not.toContain("fix-manifest");
    expect(markdown).not.toContain("agent-jobs");
  });
});

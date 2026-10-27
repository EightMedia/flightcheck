import { describe, expect, it } from "vitest";
import { buildMarkdown, type ReportRecord } from "./report.js";
import { buildStructuredReport } from "./structuredReport.js";

function makeRecord(overrides: Partial<ReportRecord> = {}): ReportRecord {
  return {
    url: "https://example.com",
    status: 200,
    h1: "Heading",
    title: "Title",
    metaTitle: "Meta title",
    metaDescription: "Meta description",
    robots: "",
    template: "",
    mainCount: 1,
    charset: "utf-8",
    language: "en",
    colorScheme: "light",
    themeColor: "#fff",
    doctype: "html5",
    viewport: "width=device-width",
    canonical: "https://example.com",
    favicon: "https://example.com/favicon.ico",
    icons: [{ rel: "icon", href: "/favicon.ico", type: "", sizes: "", media: "" }],
    og: {
      title: "OG title",
      description: "OG description",
      image: "https://example.com/og.jpg",
      url: "https://example.com",
      type: "website",
      siteName: "Example",
    },
    twitter: {
      card: "summary",
      title: "Twitter title",
      description: "Twitter description",
      image: "https://example.com/twitter.jpg",
    },
    tracking: { tagManager: [], analytics: [] },
    ...overrides,
  };
}

describe("structured report via buildMarkdown", () => {
  it("does not flag missing robots meta as a finding", async () => {
    const report = await buildStructuredReport("report.json", [makeRecord()]);
    expect(report.findings.some((finding) => finding.id === "robots")).toBe(false);
  });

  it("marks noindex as site-wide on a single-page crawl", async () => {
    const report = await buildStructuredReport("report.json", [makeRecord({ robots: "noindex" })]);
    const finding = report.findings.find((entry) => entry.id === "noindex");
    expect(finding?.scope).toBe("site-wide");
    expect(finding?.severity).toBe("warning");
  });

  it("marks noindex as page-scoped when only some pages have it", async () => {
    const report = await buildStructuredReport("report.json", [
      makeRecord({ robots: "noindex", url: "https://example.com/a" }),
      makeRecord({ url: "https://example.com/b" }),
    ]);
    const finding = report.findings.find((entry) => entry.id === "noindex");
    expect(finding?.scope).toBe("page");
    expect(finding?.urls).toEqual(["https://example.com/a"]);
  });

  it("lists shared missing fields as site-wide findings", async () => {
    const report = await buildStructuredReport("report.json", [
      makeRecord({ colorScheme: "", og: { title: "", description: "", image: "", url: "", type: "", siteName: "" } }),
      makeRecord({
        url: "https://example.com/b",
        colorScheme: "",
        og: { title: "", description: "", image: "", url: "", type: "", siteName: "" },
      }),
    ]);
    expect(report.findings.find((finding) => finding.id === "colorScheme")?.scope).toBe("site-wide");
    expect(report.findings.some((finding) => finding.id.startsWith("og."))).toBe(true);
  });

  it("keeps page-only fields out of site-wide scope", async () => {
    const report = await buildStructuredReport("report.json", [
      makeRecord({ colorScheme: "", h1: "" }),
      makeRecord({ url: "https://example.com/b", colorScheme: "", h1: "Present" }),
    ]);
    expect(report.findings.find((finding) => finding.id === "colorScheme")?.scope).toBe("site-wide");
    expect(report.findings.find((finding) => finding.id === "h1")?.scope).toBe("page");
  });

  it("scopes shared template issues to the template", async () => {
    const report = await buildStructuredReport("report.json", [
      makeRecord({
        url: "https://example.com/a",
        template: "work",
        colorScheme: "",
        themeColor: "#fff",
      }),
      makeRecord({
        url: "https://example.com/b",
        template: "work",
        colorScheme: "",
        themeColor: "#fff",
      }),
      makeRecord({
        url: "https://example.com/c",
        template: "blog",
        colorScheme: "light",
        themeColor: "#fff",
      }),
    ]);
    const finding = report.findings.find((entry) => entry.id === "colorScheme" && entry.scope === "template");
    expect(finding?.template).toBe("work");
  });

  it("includes tier1 infra findings and stack analysis", async () => {
    const records = [makeRecord()];
    const stackProfile = {
      detections: [
        {
          name: "Next.js",
          categories: ["JavaScript frameworks"],
          confidence: "high" as const,
          evidence: ["Next.js runtime markers in HTML"],
          pageCount: 1,
        },
      ],
      tracking: { tagManager: [], analytics: [] },
    };
    const tier1 = {
      dns: {
        hostname: "example.com",
        records: { a: ["1.2.3.4"], aaaa: [], cname: [], mx: [], txt: [], ns: [] },
        mail: {},
        issues: [{ id: "missing-dmarc" as const, severity: "warning" as const, message: "No DMARC TXT record found." }],
      },
      securityHeaders: {
        url: "https://example.com",
        headers: {},
        issues: [
          {
            id: "missing-hsts",
            severity: "error" as const,
            message: "Strict-Transport-Security header is missing on HTTPS.",
          },
        ],
      },
    };
    const report = await buildStructuredReport("report.json", records, tier1, { stackProfile });

    expect(report.findings.some((finding) => finding.id === "missing-dmarc")).toBe(true);
    expect(report.findings.some((finding) => finding.id === "missing-hsts")).toBe(true);
    expect(report.analysis.stack.some((entry) => entry.name === "Next.js")).toBe(true);

    const markdown = await buildMarkdown("report.json", records, false, tier1, { stackProfile });
    expect(markdown).toContain("# Flightcheck report");
    expect(markdown).toContain("### DNS");
    expect(markdown).toContain("## Findings");
    expect(markdown).toContain("Next.js");
  });

  it("renders redirect-only mode without inventing crawl findings", async () => {
    const report = await buildStructuredReport(
      "report.json",
      [],
      {
        redirect: {
          url: "https://example.com",
          status: 301,
          location: "https://www.example.com/",
          resolvedTarget: "https://www.example.com/",
          targetStatus: 200,
          redirectOnly: true,
          issues: [],
        } as never,
      },
      { redirectOnly: true }
    );
    expect(report.redirectOnly).toBe(true);
    expect(report.analysis.pagesAnalyzed).toBe(0);
    expect(report.findings).toEqual([]);
  });

  it("aggregates page a11y findings with urls", async () => {
    const report = await buildStructuredReport("report.json", [
      makeRecord({
        url: "https://example.com/a",
        template: "work",
        a11yStatic: {
          issues: [{ id: "positive-tabindex", severity: "warning", message: "Element uses a positive tabindex." }],
        },
      }),
      makeRecord({ url: "https://example.com/b", template: "work" }),
    ]);
    const finding = report.findings.find((entry) => entry.id === "positive-tabindex");
    expect(finding?.scope).toBe("page");
    expect(finding?.urls).toEqual(["https://example.com/a"]);
  });
});

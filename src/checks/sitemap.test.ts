import { describe, expect, it } from "vitest";
import { analyzeSitemapCompare } from "./sitemap.js";

describe("analyzeSitemapCompare", () => {
  it("flags missing sitemap when all sources fail", () => {
    const result = analyzeSitemapCompare({
      sources: [{ url: "https://example.com/sitemap.xml", status: 404, pageUrls: [] }],
      crawledUrls: ["https://example.com/"],
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        id: "sitemap-missing",
        severity: "error",
      })
    );
  });

  it("flags unreachable sitemap sources", () => {
    const result = analyzeSitemapCompare({
      sources: [
        { url: "https://example.com/sitemap.xml", status: 500, pageUrls: [] },
        { url: "https://example.com/sitemap-news.xml", status: 200, pageUrls: ["https://example.com/"] },
      ],
      crawledUrls: ["https://example.com/"],
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        id: "sitemap-unreachable",
        severity: "error",
      })
    );
    expect(result.issues.find((issue) => issue.id === "sitemap-missing")).toBeUndefined();
  });

  it("flags URLs in sitemap but not crawled", () => {
    const result = analyzeSitemapCompare({
      sources: [
        {
          url: "https://example.com/sitemap.xml",
          status: 200,
          pageUrls: ["https://example.com/", "https://example.com/about"],
        },
      ],
      crawledUrls: ["https://example.com/"],
    });

    expect(result.inSitemapNotCrawled).toEqual(["https://example.com/about"]);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        id: "sitemap-url-not-crawled",
        severity: "critical",
      })
    );
  });

  it("flags crawled URLs missing from sitemap", () => {
    const result = analyzeSitemapCompare({
      sources: [
        {
          url: "https://example.com/sitemap.xml",
          status: 200,
          pageUrls: ["https://example.com/"],
        },
      ],
      crawledUrls: ["https://example.com/", "https://example.com/contact"],
    });

    expect(result.crawledNotInSitemap).toEqual(["https://example.com/contact"]);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        id: "sitemap-missing-crawled-url",
        severity: "critical",
      })
    );
  });

  it("flags apex vs www hostname mismatch as critical", () => {
    const result = analyzeSitemapCompare({
      sources: [
        {
          url: "https://www.example.com/sitemap.xml",
          status: 200,
          pageUrls: ["https://www.example.com/", "https://www.example.com/about"],
        },
      ],
      crawledUrls: ["https://example.com/", "https://example.com/about"],
    });

    expect(result.inSitemapNotCrawled).toEqual([
      "https://www.example.com/",
      "https://www.example.com/about",
    ]);
    expect(result.crawledNotInSitemap).toEqual([
      "https://example.com/",
      "https://example.com/about",
    ]);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        id: "sitemap-url-not-crawled",
        severity: "critical",
      })
    );
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        id: "sitemap-missing-crawled-url",
        severity: "critical",
      })
    );
  });

  it("flags mismatch above threshold as error", () => {
    const result = analyzeSitemapCompare({
      sources: [
        {
          url: "https://example.com/sitemap.xml",
          status: 200,
          pageUrls: ["https://example.com/a", "https://example.com/b", "https://example.com/c", "https://example.com/d", "https://example.com/e", "https://example.com/f", "https://example.com/g", "https://example.com/h", "https://example.com/i", "https://example.com/j"],
        },
      ],
      crawledUrls: ["https://example.com/a"],
      mismatchThresholdPercent: 10,
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        id: "sitemap-mismatch-threshold",
        severity: "critical",
      })
    );
  });

  it("flags an empty reachable sitemap instead of a false mismatch", () => {
    const result = analyzeSitemapCompare({
      sources: [
        {
          url: "https://eight.nl/sitemap.xml",
          status: 200,
          pageUrls: [],
        },
      ],
      crawledUrls: ["https://www.eight.nl/", "https://www.eight.nl/about"],
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        id: "sitemap-empty",
        severity: "error",
      })
    );
    expect(result.issues.find((issue) => issue.id === "sitemap-mismatch-threshold")).toBeUndefined();
  });

  it("returns no blocking issues when sitemap and crawl align", () => {
    const result = analyzeSitemapCompare({
      sources: [
        {
          url: "https://example.com/sitemap.xml",
          status: 200,
          pageUrls: ["https://example.com/", "https://example.com/about"],
        },
      ],
      crawledUrls: ["https://example.com/about", "https://example.com/"],
    });

    const blocking = result.issues.filter(
      (issue) => issue.severity === "error" || issue.severity === "critical"
    );
    expect(blocking).toHaveLength(0);
    expect(result.inSitemapNotCrawled).toEqual([]);
    expect(result.crawledNotInSitemap).toEqual([]);
  });

  it("excludes configured URL patterns from comparison", () => {
    const result = analyzeSitemapCompare({
      sources: [
        {
          url: "https://example.com/sitemap.xml",
          status: 200,
          pageUrls: ["https://example.com/", "https://example.com/admin"],
        },
      ],
      crawledUrls: ["https://example.com/"],
      excludePatterns: ["/admin"],
    });

    expect(result.inSitemapNotCrawled).toEqual([]);
    expect(result.issues.find((issue) => issue.id === "sitemap-url-not-crawled")).toBeUndefined();
  });
});

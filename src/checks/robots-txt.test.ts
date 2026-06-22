import { describe, expect, it } from "vitest";
import { analyzeRobotsTxt } from "./robots-txt.js";

describe("analyzeRobotsTxt", () => {
  it("flags missing robots.txt as warning", () => {
    const result = analyzeRobotsTxt({ url: "https://example.com/robots.txt", status: 404 });

    expect(result.sitemapUrls).toEqual([]);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        id: "robots-missing",
        severity: "warning",
      })
    );
  });

  it("flags unparseable robots.txt as error", () => {
    const result = analyzeRobotsTxt({
      url: "https://example.com/robots.txt",
      status: 200,
      body: "User-agent: *\nDisallow\nAllow: /",
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        id: "robots-unparseable",
        severity: "error",
      })
    );
  });

  it("flags Disallow: / for all user agents as critical", () => {
    const result = analyzeRobotsTxt({
      url: "https://example.com/robots.txt",
      status: 200,
      body: "User-agent: *\nDisallow: /",
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        id: "robots-blocks-all",
        severity: "critical",
      })
    );
  });

  it("extracts sitemap directives", () => {
    const result = analyzeRobotsTxt({
      url: "https://example.com/robots.txt",
      status: 200,
      body: [
        "User-agent: *",
        "Allow: /",
        "Sitemap: https://example.com/sitemap.xml",
        "Sitemap: https://example.com/sitemap-news.xml",
      ].join("\n"),
    });

    expect(result.sitemapUrls).toEqual([
      "https://example.com/sitemap.xml",
      "https://example.com/sitemap-news.xml",
    ]);
  });

  it("flags missing sitemap directive as warning", () => {
    const result = analyzeRobotsTxt({
      url: "https://example.com/robots.txt",
      status: 200,
      body: "User-agent: *\nAllow: /",
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        id: "robots-missing-sitemap",
        severity: "warning",
      })
    );
  });

  it("returns no blocking issues for a healthy robots.txt", () => {
    const result = analyzeRobotsTxt({
      url: "https://example.com/robots.txt",
      status: 200,
      body: [
        "User-agent: *",
        "Allow: /",
        "Sitemap: https://example.com/sitemap.xml",
      ].join("\n"),
    });

    const blocking = result.issues.filter(
      (issue) => issue.severity === "error" || issue.severity === "critical"
    );
    expect(blocking).toHaveLength(0);
  });
});

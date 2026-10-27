import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { runAnalyzeCheck } from "./analyze.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempInput(): string {
  const dir = mkdtempSync(join(tmpdir(), "flightcheck-analyze-"));
  tempDirs.push(dir);
  const inputPath = join(dir, "sample-raw.json");
  writeFileSync(
    inputPath,
    `${JSON.stringify([
      {
        url: "https://example.com",
        status: 200,
        h1: "Heading",
        title: "Title",
        metaTitle: "",
        metaDescription: "",
        robots: "",
        template: "",
        mainCount: 0,
        charset: "utf-8",
        language: "en",
        colorScheme: "",
        themeColor: "#fff",
        doctype: "html5",
        viewport: "width=device-width",
        canonical: "https://example.com",
        favicon: "https://example.com/favicon.ico",
        icons: [],
        og: { title: "", description: "", image: "", url: "", type: "", siteName: "" },
        twitter: { card: "", title: "", description: "", image: "" },
        tracking: { tagManager: [], analytics: [] },
      },
    ])}\n`,
    "utf8"
  );
  return inputPath;
}

describe("runAnalyzeCheck", () => {
  it("writes structured report JSON and Markdown by default", async () => {
    const inputPath = makeTempInput();
    const result = await runAnalyzeCheck({
      inputPath,
      siteUrl: "https://example.com",
    });

    expect(existsSync(result.reportPath)).toBe(true);
    expect(existsSync(result.reportJsonPath)).toBe(true);
    expect(result.report.version).toBe(1);
    expect(result.report.findings.length).toBeGreaterThan(0);
    expect(result.markdown).toMatch(/# Flightcheck report/);
    expect(result.markdown).toMatch(/## Findings/);

    const parsed = JSON.parse(readFileSync(result.reportJsonPath, "utf8")) as {
      analysis: { pagesAnalyzed: number };
      findings: unknown[];
    };
    expect(parsed.analysis.pagesAnalyzed).toBe(1);
    expect(parsed.findings.length).toBe(result.report.findings.length);
  });

  it("can skip writing files", async () => {
    const inputPath = makeTempInput();
    const result = await runAnalyzeCheck({
      inputPath,
      writeReport: false,
    });

    expect(existsSync(result.reportPath)).toBe(false);
    expect(existsSync(result.reportJsonPath)).toBe(false);
    expect(result.report.findings.length).toBeGreaterThan(0);
  });
});

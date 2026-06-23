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
  it("writes agent job prompts alongside manifest by default", async () => {
    const inputPath = makeTempInput();
    const result = await runAnalyzeCheck({
      inputPath,
      writeReport: false,
      siteUrl: "https://example.com",
    });

    expect(existsSync(result.manifestPath)).toBe(true);
    expect(existsSync(join(result.agentJobsPath, "README.md"))).toBe(true);
    expect(existsSync(join(result.agentJobsPath, "summary.json"))).toBe(true);

    const seoPrompt = join(result.agentJobsPath, "seo-site-wide", "prompt.md");
    expect(existsSync(seoPrompt)).toBe(true);
    const prompt = readFileSync(seoPrompt, "utf8");
    expect(prompt).toMatch(/seo-site-wide/);
    expect(prompt).toMatch(/Work package/);
    expect(result.agentJobs?.autoFixableCount).toBeGreaterThan(0);
  });

  it("skips agent jobs when writeAgentJobs is false", async () => {
    const inputPath = makeTempInput();
    const result = await runAnalyzeCheck({
      inputPath,
      writeReport: false,
      writeAgentJobs: false,
    });

    expect(existsSync(result.manifestPath)).toBe(true);
    expect(existsSync(join(result.agentJobsPath, "README.md"))).toBe(false);
    expect(result.agentJobs).toBeUndefined();
  });
});

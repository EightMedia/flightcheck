import { describe, expect, it } from "vitest";
import { planCheckWaves, runCheck } from "./runner.js";
import { resolveChecksForRedirect } from "./redirect.js";
import { listChecks, listImplementedChecks } from "./registry.js";
import { DEFAULT_CHECK_IDS } from "./types.js";

describe("planCheckWaves", () => {
  it("groups independent checks in the first wave, sitemap in the second, and analyze last", () => {
    expect(planCheckWaves(["crawl", "analyze", "dns", "sitemap"])).toEqual([
      ["crawl", "dns"],
      ["sitemap"],
      ["analyze"],
    ]);
  });

  it("returns only analyze when requested alone", () => {
    expect(planCheckWaves(["analyze"])).toEqual([["analyze"]]);
  });

  it("returns an empty list for no checks", () => {
    expect(planCheckWaves([])).toEqual([]);
  });

  it("plans waves for the default check set", () => {
    expect(planCheckWaves(DEFAULT_CHECK_IDS)).toEqual([
      ["crawl", "security-headers", "dns", "robots-txt", "agent-ready"],
      ["sitemap"],
      ["analyze"],
    ]);
  });

  it("plans redirect-only checks after redirect detection", () => {
    expect(planCheckWaves(resolveChecksForRedirect(DEFAULT_CHECK_IDS, { redirectOnly: true }))).toEqual([
      ["dns"],
      ["analyze"],
    ]);
  });
});

describe("check registry", () => {
  it("lists implemented and planned checks separately", () => {
    const implemented = listImplementedChecks().map((check) => check.id);
    expect(implemented).toEqual([
      "crawl",
      "analyze",
      "security-headers",
      "dns",
      "robots-txt",
      "sitemap",
      "agent-ready",
    ]);

    const planned = listChecks().filter((check) => !check.implemented).map((check) => check.id);
    expect(planned).toEqual(["lighthouse"]);
  });
});

describe("runCheck unsupported", () => {
  it("returns unsupported for planned checks", async () => {
    const result = await runCheck("lighthouse", { startUrl: "https://example.com" });
    expect(result.status).toBe("unsupported");
    expect(result.error).toContain("not implemented");
  });
});

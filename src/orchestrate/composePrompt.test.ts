import { describe, expect, it } from "vitest";
import type { FixManifest, WorkPackage } from "../analyze/fixManifest.js";
import { composeAgentPrompt, defaultPromptsDir } from "./composePrompt.js";

const samplePackage: WorkPackage = {
  id: "seo-site-wide",
  promptId: "seo-site-wide",
  fixSurface: "repo",
  priority: 10,
  scope: "site-wide",
  issues: [
    {
      id: "colorScheme",
      severity: "error",
      scope: "site-wide",
      count: 2,
      todo: "Missing colorScheme on site-wide",
    },
  ],
  locationDiscovery: "search-codebase",
  searchHints: ["Search the codebase for root layout", "generateMetadata"],
  mcpServers: [],
  prTitle: "fix(seo): add site-wide metadata",
  autoFixable: true,
};

const sampleManifest: FixManifest = {
  version: 1,
  generatedAt: "2026-06-22T12:00:00.000Z",
  source: "./flightcheck/example-raw.json",
  reportPath: "./flightcheck/example-report.md",
  redirectOnly: false,
  stack: [
    {
      name: "Next.js",
      categories: ["JavaScript frameworks"],
      confidence: "high",
      scope: "site-wide",
      evidence: ["__NEXT_DATA__"],
    },
  ],
  workPackages: [samplePackage],
};

describe("composeAgentPrompt", () => {
  it("includes base prompt, domain prompt, and work package details", () => {
    const composed = composeAgentPrompt(sampleManifest, samplePackage, {
      promptsDir: defaultPromptsDir(),
      siteUrl: "https://example.com",
    });

    expect(composed.markdown).toContain("single work package");
    expect(composed.markdown).toContain("Search the codebase first");
    expect(composed.markdown).toContain("**ID:** `seo-site-wide`");
    expect(composed.markdown).toContain("colorScheme");
    expect(composed.markdown).toContain("https://example.com");
    expect(composed.markdown).toContain("**Next.js**");
  });

  it("falls back when domain prompt file is missing", () => {
    const composed = composeAgentPrompt(
      sampleManifest,
      { ...samplePackage, id: "infra-dns", promptId: "infra-dns" },
      { promptsDir: "/nonexistent/prompts" }
    );

    expect(composed.markdown).toContain("No dedicated prompt file");
    expect(composed.markdown).toContain("infra-dns");
  });
});

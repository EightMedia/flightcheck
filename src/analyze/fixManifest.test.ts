import { describe, expect, it } from "vitest";
import { buildFixManifest } from "./fixManifest.js";
import type { ReportRecord } from "./report.js";
import { defaultManifestPathForInput } from "../crawler/outputPaths.js";

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
    colorScheme: "",
    themeColor: "#fff",
    doctype: "html5",
    viewport: "width=device-width",
    canonical: "https://example.com",
    favicon: "https://example.com/favicon.ico",
    icons: [],
    og: {
      title: "",
      description: "",
      image: "",
      url: "",
      type: "",
      siteName: "",
    },
    twitter: {
      card: "",
      title: "",
      description: "",
      image: "",
    },
    tracking: { tagManager: [], analytics: [] },
    ...overrides,
  };
}

describe("buildFixManifest", () => {
  it("creates seo-site-wide package with codebase search hints", async () => {
    const manifest = await buildFixManifest(
      "./flightcheck/20260618.1413-eight.nl-raw.json",
      [makeRecord(), makeRecord({ url: "https://example.com/about" })],
      {}
    );

    const seoPackage = manifest.workPackages.find((pkg) => pkg.id === "seo-site-wide");
    expect(seoPackage).toBeDefined();
    expect(seoPackage?.locationDiscovery).toBe("search-codebase");
    expect(seoPackage?.searchHints.some((hint) => /Search the codebase/i.test(hint))).toBe(true);
    expect(seoPackage?.issues.some((issue) => issue.id === "colorScheme")).toBe(true);
    expect(seoPackage?.prTitle).toMatch(/^fix\(seo\):/);
  });

  it("includes stack detections and Netlify MCP when stack profile lists Netlify", async () => {
    const manifest = await buildFixManifest(
      "report.json",
      [
        makeRecord({
          stack: {
            detections: [
              {
                name: "Next.js",
                categories: ["JavaScript frameworks"],
                confidence: "high",
                evidence: ["Next.js runtime markers in HTML"],
              },
            ],
          },
        }),
      ],
      {
        securityHeaders: {
          url: "https://example.com",
          headers: { "x-nf-request-id": "abc" },
          issues: [{ id: "missing-hsts", severity: "error", message: "Strict-Transport-Security header is missing on HTTPS." }],
        },
      },
      {
        stackProfile: {
          detections: [
            {
              name: "Next.js",
              categories: ["JavaScript frameworks"],
              confidence: "high",
              evidence: ["Next.js runtime markers in HTML"],
              pageCount: 1,
            },
            {
              name: "Netlify",
              categories: ["PaaS"],
              confidence: "high",
              evidence: ["x-nf-request-id: abc"],
              pageCount: 0,
            },
          ],
          tracking: { tagManager: [], analytics: [] },
        },
      }
    );

    expect(manifest.stack.some((entry) => entry.name === "Next.js")).toBe(true);
    const headersPackage = manifest.workPackages.find((pkg) => pkg.id === "infra-headers");
    expect(headersPackage?.mcpServers).toContain("netlify");
    expect(headersPackage?.searchHints.some((hint) => /netlify\.toml/i.test(hint))).toBe(true);
  });

  it("creates separate template packages with template search hints", async () => {
    const manifest = await buildFixManifest("report.json", [
      makeRecord({ colorScheme: "light" }),
      makeRecord({ url: "https://example.com/work/a", template: "work", colorScheme: "" }),
      makeRecord({ url: "https://example.com/work/b", template: "work", colorScheme: "" }),
    ]);

    const templatePackage = manifest.workPackages.find((pkg) => pkg.id === "seo-template-work");
    expect(templatePackage).toBeDefined();
    expect(templatePackage?.template).toBe("work");
    expect(templatePackage?.searchHints.some((hint) => /template meta value: work/i.test(hint))).toBe(true);
  });

  it("does not repeat site-wide fields in the page-specific package (dedup)", async () => {
    const manifest = await buildFixManifest("report.json", [
      // colorScheme missing on every page => site-wide; metaDescription missing only on /b => page.
      makeRecord({ url: "https://example.com/a", colorScheme: "" }),
      makeRecord({ url: "https://example.com/b", colorScheme: "", metaDescription: "" }),
    ]);

    const seoPages = manifest.workPackages.find((pkg) => pkg.id === "seo-pages");
    expect(seoPages?.issues.some((issue) => issue.id === "metaDescription")).toBe(true);
    // colorScheme is handled site-wide and must not reappear per page.
    expect(seoPages?.issues.some((issue) => issue.id === "colorScheme")).toBe(false);
  });

  it("routes non-200 crawl artifacts to reviewItems, not fix packages", async () => {
    const manifest = await buildFixManifest("report.json", [
      makeRecord({ url: "https://example.com/real", metaDescription: "" }),
      makeRecord({
        url: "https://example.com/wielrennen/jeugd@example.com",
        status: 404,
        error: "Not Found",
      }),
    ]);

    const junkUrl = "https://example.com/wielrennen/jeugd@example.com";
    expect(manifest.reviewItems.some((item) => item.url === junkUrl)).toBe(true);
    // The 404 email URL must not generate "add metadata" todos anywhere.
    const allIssueUrls = manifest.workPackages.flatMap((pkg) => pkg.issues.flatMap((issue) => issue.urls ?? []));
    expect(allIssueUrls).not.toContain(junkUrl);
  });

  it("routes editorial content to a cms-content package when a CMS is detected", async () => {
    const manifest = await buildFixManifest(
      "report.json",
      [
        makeRecord({ url: "https://example.com/a" }),
        makeRecord({
          url: "https://example.com/b",
          metaDescription: "",
          images: { issues: [{ id: "empty-alt", severity: "warning", message: "Image has an empty alt attribute." }] },
        }),
      ],
      {},
      {
        stackProfile: {
          detections: [
            {
              name: "Sanity",
              categories: ["CMS"],
              confidence: "high",
              evidence: ["cdn.sanity.io"],
              pageCount: 2,
            },
          ],
          tracking: { tagManager: [], analytics: [] },
        },
      }
    );

    const cms = manifest.workPackages.find((pkg) => pkg.id === "cms-content");
    expect(cms).toBeDefined();
    expect(cms?.fixSurface).toBe("cms");
    expect(cms?.locationDiscovery).toBe("cms-studio");
    expect(cms?.issues.some((issue) => issue.id === "metaDescription")).toBe(true);
    // granular a11y id, not the old generic "page-a11y-todo"
    expect(cms?.issues.some((issue) => issue.id === "empty-alt")).toBe(true);
    // content was moved out of the repo seo-pages package (which may not exist at all now)
    const seoPages = manifest.workPackages.find((pkg) => pkg.id === "seo-pages");
    expect((seoPages?.issues ?? []).some((issue) => issue.id === "metaDescription")).toBe(false);
  });

  it("marks secrets and DNS packages as not auto-fixable", async () => {
    const manifest = await buildFixManifest(
      "report.json",
      [
        makeRecord({
          security: {
            secrets: [{ type: "api-key", provider: "stripe", severity: "critical", masked: "sk_…", source: "inline" }],
            scannedAssets: 1,
          },
        }),
      ],
      {
        dns: {
          hostname: "example.com",
          records: { a: [], aaaa: [], cname: [], mx: [], txt: [], ns: [] },
          mail: {},
          issues: [{ id: "missing-dmarc", severity: "warning", message: "No DMARC TXT record found." }],
        },
      }
    );

    expect(manifest.workPackages.find((pkg) => pkg.id === "secrets")?.autoFixable).toBe(false);
    expect(manifest.workPackages.find((pkg) => pkg.id === "infra-dns")?.autoFixable).toBe(false);
    expect(manifest.workPackages.find((pkg) => pkg.id === "infra-dns")?.locationDiscovery).toBe("dns-panel");
  });
});

describe("defaultManifestPathForInput", () => {
  it("replaces -raw.json suffix", async () => {
    expect(defaultManifestPathForInput("./flightcheck/20260618.1413-eight.nl-raw.json")).toBe(
      "./flightcheck/20260618.1413-eight.nl-fix-manifest.json"
    );
  });
});

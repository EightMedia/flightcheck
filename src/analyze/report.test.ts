import { describe, expect, it } from "vitest";
import { buildMarkdown, type ReportRecord } from "./report.js";
import { buildStackProfile } from "./stack.js";

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

describe("buildMarkdown robots warnings", () => {
  it("does not flag missing robots meta as a missing field", async () => {
    const markdown = await buildMarkdown("report.json", [makeRecord()], false);
    expect(markdown).not.toContain("robots: missing");
    expect(markdown).not.toContain("Fix missing attribute:");
  });

  it("puts noindex on a single-page crawl in site-wide fixes", async () => {
    const markdown = await buildMarkdown("report.json", [makeRecord({ robots: "noindex" })], false);
    expect(markdown).toContain("## Fix site-wide (all pages)");
    expect(markdown).toContain("- [ ] Remove noindex from shared robots meta tag in site layout");
  });

  it("puts noindex on one of two pages in per-page fixes only", async () => {
    const markdown = await buildMarkdown(
      "report.json",
      [makeRecord({ robots: "noindex", url: "https://example.com/a" }), makeRecord({ url: "https://example.com/b" })],
      false
    );
    expect(markdown).toContain("- [ ] Remove noindex from page robots meta tag");
    expect(markdown).not.toContain("Remove noindex from shared robots meta tag");
  });

  it("does not warn when robots is set to index,follow", async () => {
    const markdown = await buildMarkdown("report.json", [makeRecord({ robots: "index,follow" })], false);
    expect(markdown).not.toContain("noindex");
    expect(markdown).not.toContain("nofollow");
  });
});

describe("buildMarkdown template meta warnings", () => {
  it("warns site-wide when template meta is missing on all pages", async () => {
    const markdown = await buildMarkdown(
      "report.json",
      [makeRecord({ template: "", url: "https://example.com/a" }), makeRecord({ template: "", url: "https://example.com/b" })],
      false
    );

    expect(markdown).toContain(
      "- [ ] Add template meta tag to site layout head — helps flightcheck give better tailored reports"
    );
    expect(markdown).toContain("- `missing template meta`: 2/2 pages (site-wide)");
    expect(markdown).toContain("- Templates that need fixes: Unavailable, template meta missing");
    expect(markdown).not.toContain("Add template meta tag to page head");
  });

  it("warns per page when template meta is missing on only some pages", async () => {
    const markdown = await buildMarkdown(
      "report.json",
      [makeRecord({ template: "", url: "https://example.com/a" }), makeRecord({ template: "work", url: "https://example.com/b" })],
      false
    );

    expect(markdown).toContain("- [ ] Add template meta tag to page head — helps flightcheck give better tailored reports");
    expect(markdown).toContain("- `missing template meta`: 1/2 pages (page-specific)");
    expect(markdown).not.toContain("Add template meta tag to site layout head");
  });

  it("does not warn when template meta is present", async () => {
    const markdown = await buildMarkdown("report.json", [makeRecord({ template: "work" })], false);
    expect(markdown).not.toContain("missing template meta");
    expect(markdown).not.toContain("Add template meta tag");
  });
});

describe("buildMarkdown site-wide todos", () => {
  it("lists shared issues once under site-wide fixes", async () => {
    const shared = {
      colorScheme: "",
      og: { title: "t", description: "d", image: "i", url: "", type: "website", siteName: "" },
      twitter: { card: "", title: "", description: "", image: "" },
    };

    const markdown = await buildMarkdown(
      "report.json",
      [makeRecord({ ...shared, url: "https://example.com/a" }), makeRecord({ ...shared, url: "https://example.com/b" })],
      false
    );

    expect(markdown).toContain("## Fix site-wide (all pages)");
    expect(markdown).toContain("- [ ] Add color-scheme meta tag to site layout head");
    expect(markdown).toContain("- [ ] Add Open Graph meta tags to site layout head: og:url, og:site_name");
    expect(markdown).toContain("- No page-specific fixes needed.");
    expect(markdown).not.toContain("Add color-scheme meta tag to page head");
  });

  it("deduplicates site-wide issues from per-page section", async () => {
    const shared = {
      colorScheme: "",
      og: { title: "t", description: "d", image: "i", url: "", type: "website", siteName: "" },
      twitter: { card: "", title: "", description: "", image: "" },
    };

    const markdown = await buildMarkdown(
      "report.json",
      [
        makeRecord({ ...shared, h1: "", url: "https://example.com/" }),
        makeRecord({ ...shared, url: "https://example.com/work" }),
      ],
      false
    );

    expect(markdown).toContain("- [ ] Add color-scheme meta tag to site layout head");
    expect(markdown).toContain("### https://example.com/");
    expect(markdown).toContain("- [ ] Add h1 to page");
    expect(markdown).not.toMatch(/### https:\/\/example\.com\/[\s\S]*Add color-scheme meta tag to page head/);
  });
});

describe("buildMarkdown page-level todos", () => {
  it("splits missing fields into separate todos and bundles og/twitter", async () => {
    const markdown = await buildMarkdown(
      "report.json",
      [
        makeRecord({
          h1: "",
          colorScheme: "",
          og: { title: "t", description: "d", image: "i", url: "", type: "website", siteName: "" },
          twitter: { card: "", title: "", description: "", image: "" },
        }),
      ],
      false
    );

    expect(markdown).toContain("- [ ] Add h1 in site layout");
    expect(markdown).toContain("- [ ] Add color-scheme meta tag to site layout head");
    expect(markdown).toContain("- [ ] Add Open Graph meta tags to site layout head: og:url, og:site_name");
    expect(markdown).toContain("- [ ] Add Twitter meta tags to site layout head: twitter:card, twitter:title, twitter:description, twitter:image");
  });

  it("flags missing main landmark on a single page", async () => {
    const markdown = await buildMarkdown("report.json", [makeRecord({ mainCount: 0 })], false);
    expect(markdown).toContain("- [ ] Add main landmark to site layout");
    expect(markdown).toContain("- `missing main landmark`: 1/1 pages (site-wide)");
  });

  it("flags multiple main landmarks with count on a single page", async () => {
    const markdown = await buildMarkdown("report.json", [makeRecord({ mainCount: 2 })], false);
    expect(markdown).toContain("- [ ] Ensure site layout renders exactly one main landmark");
  });
});

describe("buildMarkdown template todos", () => {
  it("shows bundled template fix todos when all pages in a template share issues", async () => {
    const sharedIssues = {
      template: "work",
      colorScheme: "",
      og: { title: "t", description: "d", image: "i", url: "", type: "website", siteName: "" },
      twitter: { card: "", title: "", description: "", image: "" },
      mainCount: 0,
    };

    const markdown = await buildMarkdown(
      "report.json",
      [
        makeRecord({ ...sharedIssues, url: "https://example.com/work/a" }),
        makeRecord({ ...sharedIssues, url: "https://example.com/work/b" }),
        makeRecord({ url: "https://example.com/about", colorScheme: "light" }),
      ],
      false
    );

    expect(markdown).toContain("## Fix in templates");
    expect(markdown).toContain("### Template: `work` (2 page(s))");
    expect(markdown).toContain("- [ ] Add color-scheme meta tag to template head");
    expect(markdown).toContain("- [ ] Add main landmark to template");
    expect(markdown).not.toContain("- [ ] Add color-scheme meta tag to site layout head");
  });

  it("omits template todos when an issue is not shared by all pages in the template", async () => {
    const markdown = await buildMarkdown(
      "report.json",
      [
        makeRecord({ template: "work", colorScheme: "", url: "https://example.com/work/a" }),
        makeRecord({ template: "work", colorScheme: "light", url: "https://example.com/work/b" }),
      ],
      false
    );

    expect(markdown).toContain("### Template: `work` (2 page(s))");
    expect(markdown).toContain("- No template-specific issues");
    expect(markdown).not.toContain("Add color-scheme meta tag to template head");
  });

  it("skips template section when no template names are found", async () => {
    const markdown = await buildMarkdown(
      "report.json",
      [makeRecord({ colorScheme: "" }), makeRecord({ colorScheme: "", url: "https://example.com/two" })],
      false
    );

    expect(markdown).not.toContain("## Fix in templates");
    expect(markdown).toContain("- Templates that need fixes: Unavailable, template meta missing");
    expect(markdown).toContain("## Fix site-wide (all pages)");
  });

  it("includes issue coverage with scope labels", async () => {
    const markdown = await buildMarkdown(
      "report.json",
      [
        makeRecord({ colorScheme: "", url: "https://example.com/a" }),
        makeRecord({ colorScheme: "", h1: "", url: "https://example.com/b" }),
      ],
      false
    );

    expect(markdown).toContain("## Issue coverage");
    expect(markdown).toContain("- `colorScheme`: 2/2 pages (site-wide)");
    expect(markdown).toContain("- `h1`: 1/2 pages (page-specific)");
  });

  it("places how-to and issue coverage before fix sections", async () => {
    const markdown = await buildMarkdown(
      "report.json",
      [makeRecord({ colorScheme: "" }), makeRecord({ colorScheme: "", url: "https://example.com/two" })],
      false
    );

    const howToIndex = markdown.indexOf("## How to use this report");
    const coverageIndex = markdown.indexOf("## Issue coverage");
    const siteWideIndex = markdown.indexOf("## Fix site-wide (all pages)");

    expect(howToIndex).toBeGreaterThan(-1);
    expect(coverageIndex).toBeGreaterThan(howToIndex);
    expect(siteWideIndex).toBeGreaterThan(coverageIndex);
  });
});

describe("buildMarkdown tier 1 infra sections", () => {
  it("renders DNS, security headers, and robots.txt sections", async () => {
    const markdown = await buildMarkdown(
      "report.json",
      [makeRecord()],
      false,
      {
        dns: {
          hostname: "example.com",
          records: { a: ["93.184.216.34"], aaaa: [], cname: [], mx: [], txt: [], ns: [] },
          mail: {},
          issues: [{ id: "missing-dmarc", severity: "warning", message: "No DMARC TXT record found." }],
        },
        securityHeaders: {
          url: "https://example.com",
          headers: {},
          issues: [{ id: "missing-hsts", severity: "error", message: "Strict-Transport-Security header is missing on HTTPS." }],
        },
        robotsTxt: {
          url: "https://example.com/robots.txt",
          status: 200,
          sitemapUrls: ["https://example.com/sitemap.xml"],
          issues: [],
        },
      }
    );

    expect(markdown).toContain("## DNS");
    expect(markdown).toContain("- Hostname: `example.com`");
    expect(markdown).toContain("**WARNING** No DMARC TXT record found.");
    expect(markdown).toContain("## Security headers");
    expect(markdown).toContain("**ERROR** Strict-Transport-Security header is missing on HTTPS.");
    expect(markdown).toContain("## Robots.txt & sitemap");
    expect(markdown).toContain("### Robots.txt");
    expect(markdown).toContain("- Sitemaps: `https://example.com/sitemap.xml`");
    expect(markdown).toContain("- **Infra:** 2 issue(s) — DNS (1 issue(s)), security headers (1 issue(s)), robots.txt (0 issue(s))");
  });

  it("renders stack section from crawl, headers, and tracking data", async () => {
    const records = [
      makeRecord({
        tracking: {
          tagManager: [{ provider: "google-tag-manager", id: "GTM-TEST" }],
          analytics: [],
        },
        stack: {
          detections: [
            {
              name: "Next.js",
              categories: ["Framework"],
              confidence: "high",
              evidence: ["html: `data-next-head`"],
              detector: "flightcheck-v1",
            },
          ],
        },
      }),
    ];
    const stackProfile = buildStackProfile(records, {
      securityHeaders: {
        url: "https://example.com",
        headers: { "x-vercel-id": "iad1::abc" },
        issues: [],
      },
    });
    const markdown = await buildMarkdown("report.json", records, false, {}, { stackProfile });

    expect(markdown).toContain("## Stack");
    expect(markdown).toContain("**Next.js**");
    expect(markdown).toContain("### Tracking (flightcheck crawl)");
    expect(markdown).toContain("Google Tag Manager: `GTM-TEST`");
  });

  it("renders sitemap comparison details", async () => {
    const markdown = await buildMarkdown(
      "report.json",
      [makeRecord()],
      false,
      {
        sitemap: {
          sources: [{ url: "https://example.com/sitemap.xml", status: 200, pageUrls: ["https://example.com/", "https://example.com/about"] }],
          sitemapPageUrls: ["https://example.com/", "https://example.com/about"],
          crawledUrls: ["https://example.com/"],
          inSitemapNotCrawled: ["https://example.com/about"],
          crawledNotInSitemap: [],
          mismatchPercent: 50,
          issues: [
            {
              id: "sitemap-url-not-crawled",
              severity: "critical",
              message:
                "1 sitemap URL(s) were not crawled. Probable cause: sitemap URLs must match crawled URLs exactly, including hostname (apex vs www). These URLs were not crawled — check page limits, robots blocks, stale sitemap entries, or a failing sitemap regeneration job (cron).",
            },
          ],
        },
      }
    );

    expect(markdown).toContain("## Robots.txt & sitemap");
    expect(markdown).toContain("### Sitemap");
    expect(markdown).toContain("#### In sitemap but not crawled (CRITICAL)");
    expect(markdown).toContain("`https://example.com/about`");
    expect(markdown).toContain("**CRITICAL** 1 sitemap URL(s) were not crawled.");
    expect(markdown).toContain("- **Infra:** 1 issue(s) — sitemap (1 issue(s))");
  });

  it("renders redirect-only mode without crawl sections", async () => {
    const markdown = await buildMarkdown(
      "redirect-only.json",
      [],
      false,
      {
        redirect: {
          url: "https://example.com/",
          status: 301,
          location: "https://www.example.com/",
          resolvedTarget: "https://www.example.com/",
          headers: {},
          targetStatus: 200,
          isRedirect: true,
          redirectOnly: true,
          issues: [],
        },
      },
      { redirectOnly: true }
    );

    expect(markdown).toContain("## Domain redirect");
    expect(markdown).toContain("### Issues summary");
    expect(markdown).toContain("redirect-only mode");
    expect(markdown).toContain("No crawl performed because the start URL is a domain redirect.");
    expect(markdown).not.toContain("## Security headers");
    expect(markdown).not.toContain("## Robots.txt & sitemap");
  });
});

describe("buildMarkdown tier 1 crawl issues", () => {
  it("puts page-specific image alt issues on per-page fixes with filenames", async () => {
    const markdown = await buildMarkdown(
      "report.json",
      [
        makeRecord({
          url: "https://example.com/a",
          images: {
            issues: [
              {
                id: "missing-alt",
                severity: "error",
                message: "Image is missing an alt attribute. ([hero.jpg](https://example.com/page/hero.jpg))",
              },
            ],
          },
        }),
        makeRecord({ url: "https://example.com/b" }),
      ],
      false
    );

    expect(markdown).toContain("### https://example.com/a");
    expect(markdown).toContain("- [ ] Image is missing an alt attribute. ([hero.jpg](https://example.com/page/hero.jpg))");
    expect(markdown).toContain("- `missing image alt`: 1/2 pages (page-specific)");
  });

  it("puts shared image alt issues in site-wide fixes", async () => {
    const markdown = await buildMarkdown(
      "report.json",
      [
        makeRecord({
          url: "https://example.com/a",
          images: { issues: [{ id: "missing-alt", severity: "error", message: "Image is missing an alt attribute." }] },
        }),
        makeRecord({
          url: "https://example.com/b",
          images: { issues: [{ id: "missing-alt", severity: "error", message: "Image is missing an alt attribute." }] },
        }),
      ],
      false
    );

    expect(markdown).toContain("- [ ] Add alt text to images in shared components");
    expect(markdown).toContain("- **A11y:** 2 issue(s) on 2 page(s)");
    expect(markdown).toContain("- `missing image alt`: 2/2 pages (site-wide)");
  });

  it("puts page-specific a11y issues in per-page fixes", async () => {
    const markdown = await buildMarkdown(
      "report.json",
      [
        makeRecord({
          url: "https://example.com/a",
          a11yStatic: { issues: [{ id: "positive-tabindex", severity: "warning", message: "Element uses a positive tabindex." }] },
        }),
        makeRecord({ url: "https://example.com/b" }),
      ],
      false
    );

    expect(markdown).toContain("### https://example.com/a");
    expect(markdown).toContain("- [ ] Remove positive tabindex values on page");
    expect(markdown).toContain("- **A11y:** 1 issue(s) on 1 page(s)");
    expect(markdown).toContain("- `positive tabindex`: 1/2 pages (page-specific)");
  });
});

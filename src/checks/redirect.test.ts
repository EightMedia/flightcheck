import { describe, expect, it } from "vitest";
import {
  analyzeRedirect,
  analyzeWwwAliasRedirect,
  buildAlternateHostUrl,
  resolveCanonicalUrl,
  resolveChecksForRedirect,
  shouldCheckWwwAlias,
  toggleWwwHostname,
} from "./redirect.js";
import { DEFAULT_CHECK_IDS } from "./types.js";

describe("analyzeRedirect", () => {
  it("detects a healthy permanent redirect", () => {
    const result = analyzeRedirect({
      url: "https://example.com/",
      status: 301,
      location: "https://www.example.com/",
      resolvedTarget: "https://www.example.com/",
      headers: { "strict-transport-security": "max-age=31536000" },
      targetStatus: 200,
    });

    expect(result.isRedirect).toBe(true);
    expect(result.redirectOnly).toBe(true);
    expect(result.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
  });

  it("flags missing location header", () => {
    const result = analyzeRedirect({
      url: "https://example.com/",
      status: 301,
      location: null,
      resolvedTarget: null,
      headers: {},
      targetStatus: null,
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        id: "redirect-missing-location",
        severity: "error",
      })
    );
  });

  it("flags temporary redirect status for a domain redirect", () => {
    const result = analyzeRedirect({
      url: "https://example.com/",
      status: 302,
      location: "https://www.example.com/",
      resolvedTarget: "https://www.example.com/",
      headers: {},
      targetStatus: 200,
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        id: "redirect-temporary-status",
        severity: "warning",
      })
    );
  });

  it("flags unreachable redirect target", () => {
    const result = analyzeRedirect({
      url: "https://example.com/",
      status: 301,
      location: "https://www.example.com/",
      resolvedTarget: "https://www.example.com/",
      headers: {},
      targetStatus: 404,
    });

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        id: "redirect-target-unreachable",
        severity: "error",
      })
    );
  });

  it("treats a 200 response as a normal site entry", () => {
    const result = analyzeRedirect({
      url: "https://www.example.com/",
      status: 200,
      location: null,
      resolvedTarget: null,
      headers: {},
      targetStatus: null,
    });

    expect(result.isRedirect).toBe(false);
    expect(result.redirectOnly).toBe(false);
  });
});

describe("resolveChecksForRedirect", () => {
  it("keeps the full default pipeline for normal sites", () => {
    expect(
      resolveChecksForRedirect(DEFAULT_CHECK_IDS, {
        isRedirect: false,
        redirectOnly: false,
      } as never)
    ).toEqual(DEFAULT_CHECK_IDS);
  });

  it("limits redirect-only domains to dns and analyze", () => {
    expect(
      resolveChecksForRedirect(DEFAULT_CHECK_IDS, {
        redirectOnly: true,
      })
    ).toEqual(["dns", "analyze"]);
  });

  it("honours an explicit crawl request even on redirect domains", () => {
    expect(
      resolveChecksForRedirect(["crawl", "analyze"], {
        redirectOnly: true,
      })
    ).toEqual(["crawl", "analyze"]);
  });
});

describe("toggleWwwHostname", () => {
  it("adds www to a bare hostname", () => {
    expect(toggleWwwHostname("example.com")).toBe("www.example.com");
  });

  it("removes www from a www hostname", () => {
    expect(toggleWwwHostname("www.example.com")).toBe("example.com");
  });
});

describe("buildAlternateHostUrl", () => {
  it("builds the apex URL from a www start URL", () => {
    expect(buildAlternateHostUrl("https://www.example.com/path")).toBe("https://example.com/path");
  });

  it("builds the www URL from an apex start URL", () => {
    expect(buildAlternateHostUrl("https://example.com/")).toBe("https://www.example.com/");
  });
});

describe("resolveCanonicalUrl", () => {
  it("uses the redirect target as canonical host", () => {
    expect(resolveCanonicalUrl("https://example.com/", { resolvedTarget: "https://www.example.com/" })).toBe(
      "https://www.example.com/"
    );
  });

  it("uses the start URL when there is no redirect target", () => {
    expect(resolveCanonicalUrl("https://www.example.com/", { resolvedTarget: null })).toBe("https://www.example.com/");
  });
});

describe("shouldCheckWwwAlias", () => {
  it("checks normal custom domains", () => {
    expect(shouldCheckWwwAlias("example.com")).toBe(true);
    expect(shouldCheckWwwAlias("www.example.com")).toBe(true);
  });

  it("skips localhost, IPs, and IPv6-style hosts", () => {
    expect(shouldCheckWwwAlias("localhost")).toBe(false);
    expect(shouldCheckWwwAlias("127.0.0.1")).toBe(false);
    expect(shouldCheckWwwAlias("::1")).toBe(false);
  });

  it("skips Vercel and Netlify platform preview domains", () => {
    expect(shouldCheckWwwAlias("staywoud.vercel.app")).toBe(false);
    expect(shouldCheckWwwAlias("project-git-main-team.vercel.app")).toBe(false);
    expect(shouldCheckWwwAlias("my-site.netlify.app")).toBe(false);
  });
});

describe("analyzeWwwAliasRedirect", () => {
  it("accepts a healthy apex to www redirect when www is canonical", () => {
    const issues = analyzeWwwAliasRedirect("https://www.example.com/", {
      url: "https://example.com/",
      status: 301,
      location: "https://www.example.com/",
      resolvedTarget: "https://www.example.com/",
      targetStatus: 200,
    });

    expect(issues.filter((entry) => entry.severity === "error")).toHaveLength(0);
  });

  it("accepts a healthy www to apex redirect when apex is canonical", () => {
    const issues = analyzeWwwAliasRedirect("https://example.com/", {
      url: "https://www.example.com/",
      status: 301,
      location: "https://example.com/",
      resolvedTarget: "https://example.com/",
      targetStatus: 200,
    });

    expect(issues.filter((entry) => entry.severity === "error")).toHaveLength(0);
  });

  it("flags when the alternate host does not redirect", () => {
    const issues = analyzeWwwAliasRedirect("https://www.example.com/", {
      url: "https://example.com/",
      status: 200,
      location: null,
      resolvedTarget: null,
      targetStatus: null,
    });

    expect(issues).toContainEqual(
      expect.objectContaining({
        id: "redirect-www-alias-no-redirect",
        severity: "error",
      })
    );
  });

  it("flags when the alternate host redirects to the wrong hostname", () => {
    const issues = analyzeWwwAliasRedirect("https://www.example.com/", {
      url: "https://example.com/",
      status: 301,
      location: "https://other.example.com/",
      resolvedTarget: "https://other.example.com/",
      targetStatus: 200,
    });

    expect(issues).toContainEqual(
      expect.objectContaining({
        id: "redirect-www-alias-wrong-target",
        severity: "error",
      })
    );
  });

  it("flags an unreachable alternate host", () => {
    const issues = analyzeWwwAliasRedirect("https://www.example.com/", {
      url: "https://example.com/",
      status: null,
      location: null,
      resolvedTarget: null,
      targetStatus: null,
    });

    expect(issues).toContainEqual(
      expect.objectContaining({
        id: "redirect-www-alias-unreachable",
        severity: "error",
      })
    );
  });

  it("warns on temporary redirect status for the alternate host", () => {
    const issues = analyzeWwwAliasRedirect("https://example.com/", {
      url: "https://www.example.com/",
      status: 302,
      location: "https://example.com/",
      resolvedTarget: "https://example.com/",
      targetStatus: 200,
    });

    expect(issues).toContainEqual(
      expect.objectContaining({
        id: "redirect-www-alias-temporary-status",
        severity: "warning",
      })
    );
  });
});

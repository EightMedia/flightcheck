import { describe, expect, it } from "vitest";
import { aggregateStackFromRecords, buildStackProfile, buildStackSection } from "./stack.js";
import { detectStackFromDns, detectStackFromHeaders } from "../crawler/stack.js";

describe("stack detection helpers", () => {
  it("returns an array from header analysis", async () => {
    const detections = await detectStackFromHeaders({ "x-vercel-id": "iad1::abc-123" });
    expect(Array.isArray(detections)).toBe(true);
  });

  it("returns an array from DNS analysis", async () => {
    const detections = await detectStackFromDns({
      cname: ["example.netlify.app"],
      ns: [],
      mx: [],
      txt: [],
    });
    expect(Array.isArray(detections)).toBe(true);
  });
});

describe("buildStackSection", () => {
  it("renders stack and tracking details", async () => {
    const profile = await buildStackProfile(
      [
        {
          url: "https://example.com",
          tracking: {
            tagManager: [{ provider: "google-tag-manager", id: "GTM-ABC" }],
            analytics: [{ provider: "google-analytics-ga4", id: "G-123456" }],
          },
          stack: {
            detections: [
              {
                name: "Next.js",
                categories: ["JavaScript frameworks"],
                confidence: "high",
                evidence: ["js: `__NEXT_DATA__`"],
              },
            ],
          },
        },
      ],
      {
        securityHeaders: {
          url: "https://example.com",
          headers: { "x-vercel-id": "iad1::abc" },
          issues: [],
        },
      }
    );

    const lines = buildStackSection(profile, 1);
    const markdown = lines.join("\n");

    expect(markdown).toContain("## Stack");
    expect(markdown).toContain("**Next.js**");
    expect(markdown).toContain("Google Tag Manager: `GTM-ABC`");
    expect(markdown).toContain("Google Analytics (GA4): `G-123456`");
  });

  it("returns empty output when no signals are found", () => {
    const profile = aggregateStackFromRecords([{ url: "https://example.com", tracking: { tagManager: [], analytics: [] } }]);
    expect(buildStackSection(profile, 1)).toEqual([]);
  });
});

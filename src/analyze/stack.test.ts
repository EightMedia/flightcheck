import { describe, expect, it } from "vitest";
import { aggregateStackFromRecords, buildStackProfile, buildStackSection } from "./stack.js";
import { detectStackFromDns, detectStackFromHeaders } from "../crawler/stack.js";

describe("stack detection helpers", () => {
  it("detects Vercel from header analysis", () => {
    const detections = detectStackFromHeaders({ "x-vercel-id": "iad1::abc-123" });
    expect(detections.some((item) => item.name === "Vercel")).toBe(true);
  });

  it("detects Netlify from DNS analysis", () => {
    const detections = detectStackFromDns({
      cname: ["example.netlify.app"],
      ns: [],
      mx: [],
      txt: [],
    });
    expect(detections.some((item) => item.name === "Netlify")).toBe(true);
  });
});

describe("buildStackSection", () => {
  it("renders stack and tracking details", () => {
    const profile = buildStackProfile(
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
                categories: ["Framework"],
                confidence: "high",
                evidence: ["html: `__NEXT_DATA__`"],
                detector: "flightcheck-v1",
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

import { describe, it, expect } from "vitest";
import { extractSameOriginScripts } from "./jsAssets.js";

const ORIGIN = "https://example.com";

describe("extractSameOriginScripts", () => {
  it("returns absolute URLs for same-origin scripts", () => {
    const html = `
      <script src="/static/app.js"></script>
      <script src="https://example.com/vendor.js"></script>
    `;
    const result = extractSameOriginScripts(html, "https://example.com/page", ORIGIN);
    expect(result).toEqual([
      "https://example.com/static/app.js",
      "https://example.com/vendor.js",
    ]);
  });

  it("drops cross-origin and inline scripts", () => {
    const html = `
      <script src="https://cdn.other.com/lib.js"></script>
      <script>console.log("inline")</script>
    `;
    expect(extractSameOriginScripts(html, "https://example.com/page", ORIGIN)).toEqual([]);
  });

  it("dedupes repeated script URLs", () => {
    const html = `
      <script src="/app.js"></script>
      <script src="/app.js"></script>
    `;
    expect(extractSameOriginScripts(html, "https://example.com/", ORIGIN)).toEqual([
      "https://example.com/app.js",
    ]);
  });
});

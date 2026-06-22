import { describe, expect, it } from "vitest";
import { detectStackFromHtml } from "./stack.js";

const pageUrl = "https://example.com/";

describe("detectStackFromHtml", () => {
  it("detects WordPress from generator meta and wp-content paths", async () => {
    const html = `<!doctype html><html><head><meta name="generator" content="WordPress 6.5"></head><body><link href="/wp-content/themes/theme/style.css" rel="stylesheet"></body></html>`;
    const detections = await detectStackFromHtml(html, pageUrl);
    expect(detections.some((item) => item.name === "WordPress")).toBe(true);
  });

  it("returns an array for pages without known fingerprints", async () => {
    const html = `<!doctype html><html><body><p>Hello</p></body></html>`;
    const detections = await detectStackFromHtml(html, pageUrl);
    expect(Array.isArray(detections)).toBe(true);
  });
});

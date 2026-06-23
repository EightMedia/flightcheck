import { describe, expect, it } from "vitest";
import {
  detectStackFromDns,
  detectStackFromHeaders,
  detectStackFromHtml,
} from "./stackDetect.js";

const pageUrl = "https://reto-arnhem.nl/";

describe("detectStackFromHtml", () => {
  it("detects Next.js from data-next-head markers", () => {
    const html = `<!DOCTYPE html><html lang="nl"><head><meta charSet="UTF-8" data-next-head=""/><meta name="viewport" content="width=device-width, initial-scale=1.0" data-next-head=""/><script async="" src="https://www.googletagmanager.com/gtag/js?id=UA-7126581-2"></script></head><body><div id="__next"></div></body></html>`;
    const detections = detectStackFromHtml(html, pageUrl);
    expect(detections.some((item) => item.name === "Next.js")).toBe(true);
    expect(detections.some((item) => item.name === "Node.js")).toBe(true);
  });

  it("does not false-positive on pages with many digit 8 characters", () => {
    const html = `<!doctype html><html><body><p>Eight 8 88 888 reto-arnhem v8.0.1</p></body></html>`;
    const detections = detectStackFromHtml(html, pageUrl);
    expect(detections).toEqual([]);
  });

  it("detects WordPress from generator meta and wp-content paths", () => {
    const html = `<!doctype html><html><head><meta name="generator" content="WordPress 6.5"></head><body><link href="/wp-content/themes/theme/style.css" rel="stylesheet"></body></html>`;
    const detections = detectStackFromHtml(html, pageUrl);
    expect(detections.some((item) => item.name === "WordPress")).toBe(true);
    expect(detections.some((item) => item.name === "PHP")).toBe(true);
  });

  it("detects Sanity from CDN references", () => {
    const html = `<!doctype html><html><body><img src="https://cdn.sanity.io/images/project/production/photo.jpg" alt=""></body></html>`;
    const detections = detectStackFromHtml(html, pageUrl);
    expect(detections.some((item) => item.name === "Sanity")).toBe(true);
  });

  it("detects Algolia from script references", () => {
    const html = `<!doctype html><html><body><script src="https://cdn.jsdelivr.net/npm/algoliasearch@4/dist/algoliasearch-lite.umd.js"></script></body></html>`;
    const detections = detectStackFromHtml(html, pageUrl);
    expect(detections.some((item) => item.name === "Algolia")).toBe(true);
  });
});

describe("detectStackFromHeaders", () => {
  it("detects Vercel from x-vercel-id", () => {
    const detections = detectStackFromHeaders({ "x-vercel-id": "iad1::abc-123" });
    expect(detections.some((item) => item.name === "Vercel")).toBe(true);
  });
});

describe("detectStackFromDns", () => {
  it("detects Netlify from cname", () => {
    const detections = detectStackFromDns({
      cname: ["example.netlify.app"],
      ns: [],
      mx: [],
      txt: [],
    });
    expect(detections.some((item) => item.name === "Netlify")).toBe(true);
  });
});

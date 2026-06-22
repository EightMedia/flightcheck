import { describe, expect, it, vi } from "vitest";
import {
  collectUrlsFromSitemap,
  detectSitemapDocumentType,
  extractSitemapLocValues,
  isRelatedSiteUrl,
  processSitemapLocations,
} from "./sitemap.js";

const EIGHT_INDEX = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<sitemap>
<loc>https://www.eight.nl/sitemap-0.xml</loc>
</sitemap>
</sitemapindex>`;

const EIGHT_URLSET = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://www.eight.nl/</loc></url>
<url><loc>https://www.eight.nl/about</loc></url>
</urlset>`;

describe("detectSitemapDocumentType", () => {
  it("detects sitemap index documents", () => {
    expect(detectSitemapDocumentType(EIGHT_INDEX)).toBe("index");
  });

  it("detects urlset documents", () => {
    expect(detectSitemapDocumentType(EIGHT_URLSET)).toBe("urlset");
  });
});

describe("extractSitemapLocValues", () => {
  it("extracts loc values with namespace and whitespace", () => {
    expect(extractSitemapLocValues(EIGHT_INDEX)).toEqual(["https://www.eight.nl/sitemap-0.xml"]);
    expect(extractSitemapLocValues(EIGHT_URLSET)).toEqual([
      "https://www.eight.nl/",
      "https://www.eight.nl/about",
    ]);
  });
});

describe("isRelatedSiteUrl", () => {
  it("treats apex and www as the same site", () => {
    expect(isRelatedSiteUrl("https://www.eight.nl/about", "https://eight.nl")).toBe(true);
    expect(isRelatedSiteUrl("https://eight.nl/about", "https://www.eight.nl")).toBe(true);
    expect(isRelatedSiteUrl("https://other.example/about", "https://eight.nl")).toBe(false);
  });
});

describe("processSitemapLocations", () => {
  it("queues child sitemaps from a sitemap index", () => {
    const pageUrls = new Set<string>();
    const queue: string[] = [];
    const visited = new Set<string>(["https://eight.nl/sitemap.xml"]);

    processSitemapLocations(EIGHT_INDEX, "https://eight.nl", visited, pageUrls, queue);

    expect(queue).toEqual(["https://www.eight.nl/sitemap-0.xml"]);
    expect(pageUrls.size).toBe(0);
  });

  it("collects page URLs from a urlset", () => {
    const pageUrls = new Set<string>();
    const queue: string[] = [];
    const visited = new Set<string>();

    processSitemapLocations(EIGHT_URLSET, "https://eight.nl", visited, pageUrls, queue);

    expect(queue).toEqual([]);
    expect([...pageUrls]).toEqual(["https://www.eight.nl/", "https://www.eight.nl/about"]);
  });
});

describe("collectUrlsFromSitemap", () => {
  it("follows sitemap index files across apex and www hosts", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "https://eight.nl/sitemap.xml") {
        return new Response(EIGHT_INDEX, { status: 200 });
      }
      if (url === "https://www.eight.nl/sitemap-0.xml") {
        return new Response(EIGHT_URLSET, { status: 200 });
      }
      return new Response("", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const urls = await collectUrlsFromSitemap("https://eight.nl/sitemap.xml", "https://eight.nl", 5000);

    expect([...urls]).toEqual(["https://www.eight.nl/", "https://www.eight.nl/about"]);
    expect(fetchMock).toHaveBeenCalledWith("https://eight.nl/sitemap.xml", expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith("https://www.eight.nl/sitemap-0.xml", expect.any(Object));

    vi.unstubAllGlobals();
  });
});

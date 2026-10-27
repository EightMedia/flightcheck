export type SitemapDocumentType = "index" | "urlset" | "unknown";
export declare function detectSitemapDocumentType(xml: string): SitemapDocumentType;
export declare function extractSitemapLocValues(xml: string): string[];
export declare function canonicalSiteHostname(hostname: string): string;
export declare function isRelatedSiteUrl(url: string, siteOrigin: string): boolean;
export declare function processSitemapLocations(xml: string, siteOrigin: string, visitedSitemaps: Set<string>, pageUrls: Set<string>, sitemapQueue: string[]): void;
export declare function collectUrlsFromSitemap(sitemapUrl: string, origin: string, timeoutMs: number): Promise<Set<string>>;
//# sourceMappingURL=sitemap.d.ts.map
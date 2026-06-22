export const CHECK_IDS = ["crawl", "analyze", "lighthouse", "security-headers", "dns", "robots-txt", "sitemap"];
/** Default pipeline: all implemented checks (Tier 1 infra + crawl + analyze). */
export const DEFAULT_CHECK_IDS = [
    "crawl",
    "security-headers",
    "dns",
    "robots-txt",
    "sitemap",
    "analyze",
];

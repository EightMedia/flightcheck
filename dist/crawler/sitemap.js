import { DEFAULT_MAX_SITEMAPS, DEFAULT_MAX_SITEMAP_URLS, DEFAULT_USER_AGENT } from "./defaults.js";
import { normalizeUrl } from "./urlUtils.js";
export async function collectUrlsFromSitemap(sitemapUrl, origin, timeoutMs) {
    const urls = new Set();
    const visitedSitemaps = new Set();
    const queue = [normalizeUrl(sitemapUrl)];
    while (queue.length > 0 &&
        visitedSitemaps.size < DEFAULT_MAX_SITEMAPS &&
        urls.size < DEFAULT_MAX_SITEMAP_URLS) {
        const currentSitemap = queue.shift();
        if (!currentSitemap || visitedSitemaps.has(currentSitemap))
            continue;
        visitedSitemaps.add(currentSitemap);
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);
            const response = await fetch(currentSitemap, {
                redirect: "follow",
                signal: controller.signal,
                headers: {
                    "user-agent": DEFAULT_USER_AGENT,
                },
            });
            clearTimeout(timeout);
            if (!response.ok)
                continue;
            const text = await response.text();
            const locRegex = /<loc>([\s\S]*?)<\/loc>/gi;
            let match;
            while ((match = locRegex.exec(text)) !== null) {
                const locValue = (match[1] ?? "").trim();
                if (!locValue)
                    continue;
                try {
                    const normalizedLoc = normalizeUrl(locValue);
                    const parsed = new URL(normalizedLoc);
                    if (parsed.origin !== origin)
                        continue;
                    if (/sitemap/i.test(parsed.pathname) && !visitedSitemaps.has(normalizedLoc)) {
                        queue.push(normalizedLoc);
                    }
                    else {
                        urls.add(normalizedLoc);
                    }
                }
                catch {
                    // Ignore malformed loc values.
                }
            }
        }
        catch {
            // Ignore sitemap fetch errors and continue.
        }
    }
    return urls;
}

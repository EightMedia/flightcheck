import * as cheerio from "cheerio";
export function extractSameOriginScripts(html, baseUrl, origin) {
    const $ = cheerio.load(html);
    const urls = new Set();
    $("script[src]").each((_, element) => {
        const src = ($(element).attr("src") ?? "").trim();
        if (!src)
            return;
        try {
            const absolute = new URL(src, baseUrl);
            if (absolute.origin !== origin)
                return;
            if (absolute.protocol !== "http:" && absolute.protocol !== "https:")
                return;
            urls.add(absolute.toString());
        }
        catch {
            // Ignore malformed src values.
        }
    });
    return [...urls];
}

export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/** Vercel / Netlify platform hostnames (*.vercel.app, *.netlify.app) — not custom domains. */
const PLATFORM_PREVIEW_SUFFIXES = [".vercel.app", ".netlify.app"];
/**
 * True for Vercel or Netlify platform default/preview hostnames.
 * Custom production domains mapped onto those platforms return false.
 */
export function isPlatformPreviewHostname(hostname) {
    const lower = hostname.toLowerCase();
    return PLATFORM_PREVIEW_SUFFIXES.some((suffix) => lower === suffix.slice(1) || lower.endsWith(suffix));
}
export function isHttpUrl(urlString) {
    try {
        const url = new URL(urlString);
        return url.protocol === "http:" || url.protocol === "https:";
    }
    catch {
        return false;
    }
}
export function normalizeUrl(urlString) {
    const url = new URL(urlString);
    url.hash = "";
    url.search = "";
    if (url.pathname === "") {
        url.pathname = "/";
    }
    return url.toString();
}
export function resolveUrlMaybe(value, baseUrl) {
    if (!value)
        return "";
    try {
        return normalizeUrl(new URL(value, baseUrl).toString());
    }
    catch {
        return value;
    }
}
export function parseExcludePatterns(rawExcludes) {
    if (rawExcludes.length === 0)
        return [];
    return rawExcludes.flatMap((item) => item.split(",")).map((item) => item.trim()).filter(Boolean);
}
export function matchesExcludePattern(urlString, patterns) {
    if (patterns.length === 0)
        return false;
    const normalized = normalizeUrl(urlString);
    const pathname = new URL(normalized).pathname;
    return patterns.some((pattern) => normalized.includes(pattern) || pathname.includes(pattern));
}

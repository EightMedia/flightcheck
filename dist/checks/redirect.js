import { DEFAULT_TIMEOUT_MS, DEFAULT_USER_AGENT } from "../crawler/defaults.js";
import { isPlatformPreviewHostname, normalizeUrl } from "../crawler/urlUtils.js";
import { issue } from "./issues.js";
import { DEFAULT_CHECK_IDS } from "./types.js";
export const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
export const PERMANENT_REDIRECT_STATUS_CODES = new Set([301, 308]);
export function toggleWwwHostname(hostname) {
    const lower = hostname.toLowerCase();
    return lower.startsWith("www.") ? lower.slice(4) : `www.${lower}`;
}
export function buildAlternateHostUrl(url) {
    const parsed = new URL(normalizeUrl(url));
    parsed.hostname = toggleWwwHostname(parsed.hostname);
    return parsed.toString();
}
export function resolveCanonicalUrl(startUrl, probe) {
    return probe.resolvedTarget ?? normalizeUrl(startUrl);
}
function hostnameFromUrl(url) {
    return new URL(url).hostname.toLowerCase();
}
export function shouldCheckWwwAlias(hostname) {
    if (hostname === "localhost")
        return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname))
        return false;
    if (hostname.includes(":"))
        return false;
    if (isPlatformPreviewHostname(hostname))
        return false;
    return true;
}
export const REDIRECT_ONLY_CHECK_IDS = ["dns", "analyze"];
function headersToRecord(headers) {
    const record = {};
    headers.forEach((value, key) => {
        record[key.toLowerCase()] = value;
    });
    return record;
}
function resolveLocation(url, location) {
    if (!location?.trim())
        return null;
    try {
        return normalizeUrl(new URL(location.trim(), url).toString());
    }
    catch {
        return null;
    }
}
export function analyzeRedirect(input) {
    const issues = [];
    const isRedirect = input.status !== null && REDIRECT_STATUS_CODES.has(input.status);
    const redirectOnly = isRedirect;
    const isHttps = input.url.startsWith("https://");
    if (!isRedirect) {
        return {
            ...input,
            isRedirect: false,
            redirectOnly: false,
            issues,
        };
    }
    if (!input.location) {
        issues.push(issue("redirect-missing-location", "error", "Redirect response is missing a Location header.", "Include a valid Location header on redirect responses pointing at the canonical URL."));
    }
    else if (!input.resolvedTarget) {
        issues.push(issue("redirect-invalid-location", "error", "Redirect Location header is not a valid URL.", "Set Location to an absolute http(s) URL for the redirect target."));
    }
    if (input.status !== null && !PERMANENT_REDIRECT_STATUS_CODES.has(input.status)) {
        issues.push(issue("redirect-temporary-status", "warning", `Redirect uses status ${input.status}; use 301 or 308 for permanent domain redirects.`, "Change the redirect status to 301 or 308 for permanent domain redirects."));
    }
    if (isHttps && !input.headers["strict-transport-security"]) {
        issues.push(issue("redirect-missing-hsts", "warning", "Strict-Transport-Security header is missing on the redirect response.", "Send Strict-Transport-Security on the HTTPS redirect response as well as on final pages."));
    }
    if (input.resolvedTarget && input.targetStatus !== null && input.targetStatus >= 400) {
        issues.push(issue("redirect-target-unreachable", "error", `Redirect target returned status ${input.targetStatus}: ${input.resolvedTarget}`, "Fix the redirect target so it returns a successful response, or point Location at a working URL."));
    }
    return {
        ...input,
        isRedirect,
        redirectOnly,
        issues,
    };
}
export function analyzeWwwAliasRedirect(canonicalUrl, probe) {
    const issues = [];
    const canonicalHost = hostnameFromUrl(canonicalUrl);
    if (probe.status === null) {
        issues.push(issue("redirect-www-alias-unreachable", "error", `Alternate host is unreachable and should redirect to ${canonicalHost}: ${probe.url}`, `Configure DNS and hosting so the alternate host responds and permanently redirects to ${canonicalHost}.`));
        return issues;
    }
    if (!REDIRECT_STATUS_CODES.has(probe.status)) {
        issues.push(issue("redirect-www-alias-no-redirect", "error", `Alternate host should redirect to ${canonicalHost} but returned status ${probe.status}: ${probe.url}`, `Configure the alternate host to respond with 301/308 Location pointing at ${canonicalHost}.`));
        return issues;
    }
    if (!probe.location) {
        issues.push(issue("redirect-www-alias-missing-location", "error", `Alternate host redirect is missing a Location header: ${probe.url}`, `Add a Location header on the alternate-host redirect targeting ${canonicalHost}.`));
    }
    else if (!probe.resolvedTarget) {
        issues.push(issue("redirect-www-alias-invalid-location", "error", `Alternate host redirect Location header is not a valid URL: ${probe.url}`, `Set Location to an absolute http(s) URL on ${canonicalHost}.`));
    }
    else if (hostnameFromUrl(probe.resolvedTarget) !== canonicalHost) {
        issues.push(issue("redirect-www-alias-wrong-target", "error", `Alternate host redirects to ${probe.resolvedTarget} instead of ${canonicalHost}: ${probe.url}`, `Point the alternate-host redirect at the canonical hostname (${canonicalHost}).`));
    }
    if (probe.status !== null && !PERMANENT_REDIRECT_STATUS_CODES.has(probe.status)) {
        issues.push(issue("redirect-www-alias-temporary-status", "warning", `Alternate host redirect uses status ${probe.status}; use 301 or 308 for permanent domain redirects: ${probe.url}`, "Change the alternate-host redirect status to 301 or 308."));
    }
    if (probe.resolvedTarget && probe.targetStatus !== null && probe.targetStatus >= 400) {
        issues.push(issue("redirect-www-alias-target-unreachable", "error", `Alternate host redirect target returned status ${probe.targetStatus}: ${probe.resolvedTarget}`, "Fix the canonical target URL so the alternate-host redirect lands on a successful page."));
    }
    return issues;
}
export function isDefaultCheckSet(requestedChecks) {
    return (requestedChecks.length === DEFAULT_CHECK_IDS.length &&
        DEFAULT_CHECK_IDS.every((id) => requestedChecks.includes(id)));
}
export function resolveChecksForRedirect(requestedChecks, redirect) {
    if (!redirect.redirectOnly) {
        return requestedChecks;
    }
    const explicit = new Set(requestedChecks);
    if (explicit.has("crawl") && !isDefaultCheckSet(requestedChecks)) {
        return requestedChecks;
    }
    return REDIRECT_ONLY_CHECK_IDS.filter((id) => explicit.has(id));
}
export function checksSkippedByRedirect(requestedChecks, effectiveChecks) {
    const effective = new Set(effectiveChecks);
    return requestedChecks.filter((id) => !effective.has(id));
}
async function probeTargetStatus(targetUrl, timeoutMs) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const response = await fetch(targetUrl, {
            method: "HEAD",
            redirect: "manual",
            signal: controller.signal,
            headers: { "user-agent": DEFAULT_USER_AGENT },
        });
        clearTimeout(timeout);
        return response.status;
    }
    catch {
        return null;
    }
}
async function probeRedirect(url, timeoutMs) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const response = await fetch(url, {
            redirect: "manual",
            signal: controller.signal,
            headers: { "user-agent": DEFAULT_USER_AGENT },
        });
        clearTimeout(timeout);
        const location = response.headers.get("location");
        const resolvedTarget = resolveLocation(url, location);
        const headers = headersToRecord(response.headers);
        const targetStatus = resolvedTarget && response.status !== null && REDIRECT_STATUS_CODES.has(response.status)
            ? await probeTargetStatus(resolvedTarget, timeoutMs)
            : null;
        return {
            url,
            status: response.status,
            location,
            resolvedTarget,
            headers,
            targetStatus,
        };
    }
    catch {
        return {
            url,
            status: null,
            location: null,
            resolvedTarget: null,
            headers: {},
            targetStatus: null,
        };
    }
}
export async function runRedirectCheck(startUrl, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const url = normalizeUrl(startUrl);
    const startProbe = await probeRedirect(url, timeoutMs);
    const result = analyzeRedirect(startProbe);
    const canonicalUrl = resolveCanonicalUrl(url, startProbe);
    const canonicalHost = hostnameFromUrl(canonicalUrl);
    if (!shouldCheckWwwAlias(canonicalHost)) {
        return result;
    }
    const alternateUrl = buildAlternateHostUrl(canonicalUrl);
    const alternateProbe = hostnameFromUrl(url) === hostnameFromUrl(alternateUrl)
        ? startProbe
        : await probeRedirect(alternateUrl, timeoutMs);
    const wwwAliasIssues = analyzeWwwAliasRedirect(canonicalUrl, alternateProbe);
    result.wwwAlias = {
        canonicalUrl,
        alternateUrl,
        status: alternateProbe.status,
        location: alternateProbe.location,
        resolvedTarget: alternateProbe.resolvedTarget,
        targetStatus: alternateProbe.targetStatus,
    };
    result.issues.push(...wwwAliasIssues);
    return result;
}

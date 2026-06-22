import robotsParser from "robots-parser";
import { issue } from "./issues.js";
import { DEFAULT_USER_AGENT } from "../crawler/defaults.js";
function extractSitemapUrls(body) {
    const urls = [];
    for (const line of body.split("\n")) {
        const match = line.match(/^\s*sitemap:\s*(.+)\s*$/i);
        if (match) {
            urls.push(match[1].trim());
        }
    }
    return urls;
}
function hasMalformedRobotsLines(body) {
    for (const line of body.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#"))
            continue;
        if (/^sitemap:/i.test(trimmed))
            continue;
        const colonIndex = trimmed.indexOf(":");
        if (colonIndex === -1) {
            if (/^(user-agent|disallow|allow|crawl-delay)\b/i.test(trimmed)) {
                return true;
            }
            continue;
        }
        const directive = trimmed.slice(0, colonIndex).trim();
        const value = trimmed.slice(colonIndex + 1).trim();
        if (/^(disallow|allow|crawl-delay)$/i.test(directive) && value.length === 0) {
            return true;
        }
    }
    return false;
}
function blocksAllUserAgents(body, robotsUrl) {
    try {
        const createRobotsParser = robotsParser;
        const parsed = createRobotsParser(robotsUrl, body);
        return parsed.isAllowed(`${new URL(robotsUrl).origin}/`, DEFAULT_USER_AGENT) === false;
    }
    catch {
        return false;
    }
}
export function analyzeRobotsTxt(input) {
    const issues = [];
    const { url, status, body } = input;
    if (status === null || status === 404) {
        issues.push(issue("robots-missing", "warning", "robots.txt is missing."));
        return { url, status, body, sitemapUrls: [], issues };
    }
    if (!body) {
        issues.push(issue("robots-unparseable", "error", "robots.txt response body is empty."));
        return { url, status, body, sitemapUrls: [], issues };
    }
    if (hasMalformedRobotsLines(body)) {
        issues.push(issue("robots-unparseable", "error", "robots.txt contains malformed directives."));
    }
    let sitemapUrls = [];
    try {
        const createRobotsParser = robotsParser;
        const parsed = createRobotsParser(url, body);
        sitemapUrls = parsed.getSitemaps();
    }
    catch {
        issues.push(issue("robots-unparseable", "error", "robots.txt could not be parsed."));
        return { url, status, body, sitemapUrls: [], issues };
    }
    if (sitemapUrls.length === 0) {
        sitemapUrls = extractSitemapUrls(body);
    }
    if (blocksAllUserAgents(body, url)) {
        issues.push(issue("robots-blocks-all", "critical", "robots.txt disallows all crawling for User-agent: *."));
    }
    if (sitemapUrls.length === 0) {
        issues.push(issue("robots-missing-sitemap", "warning", "robots.txt has no Sitemap directive."));
    }
    return { url, status, body, sitemapUrls, issues };
}
export async function runRobotsTxtCheck(startUrl, timeoutMs = 10_000) {
    const origin = new URL(startUrl).origin;
    const robotsUrl = `${origin}/robots.txt`;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const response = await fetch(robotsUrl, {
            redirect: "follow",
            signal: controller.signal,
            headers: { "user-agent": DEFAULT_USER_AGENT },
        });
        clearTimeout(timeout);
        const body = response.ok ? await response.text() : undefined;
        return analyzeRobotsTxt({ url: robotsUrl, status: response.status, body });
    }
    catch {
        return analyzeRobotsTxt({ url: robotsUrl, status: null });
    }
}

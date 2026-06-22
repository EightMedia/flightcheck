function severityLabel(severity) {
    return severity.toUpperCase();
}
function issueTodo(issue) {
    return `- [ ] **${severityLabel(issue.severity)}** ${issue.message}`;
}
export function buildRedirectSection(result) {
    const lines = [
        "## Domain redirect",
        "",
        `- URL: \`${result.url}\``,
        `- Status: \`${result.status ?? "unreachable"}\``,
    ];
    if (result.location) {
        lines.push(`- Location: \`${result.location}\``);
    }
    if (result.resolvedTarget) {
        lines.push(`- Resolved target: \`${result.resolvedTarget}\``);
    }
    if (result.targetStatus !== null) {
        lines.push(`- Target response: \`${result.targetStatus}\``);
    }
    if (result.wwwAlias) {
        lines.push("");
        lines.push(`- Canonical host: \`${new URL(result.wwwAlias.canonicalUrl).hostname}\``);
        lines.push(`- Alternate host: \`${result.wwwAlias.alternateUrl}\``);
        lines.push(`- Alternate status: \`${result.wwwAlias.status ?? "unreachable"}\``);
        if (result.wwwAlias.location) {
            lines.push(`- Alternate Location: \`${result.wwwAlias.location}\``);
        }
        if (result.wwwAlias.resolvedTarget) {
            lines.push(`- Alternate resolved target: \`${result.wwwAlias.resolvedTarget}\``);
        }
    }
    lines.push("");
    if (result.issues.length === 0) {
        lines.push("- Redirect looks correctly configured.");
    }
    else {
        lines.push(...result.issues.map(issueTodo));
    }
    lines.push("");
    return lines;
}
export function buildDnsSection(dns) {
    const lines = ["## DNS", "", `- Hostname: \`${dns.hostname}\``];
    if (dns.records.a.length > 0) {
        lines.push(`- A: ${dns.records.a.join(", ")}`);
    }
    if (dns.records.aaaa.length > 0) {
        lines.push(`- AAAA: ${dns.records.aaaa.join(", ")}`);
    }
    if (dns.records.cname.length > 0) {
        lines.push(`- CNAME: ${dns.records.cname.join(", ")}`);
    }
    if (dns.records.mx.length > 0) {
        lines.push(`- MX: ${dns.records.mx.map((entry) => `${entry.exchange} (${entry.priority})`).join(", ")}`);
    }
    if (dns.records.ns.length > 0) {
        lines.push(`- NS: ${dns.records.ns.join(", ")}`);
    }
    if (dns.mail.spf) {
        lines.push(`- SPF: \`${dns.mail.spf}\``);
    }
    if (dns.mail.dmarc) {
        lines.push(`- DMARC: \`${dns.mail.dmarc}\``);
    }
    lines.push("");
    if (dns.issues.length === 0) {
        lines.push("- No DNS issues found.");
    }
    else {
        lines.push("### Issues", "");
        lines.push(...dns.issues.map(issueTodo));
    }
    lines.push("");
    return lines;
}
export function buildSecurityHeadersSection(result) {
    const lines = ["## Security headers", "", `- Checked: \`${result.url}\``, ""];
    if (result.issues.length === 0) {
        lines.push("- No security header issues found.");
    }
    else {
        lines.push(...result.issues.map(issueTodo));
    }
    lines.push("");
    return lines;
}
export function buildRobotsTxtSection(result) {
    const lines = [
        "### Robots.txt",
        "",
        `- URL: \`${result.url}\``,
        `- Status: \`${result.status ?? "unreachable"}\``,
    ];
    if (result.sitemapUrls.length > 0) {
        lines.push(`- Sitemaps: ${result.sitemapUrls.map((url) => `\`${url}\``).join(", ")}`);
    }
    lines.push("");
    if (result.issues.length === 0) {
        lines.push("- No robots.txt issues found.");
    }
    else {
        lines.push(...result.issues.map(issueTodo));
    }
    lines.push("");
    return lines;
}
function listSampleUrls(urls, limit = 10) {
    const lines = urls.slice(0, limit).map((url) => `- \`${url}\``);
    if (urls.length > limit) {
        lines.push(`- ...and ${urls.length - limit} more`);
    }
    return lines;
}
export function buildSitemapSection(result) {
    const lines = ["### Sitemap", ""];
    for (const source of result.sources) {
        lines.push(`- \`${source.url}\`: status \`${source.status ?? "unreachable"}\`, ${source.pageUrls.length} URL(s)`);
    }
    lines.push(`- Compared: ${result.sitemapPageUrls.length} sitemap URL(s) vs ${result.crawledUrls.length} crawled URL(s)`);
    lines.push(`- Mismatch: ${result.mismatchPercent.toFixed(1)}%`);
    lines.push("");
    if (result.inSitemapNotCrawled.length > 0) {
        lines.push("#### In sitemap but not crawled (CRITICAL)", "");
        lines.push(...listSampleUrls(result.inSitemapNotCrawled));
        lines.push("");
    }
    if (result.crawledNotInSitemap.length > 0) {
        lines.push("#### Crawled but missing from sitemap (CRITICAL)", "");
        lines.push(...listSampleUrls(result.crawledNotInSitemap));
        lines.push("");
    }
    if (result.issues.length === 0) {
        lines.push("- No sitemap issues found.");
    }
    else {
        lines.push(...result.issues.map(issueTodo));
    }
    lines.push("");
    return lines;
}
export function buildRobotsAndSitemapSection(robotsTxt, sitemap) {
    if (!robotsTxt && !sitemap)
        return [];
    const lines = ["## Robots.txt & sitemap", ""];
    if (robotsTxt)
        lines.push(...buildRobotsTxtSection(robotsTxt));
    if (sitemap)
        lines.push(...buildSitemapSection(sitemap));
    return lines;
}
export function countTier1InfraIssues(tier1) {
    return ((tier1.redirect?.issues.length ?? 0) +
        (tier1.dns?.issues.length ?? 0) +
        (tier1.securityHeaders?.issues.length ?? 0) +
        (tier1.robotsTxt?.issues.length ?? 0) +
        (tier1.sitemap?.issues.length ?? 0));
}
export function buildTier1SummaryLines(tier1, imageIssuePages, imageIssueCount, a11yIssuePages, a11yIssueCount, redirectOnly = false) {
    const lines = [];
    const parts = [];
    if (redirectOnly) {
        lines.push("- Mode: redirect-only (start URL returns a redirect; crawl and sitemap checks were skipped)");
    }
    if (tier1.redirect) {
        parts.push(`redirect (${tier1.redirect.issues.length} issue(s))`);
    }
    if (tier1.dns) {
        parts.push(`DNS (${tier1.dns.issues.length} issue(s))`);
    }
    if (tier1.securityHeaders) {
        parts.push(`security headers (${tier1.securityHeaders.issues.length} issue(s))`);
    }
    if (tier1.robotsTxt) {
        parts.push(`robots.txt (${tier1.robotsTxt.issues.length} issue(s))`);
    }
    if (tier1.sitemap) {
        parts.push(`sitemap (${tier1.sitemap.issues.length} issue(s))`);
    }
    if (parts.length > 0) {
        lines.push(`- Tier 1 infra: ${parts.join(", ")}`);
    }
    if (imageIssueCount > 0) {
        lines.push(`- Image alt issues: ${imageIssueCount} on ${imageIssuePages} page(s)`);
    }
    if (a11yIssueCount > 0) {
        lines.push(`- Static a11y issues: ${a11yIssueCount} on ${a11yIssuePages} page(s)`);
    }
    return lines;
}

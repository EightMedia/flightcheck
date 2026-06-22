import type { CheckIssue } from "../checks/issues.js";
import type { DnsCheckResult } from "../checks/dns.js";
import type { RedirectCheckResult } from "../checks/redirect.js";
import type { RobotsTxtCheckResult } from "../checks/robots-txt.js";
import type { SecurityHeadersCheckResult } from "../checks/security-headers.js";
import type { SitemapCheckResult } from "../checks/sitemap.js";

export type Tier1ReportData = {
  redirect?: RedirectCheckResult;
  securityHeaders?: SecurityHeadersCheckResult;
  dns?: DnsCheckResult;
  robotsTxt?: RobotsTxtCheckResult;
  sitemap?: SitemapCheckResult;
};

export type BuildMarkdownOptions = {
  redirectOnly?: boolean;
  stackProfile?: import("./stack.js").StackProfile;
};

function severityLabel(severity: string): string {
  return severity.toUpperCase();
}

function issueTodo(issue: CheckIssue): string {
  return `- [ ] **${severityLabel(issue.severity)}** ${issue.message}`;
}

export function buildRedirectSection(result: RedirectCheckResult): string[] {
  const lines: string[] = [
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
  } else {
    lines.push(...result.issues.map(issueTodo));
  }
  lines.push("");
  return lines;
}

export function buildDnsSection(dns: DnsCheckResult): string[] {
  const lines: string[] = ["## DNS", "", `- Hostname: \`${dns.hostname}\``];

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
  } else {
    lines.push("### Issues", "");
    lines.push(...dns.issues.map(issueTodo));
  }
  lines.push("");
  return lines;
}

export function buildSecurityHeadersSection(result: SecurityHeadersCheckResult): string[] {
  const lines: string[] = ["## Security headers", "", `- Checked: \`${result.url}\``, ""];

  if (result.issues.length === 0) {
    lines.push("- No security header issues found.");
  } else {
    lines.push(...result.issues.map(issueTodo));
  }
  lines.push("");
  return lines;
}

export function buildRobotsTxtSection(result: RobotsTxtCheckResult): string[] {
  const lines: string[] = [
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
  } else {
    lines.push(...result.issues.map(issueTodo));
  }
  lines.push("");
  return lines;
}

function listSampleUrls(urls: string[], limit = 10): string[] {
  const lines = urls.slice(0, limit).map((url) => `- \`${url}\``);
  if (urls.length > limit) {
    lines.push(`- ...and ${urls.length - limit} more`);
  }
  return lines;
}

export function buildSitemapSection(result: SitemapCheckResult): string[] {
  const lines: string[] = ["### Sitemap", ""];

  for (const source of result.sources) {
    lines.push(
      `- \`${source.url}\`: status \`${source.status ?? "unreachable"}\`, ${source.pageUrls.length} URL(s)`
    );
  }

  lines.push(
    `- Compared: ${result.sitemapPageUrls.length} sitemap URL(s) vs ${result.crawledUrls.length} crawled URL(s)`
  );
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
  } else {
    lines.push(...result.issues.map(issueTodo));
  }
  lines.push("");
  return lines;
}

export function buildRobotsAndSitemapSection(robotsTxt?: RobotsTxtCheckResult, sitemap?: SitemapCheckResult): string[] {
  if (!robotsTxt && !sitemap) return [];

  const lines: string[] = ["## Robots.txt & sitemap", ""];
  if (robotsTxt) lines.push(...buildRobotsTxtSection(robotsTxt));
  if (sitemap) lines.push(...buildSitemapSection(sitemap));
  return lines;
}

export function countTier1InfraIssues(tier1: Tier1ReportData): number {
  return (
    (tier1.redirect?.issues.length ?? 0) +
    (tier1.dns?.issues.length ?? 0) +
    (tier1.securityHeaders?.issues.length ?? 0) +
    (tier1.robotsTxt?.issues.length ?? 0) +
    (tier1.sitemap?.issues.length ?? 0)
  );
}

export type CrawlIssueCounts = {
  seo: { issueCount: number; pageCount: number };
  a11y: { issueCount: number; pageCount: number };
  bestPractices: { issueCount: number; pageCount: number };
  security: { issueCount: number; pageCount: number };
};

function buildInfraSummaryParts(tier1: Tier1ReportData, redirectOnly: boolean): string[] {
  const parts: string[] = [];
  if (redirectOnly) {
    parts.push("redirect-only mode");
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
  return parts;
}

export function buildIssuesSummarySection(
  tier1: Tier1ReportData,
  crawlCounts: CrawlIssueCounts,
  redirectOnly: boolean,
  performanceChecked = false,
  performanceIssueCount = 0,
  performancePageCount = 0
): string[] {
  const lines: string[] = ["### Issues summary", ""];
  const infraParts = buildInfraSummaryParts(tier1, redirectOnly);
  const infraIssueCount = countTier1InfraIssues(tier1);

  if (infraParts.length > 0) {
    lines.push(`- **Infra:** ${infraIssueCount} issue(s) — ${infraParts.join(", ")}`);
  }

  if (!redirectOnly) {
    lines.push(
      `- **SEO:** ${crawlCounts.seo.issueCount} issue(s) on ${crawlCounts.seo.pageCount} page(s)`,
      `- **A11y:** ${crawlCounts.a11y.issueCount} issue(s) on ${crawlCounts.a11y.pageCount} page(s) — image alt + static hints`,
      `- **Best practices:** ${crawlCounts.bestPractices.issueCount} issue(s) on ${crawlCounts.bestPractices.pageCount} page(s) — landmarks, robots, template meta`
    );
    if (crawlCounts.security.issueCount > 0) {
      lines.push(
        `- **Security:** ${crawlCounts.security.issueCount} finding(s) on ${crawlCounts.security.pageCount} page(s)`
      );
    }
    if (performanceChecked) {
      lines.push(`- **Performance:** ${performanceIssueCount} issue(s) on ${performancePageCount} page(s)`);
    } else {
      lines.push("- **Performance:** not checked");
    }
  } else if (infraParts.length === 0) {
    lines.push("- No issues found.");
  }

  lines.push("");
  return lines;
}

import type { CheckIssue, CheckIssueSeverity } from "../checks/issues.js";
import { formatCliFlags, getPackageVersion } from "../version.js";
import type { StackProfile } from "./stack.js";
import {
  buildReportAnalysis,
  type BuildMarkdownOptions,
  type ReportAnalysis,
  type ReportRecord,
  type Tier1ReportData,
} from "./report.js";

export const FLIGHTCHECK_REPORT_VERSION = 1 as const;

export type FindingSeverity = CheckIssueSeverity;
export type FindingCategory =
  | "infra"
  | "seo"
  | "a11y"
  | "best-practices"
  | "security"
  | "performance";
export type FindingScope = "site-wide" | "template" | "page" | "origin";

export type ReportStackEntry = {
  name: string;
  categories: string[];
  confidence: string;
  evidence: string[];
  pageCount?: number;
};

export type ReportFinding = {
  id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  scope: FindingScope;
  title: string;
  message: string;
  /** Concrete remediation suggestion when available. */
  fix?: string;
  template?: string;
  urls?: string[];
  count?: number;
};

export type ReportReviewPage = {
  url: string;
  status: number | null;
  reason: string;
};

export type FlightcheckReportAnalysis = {
  pagesAnalyzed: number;
  pagesWithIssues: number;
  findingCounts: Record<FindingSeverity, number>;
  stack: ReportStackEntry[];
  templates: string[];
  dns?: { hostname: string; summary: string[] };
  redirect?: {
    url: string;
    status: number | null;
    location: string | null;
    issueCount: number;
  };
  reviewPages: ReportReviewPage[];
};

export type FlightcheckReport = {
  /** Report JSON schema version (not the npm package version). */
  version: typeof FLIGHTCHECK_REPORT_VERSION;
  /** npm package version of Flightcheck that produced this report. */
  flightcheckVersion: string;
  /** CLI argv flags used for this run (after node/script); empty when programmatic without flags. */
  flags: string[];
  generatedAt: string;
  source: string;
  redirectOnly: boolean;
  analysis: FlightcheckReportAnalysis;
  findings: ReportFinding[];
};

const A11Y_IDS = new Set([
  "missing-alt",
  "empty-alt",
  "generic-alt",
  "heading-skip",
  "multiple-h1",
  "unlabeled-input",
  "missing-lang",
  "positive-tabindex",
]);

const BEST_PRACTICE_IDS = new Set([
  "noindex",
  "nofollow",
  "missing-template",
  "main-missing",
  "main-multiple",
]);

const FIELD_TITLES: Record<string, string> = {
  h1: "Missing main heading (h1)",
  title: "Missing page title",
  metaTitle: "Missing meta title",
  metaDescription: "Missing meta description",
  charset: "Missing character set",
  language: "Missing language attribute",
  colorScheme: "Missing color-scheme meta tag",
  themeColor: "Missing theme-color meta tag",
  doctype: "Missing doctype",
  viewport: "Missing viewport meta tag",
  canonical: "Missing canonical URL",
  favicon: "Missing favicon",
  icons: "Missing icon links",
  "og.title": "Missing Open Graph title",
  "og.description": "Missing Open Graph description",
  "og.image": "Missing Open Graph image",
  "og.url": "Missing Open Graph URL",
  "og.type": "Missing Open Graph type",
  "og.siteName": "Missing Open Graph site name",
  "twitter.card": "Missing Twitter card type",
  "twitter.title": "Missing Twitter title",
  "twitter.description": "Missing Twitter description",
  "twitter.image": "Missing Twitter image",
};

const BEST_PRACTICE_COPY: Record<string, { title: string; message: string; severity: FindingSeverity }> = {
  noindex: {
    title: "Pages tell search engines not to index them",
    message: "Remove noindex from the robots meta tag so search engines can include these pages.",
    severity: "warning",
  },
  nofollow: {
    title: "Pages tell search engines not to follow links",
    message: "Remove nofollow from the robots meta tag unless this is intentional.",
    severity: "warning",
  },
  "missing-template": {
    title: "Template meta tag is missing",
    message: "Add a template meta tag so reports can group issues by page type.",
    severity: "review",
  },
  "main-missing": {
    title: "Main content landmark is missing",
    message: "Add a single <main> landmark so assistive technology can find the page content.",
    severity: "review",
  },
  "main-multiple": {
    title: "Multiple main landmarks found",
    message: "Keep exactly one <main> landmark per page.",
    severity: "review",
  },
};

const A11Y_COPY: Record<string, { title: string; message: string }> = {
  "missing-alt": {
    title: "Images without alt text",
    message: "Add descriptive alt text to images so screen readers can describe them.",
  },
  "empty-alt": {
    title: "Images with empty alt text",
    message: "Review empty alt attributes — decorative images are fine; informative ones need a description.",
  },
  "generic-alt": {
    title: "Images with generic alt text",
    message: "Replace generic alt text (for example “image”) with a meaningful description.",
  },
  "heading-skip": {
    title: "Heading levels are skipped",
    message: "Keep heading levels in order (h1 → h2 → h3) without skipping.",
  },
  "multiple-h1": {
    title: "More than one h1 on the page",
    message: "Use a single h1 that describes the main topic of the page.",
  },
  "unlabeled-input": {
    title: "Form fields without labels",
    message: "Give every form input a visible or accessible label.",
  },
  "missing-lang": {
    title: "Page language is not set",
    message: "Add a lang attribute on the html element (for example lang=\"nl\" or lang=\"en\").",
  },
  "positive-tabindex": {
    title: "Positive tabindex values",
    message: "Remove positive tabindex values; they disrupt natural keyboard order.",
  },
};

const SEVERITY_ORDER: FindingSeverity[] = ["critical", "error", "warning", "review"];

const SEVERITY_HEADINGS: Record<FindingSeverity, string> = {
  critical: "Critical",
  error: "Errors",
  warning: "Warnings",
  review: "Worth reviewing",
};

function emptyCounts(): Record<FindingSeverity, number> {
  return { critical: 0, error: 0, warning: 0, review: 0 };
}

function countFindings(findings: ReportFinding[]): Record<FindingSeverity, number> {
  const counts = emptyCounts();
  for (const finding of findings) counts[finding.severity] += 1;
  return counts;
}

function sortFindings(findings: ReportFinding[]): ReportFinding[] {
  return [...findings].sort((a, b) => {
    const severityDiff = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (severityDiff !== 0) return severityDiff;
    const categoryDiff = a.category.localeCompare(b.category);
    if (categoryDiff !== 0) return categoryDiff;
    return a.title.localeCompare(b.title);
  });
}

function stackEntries(profile: StackProfile): ReportStackEntry[] {
  return profile.detections.map((detection) => ({
    name: detection.name,
    categories: detection.categories,
    confidence: detection.confidence,
    evidence: detection.evidence,
    pageCount: detection.pageCount,
  }));
}

function reviewReason(url: string, status: number | null): string | null {
  if (status === 200 || status === null) return null;
  if (status === 404) return "Page returned 404 — often a bad link or crawler artifact.";
  if (status === 401 || status === 403) return "Page requires authentication or is blocked.";
  if (status >= 500) return "Server error while fetching this page.";
  return `Unexpected HTTP status ${status}.`;
}

function fieldTitle(field: string): string {
  return FIELD_TITLES[field] ?? `Missing ${field}`;
}

function fieldMessage(field: string, scope: FindingScope, template?: string): string {
  const where =
    scope === "site-wide"
      ? "the shared site layout"
      : scope === "template"
        ? `the “${template ?? "template"}” template`
        : "this page";
  return `Add ${FIELD_TITLES[field]?.replace(/^Missing /i, "").toLowerCase() ?? field} in ${where}.`;
}

function findingFromCheck(
  issue: CheckIssue,
  category: FindingCategory,
  scope: FindingScope,
  extras: Partial<ReportFinding> = {}
): ReportFinding {
  return {
    id: issue.id,
    severity: issue.severity,
    category,
    scope,
    title: humanizeId(issue.id),
    message: issue.message,
    ...(issue.fix ? { fix: issue.fix } : {}),
    ...extras,
  };
}

function humanizeId(id: string): string {
  return id
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function pushUnique(findings: ReportFinding[], finding: ReportFinding): void {
  findings.push(finding);
}

function collectSeoFindings(
  fields: string[],
  scope: FindingScope,
  count: number,
  extras: Partial<ReportFinding> = {}
): ReportFinding[] {
  return fields.map((field) => {
    const message = fieldMessage(field, scope, extras.template);
    return {
      id: field,
      severity: "error" as const,
      category: "seo" as const,
      scope,
      title: fieldTitle(field),
      message,
      fix: message,
      count,
      ...extras,
    };
  });
}

function collectBestPracticeFindings(
  keys: string[],
  scope: FindingScope,
  count: number,
  extras: Partial<ReportFinding> = {}
): ReportFinding[] {
  return keys
    .filter((key) => BEST_PRACTICE_IDS.has(key))
    .map((key) => {
      const copy = BEST_PRACTICE_COPY[key];
      const message = copy?.message ?? `Fix ${key}.`;
      return {
        id: key,
        severity: copy?.severity ?? "review",
        category: "best-practices" as const,
        scope,
        title: copy?.title ?? humanizeId(key),
        message,
        fix: message,
        count,
        ...extras,
      };
    });
}

function collectA11yFindings(
  keys: string[],
  scope: FindingScope,
  count: number,
  extras: Partial<ReportFinding> = {}
): ReportFinding[] {
  return keys
    .filter((key) => A11Y_IDS.has(key))
    .map((key) => {
      const copy = A11Y_COPY[key];
      const message = copy?.message ?? `Fix accessibility issue: ${key}.`;
      return {
        id: key,
        severity: "warning" as const,
        category: "a11y" as const,
        scope,
        title: copy?.title ?? humanizeId(key),
        message,
        fix: message,
        count,
        ...extras,
      };
    });
}

function aggregatePageFindings(
  pageFixes: ReportAnalysis["pageFixes"],
  pick: (fix: ReportAnalysis["pageFixes"][number]) => Array<{ id: string; message?: string }>
): Map<string, { urls: string[]; message?: string }> {
  const map = new Map<string, { urls: string[]; message?: string }>();
  for (const fix of pageFixes) {
    if (fix.item.status !== 200) continue;
    for (const entry of pick(fix)) {
      const current = map.get(entry.id) ?? { urls: [], message: entry.message };
      current.urls.push(fix.item.url);
      if (entry.message) current.message = entry.message;
      map.set(entry.id, current);
    }
  }
  return map;
}

function buildFindings(analysis: ReportAnalysis, tier1: Tier1ReportData): ReportFinding[] {
  const findings: ReportFinding[] = [];
  const { totalPages } = analysis;

  if (tier1.redirect) {
    for (const issue of tier1.redirect.issues) {
      pushUnique(findings, findingFromCheck(issue, "infra", "origin"));
    }
  }
  if (tier1.dns) {
    for (const issue of tier1.dns.issues) {
      pushUnique(findings, findingFromCheck(issue, "infra", "origin"));
    }
  }
  if (tier1.securityHeaders) {
    for (const issue of tier1.securityHeaders.issues) {
      pushUnique(findings, findingFromCheck(issue, "infra", "origin"));
    }
  }
  if (tier1.robotsTxt) {
    for (const issue of tier1.robotsTxt.issues) {
      pushUnique(findings, findingFromCheck(issue, "infra", "origin"));
    }
  }
  if (tier1.sitemap) {
    for (const issue of tier1.sitemap.issues) {
      pushUnique(findings, findingFromCheck(issue, "infra", "origin"));
    }
  }
  if (tier1.agentReady) {
    for (const issue of tier1.agentReady.issues) {
      pushUnique(findings, findingFromCheck(issue, "infra", "origin"));
    }
  }

  for (const page of analysis.securityPages) {
    for (const secret of page.secrets) {
      pushUnique(findings, {
        id: `secret-${secret.provider}-${secret.type}`,
        severity: secret.severity === "critical" ? "critical" : "review",
        category: "security",
        scope: "page",
        title: `Exposed ${secret.provider} ${secret.type}`,
        message: `Rotate or remove this secret. Masked value: ${secret.masked} (source: ${secret.source}).`,
        fix: "Remove the secret from client-side HTML/JS, rotate the credential, and load secrets only from a server-side env.",
        urls: [page.url],
        count: 1,
      });
    }
  }

  findings.push(
    ...collectSeoFindings([...analysis.siteWideFields], "site-wide", totalPages),
    ...collectBestPracticeFindings([...analysis.siteWideWarningKeys], "site-wide", totalPages),
    ...collectA11yFindings([...analysis.siteWideTier1Keys], "site-wide", totalPages)
  );

  for (const [template, fields] of analysis.templateFieldMap) {
    if (fields.size === 0) continue;
    const count = analysis.templateGroups.get(template)?.length ?? 0;
    findings.push(...collectSeoFindings([...fields], "template", count, { template }));
  }
  for (const [template, keys] of analysis.templateWarningKeyMap) {
    const filtered = [...keys].filter((key) => BEST_PRACTICE_IDS.has(key));
    if (filtered.length === 0) continue;
    const count = analysis.templateGroups.get(template)?.length ?? 0;
    findings.push(...collectBestPracticeFindings(filtered, "template", count, { template }));
  }
  for (const [template, keys] of analysis.templateTier1KeyMap) {
    const filtered = [...keys].filter((key) => A11Y_IDS.has(key));
    if (filtered.length === 0) continue;
    const count = analysis.templateGroups.get(template)?.length ?? 0;
    findings.push(...collectA11yFindings(filtered, "template", count, { template }));
  }

  if (!analysis.redirectOnly) {
    const seoById = aggregatePageFindings(analysis.pageFixes, (fix) =>
      fix.remainingFields.map((id) => ({ id }))
    );
    for (const [id, { urls }] of seoById) {
      const message = fieldMessage(id, "page");
      findings.push({
        id,
        severity: "error",
        category: "seo",
        scope: "page",
        title: fieldTitle(id),
        message,
        fix: message,
        urls,
        count: urls.length,
      });
    }

    const bestById = aggregatePageFindings(analysis.pageFixes, (fix) =>
      fix.remainingWarningKeys.filter((key) => BEST_PRACTICE_IDS.has(key)).map((id) => ({ id }))
    );
    for (const [id, { urls }] of bestById) {
      const copy = BEST_PRACTICE_COPY[id];
      const message = copy?.message ?? `Fix ${id}.`;
      findings.push({
        id,
        severity: copy?.severity ?? "review",
        category: "best-practices",
        scope: "page",
        title: copy?.title ?? humanizeId(id),
        message,
        fix: message,
        urls,
        count: urls.length,
      });
    }

    const a11yById = aggregatePageFindings(analysis.pageFixes, (fix) =>
      fix.remainingA11yIssues.map((issue) => ({ id: issue.id, message: issue.message }))
    );
    for (const [id, { urls, message }] of a11yById) {
      const copy = A11Y_COPY[id];
      const resolved = message ?? copy?.message ?? `Fix accessibility issue: ${id}.`;
      findings.push({
        id,
        severity: "warning",
        category: "a11y",
        scope: "page",
        title: copy?.title ?? humanizeId(id),
        message: resolved,
        fix: copy?.message ?? resolved,
        urls,
        count: urls.length,
      });
    }
  }

  return sortFindings(findings);
}

function buildDnsSummary(tier1: Tier1ReportData): FlightcheckReportAnalysis["dns"] | undefined {
  if (!tier1.dns) return undefined;
  const dns = tier1.dns;
  const summary: string[] = [];
  if (dns.records.a.length > 0) summary.push(`A: ${dns.records.a.join(", ")}`);
  if (dns.records.aaaa.length > 0) summary.push(`AAAA: ${dns.records.aaaa.join(", ")}`);
  if (dns.records.mx.length > 0) {
    summary.push(`MX: ${dns.records.mx.map((row) => `${row.exchange} (${row.priority})`).join(", ")}`);
  }
  if (dns.mail.spf) summary.push(`SPF: ${dns.mail.spf}`);
  if (dns.mail.dmarc) summary.push(`DMARC: ${dns.mail.dmarc}`);
  return { hostname: dns.hostname, summary };
}

function buildAnalysisBlock(
  analysis: ReportAnalysis,
  tier1: Tier1ReportData,
  findings: ReportFinding[],
  records: ReportRecord[]
): FlightcheckReportAnalysis {
  const pagesWithIssues = analysis.allItems.filter(
    (item) =>
      item.missingFields.length > 0 ||
      item.warningKeys.length > 0 ||
      item.tier1IssueKeys.length > 0 ||
      records.some((record) => record.url === item.url && (record.security?.secrets.length ?? 0) > 0)
  ).length;

  const reviewPages: ReportReviewPage[] = [];
  if (!analysis.redirectOnly) {
    for (const fix of analysis.pageFixes) {
      const reason = reviewReason(fix.item.url, fix.item.status);
      if (reason) {
        reviewPages.push({ url: fix.item.url, status: fix.item.status, reason });
      }
    }
  }

  return {
    pagesAnalyzed: analysis.totalPages,
    pagesWithIssues,
    findingCounts: countFindings(findings),
    stack: stackEntries(analysis.stackProfile),
    templates: [...analysis.templateGroups.keys()].sort(),
    dns: buildDnsSummary(tier1),
    redirect: tier1.redirect
      ? {
          url: tier1.redirect.url,
          status: tier1.redirect.status,
          location: tier1.redirect.location,
          issueCount: tier1.redirect.issues.length,
        }
      : undefined,
    reviewPages,
  };
}

export type BuildStructuredReportOptions = BuildMarkdownOptions & {
  generatedAt?: string;
  flightcheckVersion?: string;
  flags?: string[];
};

export async function buildStructuredReport(
  sourcePath: string,
  records: ReportRecord[],
  tier1: Tier1ReportData = {},
  options: BuildStructuredReportOptions = {}
): Promise<FlightcheckReport> {
  const analysis = await buildReportAnalysis(records, tier1, options);
  const findings = buildFindings(analysis, tier1);
  return {
    version: FLIGHTCHECK_REPORT_VERSION,
    flightcheckVersion: options.flightcheckVersion ?? getPackageVersion(),
    flags: options.flags ?? [],
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    source: sourcePath,
    redirectOnly: analysis.redirectOnly,
    analysis: buildAnalysisBlock(analysis, tier1, findings, records),
    findings,
  };
}

function scopeLabel(finding: ReportFinding): string {
  if (finding.scope === "site-wide") {
    return finding.count ? `All ${finding.count} scanned pages` : "Entire site";
  }
  if (finding.scope === "template") {
    const template = finding.template ? `template “${finding.template}”` : "a template";
    return finding.count ? `${finding.count} page(s) using ${template}` : template;
  }
  if (finding.scope === "origin") return "Site / hosting configuration";
  if (finding.urls && finding.urls.length === 1) return finding.urls[0]!;
  if (finding.count) return `${finding.count} page(s)`;
  return "Specific pages";
}

function formatFindingMarkdown(finding: ReportFinding): string[] {
  const lines = [`#### ${finding.title}`, "", finding.message, "", `- Where: ${scopeLabel(finding)}`];
  if (finding.category) lines.push(`- Category: ${finding.category}`);
  if (finding.fix) lines.push(`- Fix: ${finding.fix}`);
  if (finding.urls && finding.urls.length > 1) {
    lines.push("- Pages:");
    for (const url of finding.urls.slice(0, 20)) {
      lines.push(`  - ${url}`);
    }
    if (finding.urls.length > 20) {
      lines.push(`  - …and ${finding.urls.length - 20} more`);
    }
  }
  lines.push("");
  return lines;
}

/** Human-friendly Markdown rendered from the structured report (single source of truth). */
export function renderReportMarkdown(report: FlightcheckReport): string {
  const { analysis, findings, redirectOnly } = report;
  const counts = analysis.findingCounts;
  const totalFindings = findings.length;

  const lines: string[] = [
    "# Flightcheck report",
    "",
    `Generated: ${report.generatedAt}`,
    `Flightcheck: ${report.flightcheckVersion}`,
    `Flags: \`${formatCliFlags(report.flags)}\``,
    `Source: \`${report.source}\``,
    "",
    "## At a glance",
    "",
  ];

  if (redirectOnly) {
    lines.push(
      "This site redirects at the start URL. Flightcheck checked the redirect setup and skipped a full page crawl.",
      ""
    );
  } else {
    lines.push(
      "A plain-language summary of what the scan found. Work from Critical downward.",
      ""
    );
  }

  lines.push(`- Pages checked: ${analysis.pagesAnalyzed}`);
  lines.push(`- Pages with issues: ${analysis.pagesWithIssues}`);
  lines.push(
    `- Findings: ${totalFindings} total` +
      ` (${counts.critical} critical, ${counts.error} errors, ${counts.warning} warnings, ${counts.review} to review)`
  );
  lines.push("");

  if (analysis.stack.length > 0) {
    lines.push("### Stack", "");
    for (const entry of analysis.stack) {
      const categories = entry.categories.join(", ");
      const evidence = entry.evidence[0] ? ` — ${entry.evidence[0]}` : "";
      lines.push(`- **${entry.name}** (${categories}, ${entry.confidence})${evidence}`);
    }
    lines.push("");
  }

  if (analysis.dns) {
    lines.push("### DNS", "");
    lines.push(`- Hostname: \`${analysis.dns.hostname}\``);
    for (const row of analysis.dns.summary) lines.push(`- ${row}`);
    lines.push("");
  }

  if (analysis.redirect) {
    lines.push("### Redirect", "");
    lines.push(`- URL: \`${analysis.redirect.url}\``);
    lines.push(`- Status: \`${analysis.redirect.status ?? "unreachable"}\``);
    if (analysis.redirect.location) lines.push(`- Location: \`${analysis.redirect.location}\``);
    lines.push("");
  }

  if (analysis.reviewPages.length > 0) {
    lines.push("### Pages to double-check", "");
    lines.push("These URLs did not return a normal page, so they were not turned into fix todos.", "");
    for (const page of analysis.reviewPages) {
      lines.push(`- \`${page.url}\` (${page.status ?? "error"}): ${page.reason}`);
    }
    lines.push("");
  }

  lines.push("## Findings", "");

  if (findings.length === 0) {
    lines.push("No issues found. Nice work.", "");
  } else {
    for (const severity of SEVERITY_ORDER) {
      const group = findings.filter((finding) => finding.severity === severity);
      if (group.length === 0) continue;
      lines.push(`### ${SEVERITY_HEADINGS[severity]}`, "");
      for (const finding of group) {
        lines.push(...formatFindingMarkdown(finding));
      }
    }
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

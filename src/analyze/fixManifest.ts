import type { CheckIssue } from "../checks/issues.js";
import type { StackProfile } from "./stack.js";
import type { ReportAnalysis } from "./report.js";
import type { Tier1ReportData } from "./reportTier1.js";
import type { ReportRecord } from "./report.js";
import { buildReportAnalysis } from "./report.js";
import { defaultManifestPathForInput, defaultReportPathForInput } from "../crawler/outputPaths.js";

export const FIX_MANIFEST_VERSION = 1 as const;

export type LocationDiscovery =
  | "search-codebase"
  | "hosting-panel"
  | "dns-panel"
  | "cms-studio"
  | "manual";

export type FixSurface = "repo" | "hosting" | "cms" | "dns" | "manual";

export type ManifestStackEntry = {
  name: string;
  categories: string[];
  confidence: string;
  scope: string;
  evidence: string[];
};

export type ManifestIssue = {
  id: string;
  severity: string;
  scope: string;
  count?: number;
  todo: string;
  urls?: string[];
};

/**
 * A crawled URL that is not a real fixable page (404/401/error — often emails, phone
 * numbers, or dynamic-route placeholders crawled as paths). Surfaced for human review
 * instead of generating "add metadata" todos against pages that do not exist.
 */
export type ReviewItem = {
  url: string;
  status: number | null;
  reason: string;
};

export type WorkPackage = {
  id: string;
  promptId: string;
  fixSurface: FixSurface;
  priority: number;
  scope: string;
  template?: string;
  issues: ManifestIssue[];
  locationDiscovery: LocationDiscovery;
  searchHints: string[];
  mcpServers: string[];
  prTitle: string;
  autoFixable: boolean;
};

export type FixManifest = {
  version: typeof FIX_MANIFEST_VERSION;
  generatedAt: string;
  source: string;
  reportPath: string;
  redirectOnly: boolean;
  stack: ManifestStackEntry[];
  workPackages: WorkPackage[];
  /** Non-200 crawled URLs that should be investigated, not auto-fixed. */
  reviewItems: ReviewItem[];
};

const A11Y_TIER1_IDS = new Set([
  "missing-alt",
  "empty-alt",
  "generic-alt",
  "heading-skip",
  "multiple-h1",
  "unlabeled-input",
  "missing-lang",
  "positive-tabindex",
]);

const BEST_PRACTICE_WARNING_KEYS = new Set([
  "noindex",
  "nofollow",
  "missing-template",
  "main-missing",
  "main-multiple",
]);

const STACK_SEARCH_HINTS: Record<string, string[]> = {
  "Next.js": [
    "Detect the router: App Router (app/layout.tsx, generateMetadata, metadata export) vs Pages Router (pages/_app.tsx, pages/_document.tsx, next/head <Head>)",
    "App Router: app/layout.tsx, app/**/layout.tsx, generateMetadata, metadata export",
    "Pages Router: pages/_app.tsx, pages/_document.tsx, next/head, shared <Head>/Page wrapper component",
    "lib/seo or central metadata helper",
  ],
  Nuxt: ["app.vue", "nuxt.config", "useHead", "useSeoMeta"],
  Gatsby: ["gatsby-config", "gatsby-ssr", "react-helmet", "Seo component"],
  Astro: ["src/layouts", "src/components/Head", "astro.config"],
  Sanity: ["sanity", "cdn.sanity.io", "@sanity/image-url", "image alt", "schema"],
  Contentful: ["contentful", "ctfassets.net"],
  WordPress: ["wp-content/themes", "functions.php", "header.php"],
  Netlify: ["netlify.toml", "public/_headers", "[[headers]]"],
  Vercel: ["vercel.json", "next.config", "headers() in next.config"],
};

const STACK_MCP_SERVERS: Record<string, string> = {
  Netlify: "netlify",
  Vercel: "vercel",
  Sanity: "sanity",
  Contentful: "contentful",
};

const CMS_STACK_NAMES = new Set(["Sanity", "Contentful", "WordPress", "Strapi", "Prismic"]);

/**
 * SEO fields whose value is unambiguously editorial content (authored per page), not markup.
 * When a CMS is detected these belong in a CMS-content package (authored with approval),
 * not a repo code change. Deliberately conservative: title/metaTitle/og.title and h1 are usually
 * *rendered by code* from a content field, so a missing one is often a template bug — those stay
 * in the repo package where the agent can inspect the template and decide. Markup fields
 * (canonical, og.url, colorScheme, twitter.card) also stay in the repo package.
 */
const CONTENT_SEO_FIELDS = new Set(["metaDescription", "og.description"]);

const IMAGE_ALT_IDS = new Set(["missing-alt", "empty-alt", "generic-alt"]);

function detectedCmsServer(profile: StackProfile): string | null {
  for (const detection of profile.detections) {
    if (detection.confidence === "low") continue;
    if (CMS_STACK_NAMES.has(detection.name)) {
      return STACK_MCP_SERVERS[detection.name] ?? detection.name.toLowerCase();
    }
  }
  return null;
}

/** Heuristic: a non-200 URL that looks like crawler junk rather than a real page. */
function reviewReason(url: string, status: number | null): string | null {
  if (status === 200) return null;
  const decoded = (() => {
    try {
      return decodeURIComponent(url);
    } catch {
      return url;
    }
  })();
  if (/@/.test(decoded)) return "URL contains an email address — likely a mis-parsed link, not a page";
  if (/\[[^\]]+\]/.test(decoded)) return "URL contains a dynamic-route placeholder (e.g. [slug]) — not a real page";
  if (/(?:\d[\s-]*){6,}/.test(decoded)) return "URL looks like a phone number crawled as a path";
  if (status === null) return "Page could not be fetched (error)";
  if (status === 404) return "Page returned 404 — broken or non-existent route";
  if (status === 401 || status === 403) return "Page returned auth error — likely a protected endpoint, not a public page";
  return `Page returned status ${status} — investigate before adding metadata`;
}

const REPO_SEARCH_BASE = [
  "Search the codebase for the root layout, shared head, or site-wide metadata configuration",
  "Search for generateMetadata, default metadata exports, shared SEO helpers, or <Head> usage",
  "Match the project's existing metadata pattern — do not assume file paths from stack hints alone",
];

const TEMPLATE_SEARCH_BASE = [
  "Search the codebase for the template route or layout tied to <meta name=\"template\"> value",
  "Look for page components, route segments, or CMS template mappings for this template name",
];

const PAGE_SEARCH_BASE = [
  "Search for the route file or page component matching each URL path",
  "Prefer the project's existing page-level metadata and content patterns",
];

function formatScope(count: number, total: number): string {
  if (total === 0) return "n/a";
  if (count === total) return "site-wide";
  return `${count}/${total} page(s)`;
}

function stackManifestEntries(profile: StackProfile, totalPages: number): ManifestStackEntry[] {
  return profile.detections.map((detection) => ({
    name: detection.name,
    categories: detection.categories,
    confidence: detection.confidence,
    scope:
      detection.pageCount > 0
        ? detection.pageCount === totalPages
          ? "site-wide"
          : `${detection.pageCount}/${totalPages} page(s)`
        : "origin",
    evidence: detection.evidence,
  }));
}

function stackSearchHints(profile: StackProfile, minConfidence: "high" | "medium" = "medium"): string[] {
  const hints = new Set<string>();
  const rank = { low: 0, medium: 1, high: 2 };

  for (const detection of profile.detections) {
    if (rank[detection.confidence] < rank[minConfidence]) continue;
    for (const hint of STACK_SEARCH_HINTS[detection.name] ?? []) {
      hints.add(hint);
    }
  }

  return [...hints];
}

function mcpServersForStack(profile: StackProfile, names: string[]): string[] {
  const servers = new Set<string>();
  for (const detection of profile.detections) {
    if (detection.confidence === "low") continue;
    const server = STACK_MCP_SERVERS[detection.name];
    if (server) servers.add(server);
  }
  for (const name of names) {
    const server = STACK_MCP_SERVERS[name];
    if (server) servers.add(server);
  }
  return [...servers];
}

function issueFromCheck(issue: CheckIssue, scope: string): ManifestIssue {
  return {
    id: issue.id,
    severity: issue.severity,
    scope,
    todo: issue.message,
  };
}

function seoIssuesFromFields(fields: string[], scope: string, count: number, total: number): ManifestIssue[] {
  return fields.map((field) => ({
    id: field,
    severity: "error",
    scope,
    count,
    todo: `Missing ${field} on ${formatScope(count, total)}`,
  }));
}

function warningIssues(keys: string[], scope: string, count: number, total: number): ManifestIssue[] {
  const labels: Record<string, string> = {
    noindex: "Remove noindex from robots meta",
    nofollow: "Remove nofollow from robots meta",
    "missing-template": "Add template meta tag",
    "main-missing": "Add main landmark",
    "main-multiple": "Ensure exactly one main landmark",
  };
  return keys
    .filter((key) => BEST_PRACTICE_WARNING_KEYS.has(key))
    .map((key) => ({
      id: key,
      severity: key === "noindex" || key === "nofollow" ? "warning" : "review",
      scope,
      count,
      todo: labels[key] ?? key,
    }));
}

function a11yIssues(keys: string[], scope: string, count: number, total: number): ManifestIssue[] {
  return keys
    .filter((key) => A11Y_TIER1_IDS.has(key))
    .map((key) => ({
      id: key,
      severity: "warning",
      scope,
      count,
      todo: `Fix a11y issue: ${key}`,
    }));
}

function buildRepoPackage(options: {
  id: string;
  promptId: string;
  priority: number;
  scope: string;
  template?: string;
  issues: ManifestIssue[];
  searchHints: string[];
  prTitle: string;
  mcpServers?: string[];
}): WorkPackage {
  return {
    id: options.id,
    promptId: options.promptId,
    fixSurface: "repo",
    priority: options.priority,
    scope: options.scope,
    template: options.template,
    issues: options.issues,
    locationDiscovery: "search-codebase",
    searchHints: options.searchHints,
    mcpServers: options.mcpServers ?? [],
    prTitle: options.prTitle,
    autoFixable: true,
  };
}

type PageFixList = ReportAnalysis["pageFixes"];

/**
 * Page-specific SEO issues, deduped against site-wide/template coverage (uses remainingFields,
 * not raw missingFields — so canonical/og.url already fixed site-wide do not reappear here).
 * `fieldFilter` selects markup fields (repo) vs content fields (CMS).
 */
function collectPageSeoIssues(pageFixes: PageFixList, fieldFilter: (field: string) => boolean): ManifestIssue[] {
  const issues: ManifestIssue[] = [];
  for (const { item, remainingFields } of pageFixes) {
    for (const field of remainingFields.filter(fieldFilter)) {
      issues.push({
        id: field,
        severity: "error",
        scope: "page-specific",
        todo: `Missing ${field}`,
        urls: [item.url],
      });
    }
  }
  return issues;
}

/** Page-specific best-practice issues (template meta, robots, landmarks), deduped. */
function collectPageBestPracticeIssues(pageFixes: PageFixList): ManifestIssue[] {
  const issues: ManifestIssue[] = [];
  for (const { item, remainingWarningKeys } of pageFixes) {
    for (const key of remainingWarningKeys.filter((entry) => BEST_PRACTICE_WARNING_KEYS.has(entry))) {
      issues.push({
        id: key,
        severity: key === "noindex" || key === "nofollow" ? "warning" : "review",
        scope: "page-specific",
        todo: `Fix ${key} on page`,
        urls: [item.url],
      });
    }
  }
  return issues;
}

/**
 * Page-specific a11y issues with granular IDs (empty-alt, heading-skip, …), deduped.
 * `idFilter` selects image-alt issues (CMS content) vs structural a11y (repo).
 */
function collectPageA11yIssues(pageFixes: PageFixList, idFilter: (id: string) => boolean): ManifestIssue[] {
  const issues: ManifestIssue[] = [];
  for (const { item, remainingA11yIssues } of pageFixes) {
    for (const issue of remainingA11yIssues.filter((entry) => idFilter(entry.id))) {
      issues.push({
        id: issue.id,
        severity: "warning",
        scope: "page-specific",
        todo: issue.message,
        urls: [item.url],
      });
    }
  }
  return issues;
}

function buildWorkPackages(
  analysis: ReportAnalysis,
  tier1: Tier1ReportData,
  stackProfile: StackProfile
): WorkPackage[] {
  const packages: WorkPackage[] = [];
  const { totalPages, redirectOnly } = analysis;
  const stackHints = stackSearchHints(stackProfile);

  if (tier1.redirect && tier1.redirect.issues.length > 0) {
    packages.push({
      id: "infra-redirect",
      promptId: "infra-redirect",
      fixSurface: "hosting",
      priority: 1,
      scope: "origin",
      issues: tier1.redirect.issues.map((issue) => issueFromCheck(issue, "origin")),
      locationDiscovery: "search-codebase",
      searchHints: [
        "Search for redirect rules in hosting config (netlify.toml, vercel.json, _redirects)",
        "Search for middleware or server redirect handlers",
        ...stackHints.filter((hint) => /netlify|vercel|middleware|redirect/i.test(hint)),
      ],
      mcpServers: mcpServersForStack(stackProfile, []),
      prTitle: "fix(infra): correct domain redirect configuration",
      autoFixable: true,
    });
  }

  if (analysis.securityPages.length > 0) {
    const secretIssues: ManifestIssue[] = [];
    for (const page of analysis.securityPages) {
      for (const secret of page.secrets) {
        secretIssues.push({
          id: `secret-${secret.provider}-${secret.type}`,
          severity: secret.severity,
          scope: "page-specific",
          todo: `Rotate or remove exposed ${secret.provider} ${secret.type}`,
          urls: [page.url],
        });
      }
    }
    packages.push({
      id: "secrets",
      promptId: "secrets",
      fixSurface: "manual",
      priority: 2,
      scope: "site-wide",
      issues: secretIssues,
      locationDiscovery: "manual",
      searchHints: [
        "Search the codebase for hardcoded keys matching the reported provider and source file",
        "Check environment variables and deployment secrets — do not commit real values",
      ],
      mcpServers: [],
      prTitle: "fix(security): remove exposed secrets",
      autoFixable: false,
    });
  }

  const siteSeoFields = [...analysis.siteWideFields];
  if (siteSeoFields.length > 0) {
    packages.push(
      buildRepoPackage({
        id: "seo-site-wide",
        promptId: "seo-site-wide",
        priority: 10,
        scope: "site-wide",
        issues: seoIssuesFromFields(siteSeoFields, "site-wide", totalPages, totalPages),
        searchHints: [...REPO_SEARCH_BASE, ...stackHints],
        prTitle: "fix(seo): add site-wide metadata and social tags",
      })
    );
  }

  const siteWarnings = [...analysis.siteWideWarningKeys].filter((key) => BEST_PRACTICE_WARNING_KEYS.has(key));
  if (siteWarnings.length > 0) {
    packages.push(
      buildRepoPackage({
        id: "best-practices-site-wide",
        promptId: "best-practices-site-wide",
        priority: 11,
        scope: "site-wide",
        issues: warningIssues(siteWarnings, "site-wide", totalPages, totalPages),
        searchHints: [...REPO_SEARCH_BASE, "main landmark", "<main>", "robots meta", 'meta name="template"'],
        prTitle: "fix: resolve site-wide best-practice issues",
      })
    );
  }

  const siteA11y = [...analysis.siteWideTier1Keys].filter((key) => A11Y_TIER1_IDS.has(key));
  if (siteA11y.length > 0) {
    packages.push(
      buildRepoPackage({
        id: "a11y-site-wide",
        promptId: "a11y-static",
        priority: 12,
        scope: "site-wide",
        issues: a11yIssues(siteA11y, "site-wide", totalPages, totalPages),
        searchHints: [...REPO_SEARCH_BASE, "shared components", "image alt", "html lang"],
        mcpServers: mcpServersForStack(stackProfile, ["Sanity"]),
        prTitle: "fix(a11y): resolve site-wide accessibility issues",
      })
    );
  }

  for (const [template, fields] of analysis.templateFieldMap) {
    if (fields.size === 0) continue;
    const items = analysis.templateGroups.get(template) ?? [];
    packages.push(
      buildRepoPackage({
        id: `seo-template-${template}`,
        promptId: "seo-template",
        priority: 20,
        scope: `template: ${template}`,
        template,
        issues: seoIssuesFromFields([...fields], `template: ${template}`, items.length, totalPages),
        searchHints: [...TEMPLATE_SEARCH_BASE, `template meta value: ${template}`, ...stackHints],
        prTitle: `fix(seo): add metadata for ${template} template`,
      })
    );
  }

  for (const [template, keys] of analysis.templateWarningKeyMap) {
    const warningKeys = [...keys].filter((key) => BEST_PRACTICE_WARNING_KEYS.has(key));
    if (warningKeys.length === 0) continue;
    const items = analysis.templateGroups.get(template) ?? [];
    packages.push(
      buildRepoPackage({
        id: `best-practices-template-${template}`,
        promptId: "best-practices-template",
        priority: 21,
        scope: `template: ${template}`,
        template,
        issues: warningIssues(warningKeys, `template: ${template}`, items.length, totalPages),
        searchHints: [...TEMPLATE_SEARCH_BASE, `template meta value: ${template}`],
        prTitle: `fix: resolve best-practice issues for ${template} template`,
      })
    );
  }

  for (const [template, keys] of analysis.templateTier1KeyMap) {
    const a11yKeys = [...keys].filter((key) => A11Y_TIER1_IDS.has(key));
    if (a11yKeys.length === 0) continue;
    const items = analysis.templateGroups.get(template) ?? [];
    packages.push(
      buildRepoPackage({
        id: `a11y-template-${template}`,
        promptId: "a11y-static",
        priority: 22,
        scope: `template: ${template}`,
        template,
        issues: a11yIssues(a11yKeys, `template: ${template}`, items.length, totalPages),
        searchHints: [...TEMPLATE_SEARCH_BASE, `template meta value: ${template}`, "image alt"],
        mcpServers: mcpServersForStack(stackProfile, ["Sanity"]),
        prTitle: `fix(a11y): resolve accessibility issues for ${template} template`,
      })
    );
  }

  if (!redirectOnly) {
    // Only generate fix todos for pages that actually exist (HTTP 200). Non-200 URLs
    // (404 emails/phone numbers, dynamic-route placeholders, protected endpoints) are
    // crawler artifacts — they go to reviewItems instead of getting "add metadata" todos.
    const actionablePageFixes = analysis.pageFixes.filter((fix) => fix.item.status === 200);

    const cmsServer = detectedCmsServer(stackProfile);
    const isContentField = (field: string) => CONTENT_SEO_FIELDS.has(field);
    const isImageAlt = (id: string) => IMAGE_ALT_IDS.has(id);

    // Repo (markup) SEO fields — when no CMS, content fields fall through here too.
    const seoRepoFilter = cmsServer ? (field: string) => !isContentField(field) : () => true;
    const pageSeo = collectPageSeoIssues(actionablePageFixes, seoRepoFilter);
    if (pageSeo.length > 0) {
      packages.push(
        buildRepoPackage({
          id: "seo-pages",
          promptId: "seo-page",
          priority: 30,
          scope: "page-specific",
          issues: pageSeo,
          searchHints: [...PAGE_SEARCH_BASE, ...stackHints],
          prTitle: "fix(seo): resolve page-specific metadata issues",
        })
      );
    }

    const pageBest = collectPageBestPracticeIssues(actionablePageFixes);
    if (pageBest.length > 0) {
      packages.push(
        buildRepoPackage({
          id: "best-practices-pages",
          promptId: "best-practices-page",
          priority: 31,
          scope: "page-specific",
          issues: pageBest,
          searchHints: [...PAGE_SEARCH_BASE, "main landmark", "<main>", 'meta name="template"', "robots meta"],
          prTitle: "fix: resolve page-specific best-practice issues",
        })
      );
    }

    // Structural a11y (heading order, lang, labels) is always a repo fix. Image alt is
    // routed to the CMS-content package when a CMS owns the images.
    const a11yRepoFilter = cmsServer ? (id: string) => !isImageAlt(id) : () => true;
    const pageA11y = collectPageA11yIssues(actionablePageFixes, a11yRepoFilter);
    if (pageA11y.length > 0) {
      packages.push(
        buildRepoPackage({
          id: "a11y-pages",
          promptId: "a11y-static",
          priority: 32,
          scope: "page-specific",
          issues: pageA11y,
          searchHints: [...PAGE_SEARCH_BASE, "heading order", "html lang", "form labels"],
          prTitle: "fix(a11y): resolve page-specific accessibility issues",
        })
      );
    }

    // CMS-content package: editorial fields (descriptions, alt text) authored per page.
    // Gated by the base prompt's CMS approval flow — never written silently.
    if (cmsServer) {
      const contentIssues = [
        ...collectPageSeoIssues(actionablePageFixes, isContentField),
        ...collectPageA11yIssues(actionablePageFixes, isImageAlt),
      ];
      if (contentIssues.length > 0) {
        packages.push({
          id: "cms-content",
          promptId: "cms-content",
          fixSurface: "cms",
          priority: 33,
          scope: "page-specific",
          issues: contentIssues,
          locationDiscovery: "cms-studio",
          searchHints: [
            `Inspect the ${cmsServer} dataset/schema for the documents behind each URL`,
            "Identify the fields backing meta description, social description, and image alt text",
            "Propose values and get user approval before any CMS write (see base instructions)",
          ],
          mcpServers: mcpServersForStack(stackProfile, []),
          prTitle: "chore(cms): author missing descriptions and image alt text",
          autoFixable: true,
        });
      }
    }
  }

  if (tier1.securityHeaders && tier1.securityHeaders.issues.length > 0) {
    packages.push({
      id: "infra-headers",
      promptId: "infra-security-headers",
      fixSurface: "hosting",
      priority: 40,
      scope: "origin",
      issues: tier1.securityHeaders.issues.map((issue) => issueFromCheck(issue, "origin")),
      locationDiscovery: "search-codebase",
      searchHints: [
        "Search for netlify.toml, vercel.json, next.config headers, or middleware security headers",
        ...stackHints.filter((hint) => /netlify|vercel|next.config|headers/i.test(hint)),
      ],
      mcpServers: mcpServersForStack(stackProfile, []),
      prTitle: "fix(infra): add missing security headers",
      autoFixable: true,
    });
  }

  const robotsIssues = tier1.robotsTxt?.issues ?? [];
  const sitemapIssues = tier1.sitemap?.issues ?? [];
  if (robotsIssues.length > 0 || sitemapIssues.length > 0) {
    packages.push({
      id: "infra-robots-sitemap",
      promptId: "infra-robots-sitemap",
      fixSurface: "repo",
      priority: 41,
      scope: "origin",
      issues: [...robotsIssues, ...sitemapIssues].map((issue) => issueFromCheck(issue, "origin")),
      locationDiscovery: "search-codebase",
      searchHints: [
        "Search for public/robots.txt, robots route, or sitemap generation (next-sitemap, build script, cron)",
        "sitemap.xml",
        "robots.txt",
      ],
      mcpServers: [],
      prTitle: "fix(infra): fix robots.txt and sitemap issues",
      autoFixable: true,
    });
  }

  if (tier1.dns && tier1.dns.issues.length > 0) {
    packages.push({
      id: "infra-dns",
      promptId: "infra-dns",
      fixSurface: "dns",
      priority: 50,
      scope: "origin",
      issues: tier1.dns.issues.map((issue) => issueFromCheck(issue, "origin")),
      locationDiscovery: "dns-panel",
      searchHints: ["SPF", "DMARC", "TXT records", tier1.dns.hostname],
      mcpServers: [],
      prTitle: "fix(infra): update DNS mail security records",
      autoFixable: false,
    });
  }

  if (tier1.agentReady && tier1.agentReady.issues.length > 0) {
    packages.push({
      id: "agent-ready",
      promptId: "agent-ready",
      fixSurface: "repo",
      priority: 42,
      scope: "origin",
      issues: tier1.agentReady.issues.map((issue) => issueFromCheck(issue, "origin")),
      locationDiscovery: "search-codebase",
      searchHints: [
        "public/robots.txt",
        "llms.txt",
        "Content-Signal",
        "Accept: text/markdown",
        "middleware",
        "Link header",
        "/.well-known/mcp/server-card.json",
        "/.well-known/agent-skills/index.json",
      ],
      mcpServers: [],
      prTitle: "feat(agent): improve agent readiness discoverability",
      autoFixable: true,
    });
  }

  return packages.sort((a, b) => a.priority - b.priority);
}

export type BuildFixManifestOptions = {
  redirectOnly?: boolean;
  reportPath?: string;
  stackProfile?: StackProfile;
};

export async function buildFixManifest(
  sourcePath: string,
  records: ReportRecord[],
  tier1: Tier1ReportData = {},
  options: BuildFixManifestOptions = {}
): Promise<FixManifest> {
  const analysis = await buildReportAnalysis(records, tier1, {
    redirectOnly: options.redirectOnly ?? false,
    stackProfile: options.stackProfile,
  });
  const reportPath = options.reportPath ?? defaultReportPathForInput(sourcePath);

  const reviewItems: ReviewItem[] = [];
  if (!analysis.redirectOnly) {
    for (const fix of analysis.pageFixes) {
      const reason = reviewReason(fix.item.url, fix.item.status);
      if (reason) reviewItems.push({ url: fix.item.url, status: fix.item.status, reason });
    }
  }

  return {
    version: FIX_MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    source: sourcePath,
    reportPath,
    redirectOnly: analysis.redirectOnly,
    stack: stackManifestEntries(analysis.stackProfile, analysis.totalPages),
    workPackages: buildWorkPackages(analysis, tier1, analysis.stackProfile),
    reviewItems,
  };
}

export { defaultManifestPathForInput };
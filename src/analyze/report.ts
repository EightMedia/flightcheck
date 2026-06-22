import { z } from "zod";
import {
  buildDnsSection,
  buildRedirectSection,
  buildRobotsAndSitemapSection,
  buildSecurityHeadersSection,
  buildIssuesSummarySection,
  type BuildMarkdownOptions,
  type CrawlIssueCounts,
  type Tier1ReportData,
} from "./reportTier1.js";
import { aggregateStackFromRecords, buildStackSection, type StackProfile } from "./stack.js";

export type { Tier1ReportData, BuildMarkdownOptions } from "./reportTier1.js";

const iconSchema = z.object({
  rel: z.string(),
  href: z.string(),
  type: z.string(),
  sizes: z.string(),
  media: z.string(),
});

const trackingItemSchema = z.object({
  provider: z.string(),
  id: z.string(),
});

const secretFindingSchema = z.object({
  type: z.string(),
  provider: z.string(),
  severity: z.enum(["critical", "review"]),
  masked: z.string(),
  source: z.string(),
});

const crawlIssueSchema = z.object({
  id: z.string(),
  severity: z.enum(["critical", "error", "warning", "review"]),
  message: z.string(),
});

const stackDetectionSchema = z.object({
  name: z.string(),
  categories: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"]),
  evidence: z.array(z.string()),
  website: z.string().optional(),
  version: z.string().optional(),
});

const recordSchema = z.object({
  url: z.string(),
  status: z.number().nullable(),
  h1: z.string(),
  title: z.string(),
  metaTitle: z.string(),
  metaDescription: z.string(),
  robots: z.string(),
  template: z.string().optional().default(""),
  mainCount: z.number().nullable().optional().default(null),
  charset: z.string(),
  language: z.string(),
  colorScheme: z.string(),
  themeColor: z.string(),
  doctype: z.string(),
  viewport: z.string(),
  canonical: z.string(),
  favicon: z.string(),
  icons: z.array(iconSchema),
  og: z.object({
    title: z.string(),
    description: z.string(),
    image: z.string(),
    url: z.string(),
    type: z.string(),
    siteName: z.string(),
  }),
  twitter: z.object({
    card: z.string(),
    title: z.string(),
    description: z.string(),
    image: z.string(),
  }),
  tracking: z.object({
    tagManager: z.array(trackingItemSchema),
    analytics: z.array(trackingItemSchema),
  }),
  stack: z
    .object({
      detections: z.array(stackDetectionSchema),
    })
    .optional(),
  security: z
    .object({
      secrets: z.array(secretFindingSchema),
      scannedAssets: z.number(),
    })
    .optional(),
  images: z.object({ issues: z.array(crawlIssueSchema) }).optional(),
  a11yStatic: z.object({ issues: z.array(crawlIssueSchema) }).optional(),
  note: z.string().optional(),
  error: z.string().optional(),
});

export const reportSchema = z.array(recordSchema);

export type ReportRecord = z.infer<typeof recordSchema>;

export function parseReport(json: unknown): ReportRecord[] {
  return reportSchema.parse(json);
}

const fieldSelectors: Array<{ label: string; get: (record: ReportRecord) => string | string[] }> = [
  { label: "h1", get: (r) => r.h1 },
  { label: "title", get: (r) => r.title },
  { label: "metaTitle", get: (r) => r.metaTitle },
  { label: "metaDescription", get: (r) => r.metaDescription },
  { label: "charset", get: (r) => r.charset },
  { label: "language", get: (r) => r.language },
  { label: "colorScheme", get: (r) => r.colorScheme },
  { label: "themeColor", get: (r) => r.themeColor },
  { label: "doctype", get: (r) => r.doctype },
  { label: "viewport", get: (r) => r.viewport },
  { label: "canonical", get: (r) => r.canonical },
  { label: "favicon", get: (r) => r.favicon },
  { label: "og.title", get: (r) => r.og.title },
  { label: "og.description", get: (r) => r.og.description },
  { label: "og.image", get: (r) => r.og.image },
  { label: "og.url", get: (r) => r.og.url },
  { label: "og.type", get: (r) => r.og.type },
  { label: "og.siteName", get: (r) => r.og.siteName },
  { label: "twitter.card", get: (r) => r.twitter.card },
  { label: "twitter.title", get: (r) => r.twitter.title },
  { label: "twitter.description", get: (r) => r.twitter.description },
  { label: "twitter.image", get: (r) => r.twitter.image },
  { label: "icons", get: (r) => (r.icons.length > 0 ? ["present"] : []) },
];

function isMissingValue(value: string | string[]): boolean {
  if (Array.isArray(value)) return value.length === 0;
  return value.trim() === "";
}

function parseRobotsDirectives(robots: string): Set<string> {
  return new Set(
    robots
      .toLowerCase()
      .split(/[\s,]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0)
  );
}

function collectWarnings(record: ReportRecord): string[] {
  const warnings: string[] = [];

  if (record.template.trim() === "") {
    warnings.push(
      "Missing template meta tag — adding `<meta name=\"template\">` helps flightcheck give better tailored reports."
    );
  }

  const robots = record.robots.trim();
  if (robots === "") return warnings;

  const directives = parseRobotsDirectives(robots);

  if (directives.has("noindex") || directives.has("none")) {
    warnings.push(`Page is set to noindex (robots: "${robots}") — search engines are told not to index it.`);
  }
  if (directives.has("nofollow") || directives.has("none")) {
    warnings.push(`Page is set to nofollow (robots: "${robots}") — search engines are told not to follow its links.`);
  }

  return warnings;
}

function collectMainLandmarkIssues(mainCount: number | null | undefined): { todos: string[]; issueKeys: string[] } {
  if (mainCount == null || mainCount === 1) {
    return { todos: [], issueKeys: [] };
  }

  const todo = buildMainLandmarkTodo(mainCount, "page");
  if (mainCount === 0) {
    return {
      todos: todo ? [todo] : [],
      issueKeys: ["main-missing"],
    };
  }

  return {
    todos: todo ? [todo] : [],
    issueKeys: ["main-multiple"],
  };
}

const WARNING_LABELS: Record<string, string> = {
  noindex: "noindex",
  nofollow: "nofollow",
  "missing-template": "missing template meta",
  "main-missing": "missing main landmark",
  "main-multiple": "multiple main landmarks",
};

const IMAGE_TIER1_IDS = new Set(["missing-alt", "empty-alt", "generic-alt"]);

const TIER1_LABELS: Record<string, string> = {
  "missing-alt": "missing image alt",
  "empty-alt": "empty image alt",
  "generic-alt": "generic image alt",
  "heading-skip": "heading hierarchy skip",
  "multiple-h1": "multiple h1",
  "unlabeled-input": "unlabeled form input",
  "missing-lang": "missing html lang (a11y)",
  "positive-tabindex": "positive tabindex",
};

const TIER1_SCOPE_TODOS: Record<string, { page: string; template: string; site: string }> = {
  "missing-alt": {
    page: "Add alt text to images on page",
    template: "Add alt text to images in template",
    site: "Add alt text to images in shared components",
  },
  "empty-alt": {
    page: "Review empty alt attributes on page images",
    template: "Review empty alt attributes on template images",
    site: "Review empty alt attributes on shared images",
  },
  "generic-alt": {
    page: "Replace generic image alt text on page",
    template: "Replace generic image alt text in template",
    site: "Replace generic image alt text in shared components",
  },
  "heading-skip": {
    page: "Fix heading hierarchy skip on page",
    template: "Fix heading hierarchy skip in template",
    site: "Fix heading hierarchy skip in shared layout",
  },
  "multiple-h1": {
    page: "Use a single h1 on page",
    template: "Use a single h1 in template",
    site: "Use a single h1 in shared layout",
  },
  "unlabeled-input": {
    page: "Add labels to form inputs on page",
    template: "Add labels to form inputs in template",
    site: "Add labels to form inputs in shared components",
  },
  "missing-lang": {
    page: "Add lang attribute to html element on page",
    template: "Add lang attribute to html element in template",
    site: "Add lang attribute to html element in site layout",
  },
  "positive-tabindex": {
    page: "Remove positive tabindex values on page",
    template: "Remove positive tabindex values in template",
    site: "Remove positive tabindex values in shared layout",
  },
};

const PAGE_TODO_MESSAGES: Record<string, string> = {
  h1: "Add h1 to page",
  title: "Add title element to page head",
  metaTitle: "Add meta title to page head",
  metaDescription: "Add meta description tag to page head",
  charset: "Add charset meta tag to page head",
  language: "Add lang attribute to html element",
  colorScheme: "Add color-scheme meta tag to page head",
  themeColor: "Add theme-color meta tag to page head",
  doctype: "Add doctype to page",
  viewport: "Add viewport meta tag to page head",
  canonical: "Add canonical link to page head",
  favicon: "Add favicon link to page head",
  icons: "Add icon links to page head",
};

const OG_FIELD_LABELS: Record<string, string> = {
  "og.title": "og:title",
  "og.description": "og:description",
  "og.image": "og:image",
  "og.url": "og:url",
  "og.type": "og:type",
  "og.siteName": "og:site_name",
};

const TWITTER_FIELD_LABELS: Record<string, string> = {
  "twitter.card": "twitter:card",
  "twitter.title": "twitter:title",
  "twitter.description": "twitter:description",
  "twitter.image": "twitter:image",
};

type FixScope = "page" | "template" | "site";

function scopedHead(scope: FixScope): string {
  if (scope === "site") return "site layout head";
  if (scope === "template") return "template head";
  return "page head";
}

function pageTodoForField(field: string, scope: FixScope = "page"): string {
  const message = PAGE_TODO_MESSAGES[field] ?? `Add ${field} to page`;
  if (scope === "page") return message;
  if (scope === "site") {
    return message
      .replace(/ to page head/g, " to site layout head")
      .replace(/ to page/g, " in site layout")
      .replace(/ to html element/g, " on html element in site layout");
  }
  return message
    .replace(/ to page head/g, " to template head")
    .replace(/ to page/g, " to template")
    .replace(/ to html element/g, " in template");
}

function buildBundledFieldTodos(missingFields: string[], scope: FixScope): string[] {
  const ogFields: string[] = [];
  const twitterFields: string[] = [];
  const otherFields: string[] = [];

  for (const field of missingFields) {
    if (field.startsWith("og.")) {
      ogFields.push(field);
    } else if (field.startsWith("twitter.")) {
      twitterFields.push(field);
    } else {
      otherFields.push(field);
    }
  }

  const head = scopedHead(scope);
  const todos: string[] = [];
  for (const field of otherFields) {
    if (field === "fetch") {
      if (scope === "page") todos.push("- [ ] Resolve page fetch error");
      else if (scope === "template") todos.push("- [ ] Fix fetch handling in template");
      else todos.push("- [ ] Fix fetch handling in site routing or server config");
    } else {
      todos.push(`- [ ] ${pageTodoForField(field, scope)}`);
    }
  }
  if (ogFields.length > 0) {
    const labels = ogFields.map((field) => OG_FIELD_LABELS[field] ?? field).join(", ");
    todos.push(`- [ ] Add Open Graph meta tags to ${head}: ${labels}`);
  }
  if (twitterFields.length > 0) {
    const labels = twitterFields.map((field) => TWITTER_FIELD_LABELS[field] ?? field).join(", ");
    todos.push(`- [ ] Add Twitter meta tags to ${head}: ${labels}`);
  }
  return todos;
}

function buildMainLandmarkTodo(mainCount: number | null | undefined, scope: FixScope): string | null {
  if (mainCount == null || mainCount === 1) return null;
  if (mainCount === 0) {
    if (scope === "site") return "- [ ] Add main landmark to site layout";
    if (scope === "template") return "- [ ] Add main landmark to template";
    return "- [ ] Add main landmark to page";
  }
  if (scope === "page") return `- [ ] Ensure page has exactly one main landmark (found ${mainCount})`;
  if (scope === "site") return "- [ ] Ensure site layout renders exactly one main landmark";
  return "- [ ] Ensure template renders exactly one main landmark";
}

type UrlTodoItem = {
  url: string;
  status: number | null;
  template: string;
  missingFields: string[];
  warnings: string[];
  warningKeys: string[];
  tier1IssueKeys: string[];
  imageIssues: { id: string; severity: string; message: string }[];
  a11yStaticIssues: { id: string; severity: string; message: string }[];
  mainLandmarkTodos: string[];
  mainCount?: number | null;
  note?: string;
  error?: string;
};

function fieldsMissingOnAllPages(items: UrlTodoItem[]): string[] {
  if (items.length === 0) return [];
  const total = items.length;
  const fieldCounts = new Map<string, number>();
  for (const item of items) {
    for (const field of item.missingFields) {
      fieldCounts.set(field, (fieldCounts.get(field) ?? 0) + 1);
    }
  }
  return [...fieldCounts.entries()].filter(([, count]) => count === total).map(([field]) => field);
}

function warningKeysOnAllPages(items: UrlTodoItem[]): string[] {
  if (items.length === 0) return [];
  const total = items.length;
  const keyCounts = new Map<string, number>();
  for (const item of items) {
    for (const key of item.warningKeys) {
      keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
    }
  }
  return [...keyCounts.entries()].filter(([, count]) => count === total).map(([key]) => key);
}

function tier1KeysOnAllPages(items: UrlTodoItem[]): string[] {
  if (items.length === 0) return [];
  const total = items.length;
  const keyCounts = new Map<string, number>();
  for (const item of items) {
    for (const key of item.tier1IssueKeys) {
      keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
    }
  }
  return [...keyCounts.entries()].filter(([, count]) => count === total).map(([key]) => key);
}

function countTier1IssueOccurrences(items: UrlTodoItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const key of item.tier1IssueKeys) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

const SITE_WARNING_TODOS: Record<string, string> = {
  noindex: "Remove noindex from shared robots meta tag in site layout",
  nofollow: "Remove nofollow from shared robots meta tag in site layout",
  "missing-template":
    "Add template meta tag to site layout head — helps flightcheck give better tailored reports",
};

const TEMPLATE_WARNING_TODOS: Record<string, string> = {
  noindex: "Remove noindex from template robots meta tag",
  nofollow: "Remove nofollow from template robots meta tag",
};

const PAGE_WARNING_TODOS: Record<string, string> = {
  noindex: "Remove noindex from page robots meta tag",
  nofollow: "Remove nofollow from page robots meta tag",
  "missing-template": "Add template meta tag to page head — helps flightcheck give better tailored reports",
};

function buildWarningTodos(keys: string[], scope: FixScope): string[] {
  const messages = scope === "site" ? SITE_WARNING_TODOS : scope === "template" ? TEMPLATE_WARNING_TODOS : PAGE_WARNING_TODOS;
  const todos: string[] = [];
  for (const key of keys) {
    if (key === "main-missing" || key === "main-multiple") continue;
    const message = messages[key];
    if (message) todos.push(`- [ ] ${message}`);
  }
  if (keys.includes("main-missing")) {
    const todo = buildMainLandmarkTodo(0, scope);
    if (todo) todos.push(todo);
  } else if (keys.includes("main-multiple")) {
    const todo = buildMainLandmarkTodo(2, scope);
    if (todo) todos.push(todo);
  }
  return todos;
}

function buildTier1Todos(keys: string[], scope: FixScope): string[] {
  const scopeKey = scope === "site" ? "site" : scope === "template" ? "template" : "page";
  return keys
    .map((key) => TIER1_SCOPE_TODOS[key]?.[scopeKey])
    .filter((message): message is string => Boolean(message))
    .map((message) => `- [ ] ${message}`);
}

function buildImageIssueTodos(issues: UrlTodoItem["imageIssues"]): string[] {
  return issues.map((issue) => `- [ ] ${issue.message}`);
}

function buildScopedFixTodos(
  items: UrlTodoItem[],
  scope: FixScope,
  excludedFields: Set<string> = new Set(),
  excludedWarningKeys: Set<string> = new Set(),
  excludedTier1Keys: Set<string> = new Set()
): string[] {
  const universalFields = fieldsMissingOnAllPages(items).filter((field) => !excludedFields.has(field));
  const universalWarningKeys = warningKeysOnAllPages(items).filter((key) => !excludedWarningKeys.has(key));
  const universalTier1Keys = tier1KeysOnAllPages(items).filter((key) => !excludedTier1Keys.has(key));
  return [
    ...buildBundledFieldTodos(universalFields, scope),
    ...buildWarningTodos(universalWarningKeys, scope),
    ...buildTier1Todos(universalTier1Keys, scope),
  ];
}

function buildRemainingPageTodos(
  item: UrlTodoItem,
  coveredFields: Set<string>,
  coveredWarningKeys: Set<string>,
  coveredTier1Keys: Set<string>
): string[] {
  const remainingFields = item.missingFields.filter((field) => !coveredFields.has(field));
  const remainingWarningKeys = item.warningKeys.filter((key) => !coveredWarningKeys.has(key));
  const remainingTier1Keys = item.tier1IssueKeys.filter((key) => !coveredTier1Keys.has(key));
  const remainingNonImageTier1Keys = remainingTier1Keys.filter((key) => !IMAGE_TIER1_IDS.has(key));
  const todos = [...buildBundledFieldTodos(remainingFields, "page")];

  for (const key of remainingWarningKeys) {
    if (key === "main-missing" || key === "main-multiple") continue;
    const message = PAGE_WARNING_TODOS[key];
    if (message) todos.push(`- [ ] ${message}`);
  }
  if (remainingWarningKeys.includes("main-missing")) {
    todos.push("- [ ] Add main landmark to page");
  } else if (remainingWarningKeys.includes("main-multiple")) {
    const todo = buildMainLandmarkTodo(item.mainCount, "page");
    if (todo) todos.push(todo);
  }

  todos.push(...buildTier1Todos(remainingNonImageTier1Keys, "page"));
  const uncoveredImageIssues = item.imageIssues.filter((issue) => !coveredTier1Keys.has(issue.id));
  todos.push(...buildImageIssueTodos(uncoveredImageIssues));

  return todos;
}

function collectTier1IssueKeys(record: ReportRecord): string[] {
  const issues = [...(record.images?.issues ?? []), ...(record.a11yStatic?.issues ?? [])];
  return [...new Set(issues.map((entry) => entry.id))];
}

function analyzeRecord(record: ReportRecord): UrlTodoItem {
  const missingFields = fieldSelectors
    .filter((selector) => isMissingValue(selector.get(record)))
    .map((selector) => selector.label);

  if (record.error) {
    missingFields.unshift("fetch");
  }

  const warnings = collectWarnings(record);
  const { todos: mainLandmarkTodos, issueKeys: mainIssueKeys } = collectMainLandmarkIssues(record.mainCount);

  const warningKeys: string[] = [...mainIssueKeys];
  if (record.template.trim() === "") {
    warningKeys.push("missing-template");
  }
  if (warnings.length > 0) {
    const directives = parseRobotsDirectives(record.robots);
    if (directives.has("noindex") || directives.has("none")) warningKeys.push("noindex");
    if (directives.has("nofollow") || directives.has("none")) warningKeys.push("nofollow");
  }

  return {
    url: record.url,
    status: record.status,
    template: record.template.trim(),
    missingFields,
    warnings,
    warningKeys,
    tier1IssueKeys: collectTier1IssueKeys(record),
    imageIssues: record.images?.issues ?? [],
    a11yStaticIssues: record.a11yStatic?.issues ?? [],
    mainLandmarkTodos,
    mainCount: record.mainCount,
    note: record.note,
    error: record.error,
  };
}

function countFieldOccurrences(items: UrlTodoItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const field of item.missingFields) {
      counts.set(field, (counts.get(field) ?? 0) + 1);
    }
  }
  return counts;
}

function countWarningOccurrences(items: UrlTodoItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const key of item.warningKeys) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

function resolveIssueScope(
  issueKey: string,
  count: number,
  totalPages: number,
  siteWideKeys: Set<string>,
  templateKeyMap: Map<string, Set<string>>
): string {
  if (siteWideKeys.has(issueKey) || count === totalPages) return "site-wide";
  for (const [template, keys] of templateKeyMap) {
    if (keys.has(issueKey)) return `template: ${template}`;
  }
  return "page-specific";
}

function buildCoverageSection(
  allItems: UrlTodoItem[],
  totalPages: number,
  siteWideFields: Set<string>,
  siteWideWarningKeys: Set<string>,
  siteWideTier1Keys: Set<string>,
  templateFieldMap: Map<string, Set<string>>,
  templateWarningKeyMap: Map<string, Set<string>>,
  templateTier1KeyMap: Map<string, Set<string>>
): string[] {
  const fieldCounts = countFieldOccurrences(allItems);
  const warningCounts = countWarningOccurrences(allItems);
  const tier1Counts = countTier1IssueOccurrences(allItems);
  const lines: string[] = ["## Issue coverage", "", "How widely each issue appears across scanned pages:", ""];

  if (fieldCounts.size === 0 && warningCounts.size === 0 && tier1Counts.size === 0) {
    lines.push("- No issues found.");
    return lines;
  }

  const sortedFields = [...fieldCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [field, count] of sortedFields) {
    const scope = resolveIssueScope(field, count, totalPages, siteWideFields, templateFieldMap);
    lines.push(`- \`${field}\`: ${count}/${totalPages} pages (${scope})`);
  }

  const sortedWarnings = [...warningCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [key, count] of sortedWarnings) {
    const label = WARNING_LABELS[key] ?? key;
    const scope = resolveIssueScope(key, count, totalPages, siteWideWarningKeys, templateWarningKeyMap);
    lines.push(`- \`${label}\`: ${count}/${totalPages} pages (${scope})`);
  }

  const sortedTier1 = [...tier1Counts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [key, count] of sortedTier1) {
    const label = TIER1_LABELS[key] ?? key;
    const scope = resolveIssueScope(key, count, totalPages, siteWideTier1Keys, templateTier1KeyMap);
    lines.push(`- \`${label}\`: ${count}/${totalPages} pages (${scope})`);
  }

  return lines;
}

function buildHowToUseSection(redirectOnly: boolean): string[] {
  const lines = ["## How to use this report", ""];
  if (redirectOnly) {
    lines.push("1. Fix redirect issues listed below (status code, Location target, HTTPS/HSTS).");
    lines.push("2. Re-run flightcheck to confirm the redirect is healthy.");
    lines.push("3. Run against the final destination URL if you need a full site crawl.");
  } else {
    lines.push("1. Fix **site-wide** items once in shared layout/head.");
    lines.push("2. Fix **template** items in each template file.");
    lines.push("3. Fix **per-page** items in page content or route-specific files.");
    lines.push("4. Re-run flightcheck and confirm issue counts drop to zero.");
  }
  lines.push("");
  return lines;
}

const BEST_PRACTICE_WARNING_KEYS = new Set(["noindex", "nofollow", "missing-template", "main-missing", "main-multiple"]);

function countCrawlIssueCategories(allItems: UrlTodoItem[], records: ReportRecord[]): CrawlIssueCounts {
  let seoIssueCount = 0;
  let seoPageCount = 0;
  let a11yIssueCount = 0;
  let a11yPageCount = 0;
  let bestPracticesIssueCount = 0;
  let bestPracticesPageCount = 0;
  let securityIssueCount = 0;
  let securityPageCount = 0;

  for (const item of allItems) {
    if (item.missingFields.length > 0) {
      seoIssueCount += item.missingFields.length;
      seoPageCount += 1;
    }

    const a11yOnPage = item.imageIssues.length + item.a11yStaticIssues.length;
    if (a11yOnPage > 0) {
      a11yIssueCount += a11yOnPage;
      a11yPageCount += 1;
    }

    const bestPracticeKeys = item.warningKeys.filter((key) => BEST_PRACTICE_WARNING_KEYS.has(key));
    if (bestPracticeKeys.length > 0) {
      bestPracticesIssueCount += bestPracticeKeys.length;
      bestPracticesPageCount += 1;
    }
  }

  for (const record of records) {
    const secrets = record.security?.secrets.length ?? 0;
    if (secrets > 0) {
      securityIssueCount += secrets;
      securityPageCount += 1;
    }
  }

  return {
    seo: { issueCount: seoIssueCount, pageCount: seoPageCount },
    a11y: { issueCount: a11yIssueCount, pageCount: a11yPageCount },
    bestPractices: { issueCount: bestPracticesIssueCount, pageCount: bestPracticesPageCount },
    security: { issueCount: securityIssueCount, pageCount: securityPageCount },
  };
}

export type PageFix = {
  item: UrlTodoItem;
  remainingTodos: string[];
};

export type ReportAnalysis = {
  allItems: UrlTodoItem[];
  totalPages: number;
  redirectOnly: boolean;
  siteWideFields: Set<string>;
  siteWideWarningKeys: Set<string>;
  siteWideTier1Keys: Set<string>;
  siteWideFixTodos: string[];
  templateGroups: Map<string, UrlTodoItem[]>;
  templateFieldMap: Map<string, Set<string>>;
  templateWarningKeyMap: Map<string, Set<string>>;
  templateTier1KeyMap: Map<string, Set<string>>;
  coveredFieldsByTemplate: Map<string, Set<string>>;
  coveredWarningKeysByTemplate: Map<string, Set<string>>;
  coveredTier1KeysByTemplate: Map<string, Set<string>>;
  pageFixes: PageFix[];
  securityPages: Array<{
    url: string;
    secrets: Array<{ type: string; provider: string; severity: string; masked: string; source: string }>;
  }>;
  stackProfile: StackProfile;
  crawlIssueCounts: CrawlIssueCounts;
};

export async function buildReportAnalysis(
  records: ReportRecord[],
  tier1: Tier1ReportData = {},
  options: BuildMarkdownOptions = {}
): Promise<ReportAnalysis> {
  const redirectOnly = options.redirectOnly ?? false;
  const allItems = records.map(analyzeRecord);
  const totalPages = allItems.length;
  const crawlIssueCounts = countCrawlIssueCategories(allItems, records);

  const siteWideFields = new Set(fieldsMissingOnAllPages(allItems));
  const siteWideWarningKeys = new Set(warningKeysOnAllPages(allItems));
  const siteWideTier1Keys = new Set(tier1KeysOnAllPages(allItems));
  const siteWideFixTodos = buildScopedFixTodos(allItems, "site");

  const templateGroups = new Map<string, UrlTodoItem[]>();
  for (const item of allItems) {
    if (item.template === "") continue;
    const group = templateGroups.get(item.template);
    if (group) group.push(item);
    else templateGroups.set(item.template, [item]);
  }

  const templateFieldMap = new Map<string, Set<string>>();
  const templateWarningKeyMap = new Map<string, Set<string>>();
  const templateTier1KeyMap = new Map<string, Set<string>>();

  for (const [template, items] of templateGroups) {
    templateFieldMap.set(
      template,
      new Set(fieldsMissingOnAllPages(items).filter((field) => !siteWideFields.has(field)))
    );
    templateWarningKeyMap.set(
      template,
      new Set(warningKeysOnAllPages(items).filter((key) => !siteWideWarningKeys.has(key)))
    );
    templateTier1KeyMap.set(
      template,
      new Set(tier1KeysOnAllPages(items).filter((key) => !siteWideTier1Keys.has(key)))
    );
  }

  const coveredFieldsByTemplate = new Map<string, Set<string>>();
  const coveredWarningKeysByTemplate = new Map<string, Set<string>>();
  const coveredTier1KeysByTemplate = new Map<string, Set<string>>();
  for (const [template, fields] of templateFieldMap) {
    coveredFieldsByTemplate.set(template, new Set([...siteWideFields, ...fields]));
  }
  for (const [template, keys] of templateWarningKeyMap) {
    coveredWarningKeysByTemplate.set(template, new Set([...siteWideWarningKeys, ...keys]));
  }
  for (const [template, keys] of templateTier1KeyMap) {
    coveredTier1KeysByTemplate.set(template, new Set([...siteWideTier1Keys, ...keys]));
  }

  const pageFixes: PageFix[] = [];
  for (const item of allItems) {
    const coveredFields = coveredFieldsByTemplate.get(item.template) ?? siteWideFields;
    const coveredWarningKeys = coveredWarningKeysByTemplate.get(item.template) ?? siteWideWarningKeys;
    const coveredTier1Keys = coveredTier1KeysByTemplate.get(item.template) ?? siteWideTier1Keys;
    const remainingTodos = buildRemainingPageTodos(item, coveredFields, coveredWarningKeys, coveredTier1Keys);
    const hasSecrets = records.some((record) => record.url === item.url && (record.security?.secrets.length ?? 0) > 0);
    if (remainingTodos.length === 0 && !hasSecrets) continue;
    pageFixes.push({ item, remainingTodos });
  }

  const securityPages = records
    .map((record) => ({ url: record.url, secrets: record.security?.secrets ?? [] }))
    .filter((entry) => entry.secrets.length > 0);

  const stackProfile =
    options.stackProfile ??
    (redirectOnly
      ? { detections: [], tracking: { tagManager: [], analytics: [] } }
      : aggregateStackFromRecords(records));

  return {
    allItems,
    totalPages,
    redirectOnly,
    siteWideFields,
    siteWideWarningKeys,
    siteWideTier1Keys,
    siteWideFixTodos,
    templateGroups,
    templateFieldMap,
    templateWarningKeyMap,
    templateTier1KeyMap,
    coveredFieldsByTemplate,
    coveredWarningKeysByTemplate,
    coveredTier1KeysByTemplate,
    pageFixes,
    securityPages,
    stackProfile,
    crawlIssueCounts,
  };
}

export async function buildMarkdown(
  inputPath: string,
  records: ReportRecord[],
  includeOnlyErrors: boolean,
  tier1: Tier1ReportData = {},
  options: BuildMarkdownOptions = {}
): Promise<string> {
  const analysis = await buildReportAnalysis(records, tier1, options);
  const {
    allItems,
    totalPages,
    redirectOnly,
    siteWideFields,
    siteWideWarningKeys,
    siteWideTier1Keys,
    siteWideFixTodos,
    templateGroups,
    templateFieldMap,
    templateWarningKeyMap,
    templateTier1KeyMap,
    pageFixes,
    securityPages,
    stackProfile,
    crawlIssueCounts,
  } = analysis;
  const now = new Date().toISOString();

  const templateSections: string[] = [];

  if (templateGroups.size > 0) {
    templateSections.push("## Fix in templates", "");
    templateSections.push(
      "These issues appear on every page using the same template. Fix each template file once.",
      ""
    );

    const sortedGroups = [...templateGroups.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [template, items] of sortedGroups) {
      const templateFields = [...(templateFieldMap.get(template) ?? [])];
      const templateWarningKeys = [...(templateWarningKeyMap.get(template) ?? [])];
      const templateTier1Keys = [...(templateTier1KeyMap.get(template) ?? [])];
      const templateFixTodos = buildScopedFixTodos(
        items,
        "template",
        siteWideFields,
        siteWideWarningKeys,
        siteWideTier1Keys
      );
      templateSections.push(`### Template: \`${template}\` (${items.length} page(s))`, "");
      if (templateFixTodos.length === 0) {
        templateSections.push("- No template-specific issues (remaining issues are site-wide or page-specific).");
      } else {
        templateSections.push(...templateFixTodos);
      }
      templateSections.push("");
    }
  }

  const pageSections: string[] = [];
  let pageSpecificCount = 0;

  for (const { item, remainingTodos } of pageFixes) {
    const hasSecrets = securityPages.some((page) => page.url === item.url);

    if (includeOnlyErrors && remainingTodos.length === 0 && !hasSecrets) {
      continue;
    }

    if (remainingTodos.length === 0 && !hasSecrets) continue;

    pageSpecificCount += 1;
    const statusValue = item.status === null ? "error" : String(item.status);
    pageSections.push(`### ${item.url}`, "");
    pageSections.push(`- Status: \`${statusValue}\``);
    if (item.template) pageSections.push(`- Template: \`${item.template}\``);
    if (item.note) pageSections.push(`- Note: ${item.note}`);
    if (item.error) pageSections.push(`- Error: ${item.error}`);
    if (remainingTodos.length === 0) {
      pageSections.push("- [ ] Review security findings for this page");
    } else {
      pageSections.push(...remainingTodos);
    }
    pageSections.push("");
  }

  const securityLines: string[] = [];
  if (securityPages.length > 0) {
    const anyMasked = securityPages.some((page) => page.secrets.some((secret) => secret.masked.includes("…")));
    securityLines.push("## 🔑 Security", "");
    if (anyMasked) {
      securityLines.push("Secret values are masked. Re-run the crawl with `--reveal-secrets` to show full values.", "");
    }
    const severityRank = (severity: string): number => (severity === "critical" ? 0 : 1);
    for (const page of securityPages) {
      const sorted = [...page.secrets].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
      securityLines.push(`### ${page.url}`, "");
      for (const secret of sorted) {
        securityLines.push(`- [ ] **${secret.severity.toUpperCase()}** ${secret.provider} ${secret.type}: \`${secret.masked}\` (source: ${secret.source})`);
      }
      securityLines.push("");
    }
  }

  const redirectLines: string[] = [];
  if (tier1.redirect) {
    redirectLines.push(...buildRedirectSection(tier1.redirect));
  }

  const infraLines: string[] = [];
  if (tier1.dns) infraLines.push(...buildDnsSection(tier1.dns));
  if (!redirectOnly) {
    const stackLines = buildStackSection(stackProfile, totalPages);
    if (stackLines.length > 0) infraLines.push(...stackLines);
    if (tier1.securityHeaders) infraLines.push(...buildSecurityHeadersSection(tier1.securityHeaders));
    if (tier1.robotsTxt || tier1.sitemap) {
      infraLines.push(...buildRobotsAndSitemapSection(tier1.robotsTxt, tier1.sitemap));
    }
  }

  const templatesWithFixes = [...templateGroups.entries()]
    .filter(([, items]) => buildScopedFixTodos(items, "template", siteWideFields, siteWideWarningKeys, siteWideTier1Keys).length > 0)
    .map(([template]) => template)
    .sort();

  const issuesSummarySection = buildIssuesSummarySection(tier1, crawlIssueCounts, redirectOnly);

  const pagesWithIssues = allItems.filter(
    (item) =>
      item.missingFields.length > 0 ||
      item.warningKeys.length > 0 ||
      item.tier1IssueKeys.length > 0 ||
      records.some((record) => record.url === item.url && (record.security?.secrets.length ?? 0) > 0)
  ).length;

  const summaryIntro = redirectOnly
    ? "This host responds with a redirect at the start URL. Flightcheck validated the redirect setup and skipped crawling."
    : "Actionable todos from the flightcheck crawl, grouped by fix scope.";

  const coverageSection = buildCoverageSection(
    allItems,
    totalPages,
    siteWideFields,
    siteWideWarningKeys,
    siteWideTier1Keys,
    templateFieldMap,
    templateWarningKeyMap,
    templateTier1KeyMap
  );

  const lines: string[] = [
    "# Flightcheck TODO Report",
    "",
    `Generated: ${now}`,
    `Input: \`${inputPath}\``,
    "",
    "## Summary",
    "",
    summaryIntro,
    "",
    `- Pages analyzed: ${totalPages}`,
    `- Pages with issues: ${pagesWithIssues}`,
    `- Site-wide fixes: ${siteWideFixTodos.length}`,
    `- Templates that need fixes: ${templatesWithFixes.length > 0 ? templatesWithFixes.map((template) => `\`${template}\``).join(", ") : "none"}`,
    `- Pages with page-specific fixes: ${pageSpecificCount}`,
    "",
    ...issuesSummarySection,
    ...buildHowToUseSection(redirectOnly),
    ...coverageSection,
    "",
    ...redirectLines,
    ...securityLines,
    ...infraLines,
    "## Fix site-wide (all pages)",
    "",
  ];

  if (redirectOnly && totalPages === 0) {
    lines.push("- No crawl performed because the start URL is a domain redirect.");
  } else if (siteWideFixTodos.length === 0) {
    lines.push("- No issues shared by all scanned pages.");
  } else {
    lines.push(
      `These ${siteWideFixTodos.length} issue(s) appear on all ${totalPages} scanned page(s). Fix once in the root layout, shared head partial, or global SEO config.`,
      ""
    );
    lines.push(...siteWideFixTodos);
  }

  lines.push("");
  lines.push(...templateSections);

  lines.push("## Fix per page", "");
  lines.push("Issues not covered above — likely page-specific content or routes.", "");

  if (pageSections.length === 0) {
    lines.push("", "- No page-specific fixes needed.");
  } else {
    lines.push("");
    lines.push(...pageSections);
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

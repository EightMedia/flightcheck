import { buildReportAnalysis } from "./report.js";
import { defaultManifestPathForInput, defaultReportPathForInput } from "../crawler/outputPaths.js";
export const FIX_MANIFEST_VERSION = 1;
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
const STACK_SEARCH_HINTS = {
    "Next.js": ["app/layout.tsx", "app/**/layout.tsx", "generateMetadata", "metadata export", "next/head", "lib/seo"],
    Nuxt: ["app.vue", "nuxt.config", "useHead", "useSeoMeta"],
    Gatsby: ["gatsby-config", "gatsby-ssr", "react-helmet", "Seo component"],
    Astro: ["src/layouts", "src/components/Head", "astro.config"],
    Sanity: ["sanity", "cdn.sanity.io", "@sanity/image-url", "image alt", "schema"],
    Contentful: ["contentful", "ctfassets.net"],
    WordPress: ["wp-content/themes", "functions.php", "header.php"],
    Netlify: ["netlify.toml", "public/_headers", "[[headers]]"],
    Vercel: ["vercel.json", "next.config", "headers() in next.config"],
};
const STACK_MCP_SERVERS = {
    Netlify: "netlify",
    Vercel: "vercel",
    Sanity: "sanity",
    Contentful: "contentful",
};
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
function stripTodoMarkdown(todo) {
    return todo.replace(/^- \[ \] (\*\*[A-Z]+\*\* )?/, "").trim();
}
function formatScope(count, total) {
    if (total === 0)
        return "n/a";
    if (count === total)
        return "site-wide";
    return `${count}/${total} page(s)`;
}
function stackManifestEntries(profile, totalPages) {
    return profile.detections.map((detection) => ({
        name: detection.name,
        categories: detection.categories,
        confidence: detection.confidence,
        scope: detection.pageCount > 0
            ? detection.pageCount === totalPages
                ? "site-wide"
                : `${detection.pageCount}/${totalPages} page(s)`
            : "origin",
        evidence: detection.evidence,
    }));
}
function stackSearchHints(profile, minConfidence = "medium") {
    const hints = new Set();
    const rank = { low: 0, medium: 1, high: 2 };
    for (const detection of profile.detections) {
        if (rank[detection.confidence] < rank[minConfidence])
            continue;
        for (const hint of STACK_SEARCH_HINTS[detection.name] ?? []) {
            hints.add(hint);
        }
    }
    return [...hints];
}
function mcpServersForStack(profile, names) {
    const servers = new Set();
    for (const detection of profile.detections) {
        if (detection.confidence === "low")
            continue;
        const server = STACK_MCP_SERVERS[detection.name];
        if (server)
            servers.add(server);
    }
    for (const name of names) {
        const server = STACK_MCP_SERVERS[name];
        if (server)
            servers.add(server);
    }
    return [...servers];
}
function issueFromCheck(issue, scope) {
    return {
        id: issue.id,
        severity: issue.severity,
        scope,
        todo: issue.message,
    };
}
function seoIssuesFromFields(fields, scope, count, total) {
    return fields.map((field) => ({
        id: field,
        severity: "error",
        scope,
        count,
        todo: `Missing ${field} on ${formatScope(count, total)}`,
    }));
}
function warningIssues(keys, scope, count, total) {
    const labels = {
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
function a11yIssues(keys, scope, count, total) {
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
function buildRepoPackage(options) {
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
function collectPageIssues(pageFixes, kind) {
    const issues = [];
    for (const { item, remainingTodos } of pageFixes) {
        if (kind === "seo") {
            for (const field of item.missingFields) {
                issues.push({
                    id: field,
                    severity: "error",
                    scope: "page-specific",
                    todo: `Missing ${field}`,
                    urls: [item.url],
                });
            }
        }
        if (kind === "best-practices") {
            for (const key of item.warningKeys.filter((entry) => BEST_PRACTICE_WARNING_KEYS.has(entry))) {
                issues.push({
                    id: key,
                    severity: "warning",
                    scope: "page-specific",
                    todo: `Fix ${key} on page`,
                    urls: [item.url],
                });
            }
        }
        if (kind === "a11y") {
            for (const todo of remainingTodos) {
                if (/alt|landmark|heading|label|tabindex|lang|a11y|main/i.test(todo)) {
                    issues.push({
                        id: "page-a11y-todo",
                        severity: "warning",
                        scope: "page-specific",
                        todo: stripTodoMarkdown(todo),
                        urls: [item.url],
                    });
                }
            }
        }
    }
    return issues;
}
function buildWorkPackages(analysis, tier1, stackProfile) {
    const packages = [];
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
        const secretIssues = [];
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
        packages.push(buildRepoPackage({
            id: "seo-site-wide",
            promptId: "seo-site-wide",
            priority: 10,
            scope: "site-wide",
            issues: seoIssuesFromFields(siteSeoFields, "site-wide", totalPages, totalPages),
            searchHints: [...REPO_SEARCH_BASE, ...stackHints],
            prTitle: "fix(seo): add site-wide metadata and social tags",
        }));
    }
    const siteWarnings = [...analysis.siteWideWarningKeys].filter((key) => BEST_PRACTICE_WARNING_KEYS.has(key));
    if (siteWarnings.length > 0) {
        packages.push(buildRepoPackage({
            id: "best-practices-site-wide",
            promptId: "best-practices-site-wide",
            priority: 11,
            scope: "site-wide",
            issues: warningIssues(siteWarnings, "site-wide", totalPages, totalPages),
            searchHints: [...REPO_SEARCH_BASE, "main landmark", "<main>", "robots meta", 'meta name="template"'],
            prTitle: "fix: resolve site-wide best-practice issues",
        }));
    }
    const siteA11y = [...analysis.siteWideTier1Keys].filter((key) => A11Y_TIER1_IDS.has(key));
    if (siteA11y.length > 0) {
        packages.push(buildRepoPackage({
            id: "a11y-site-wide",
            promptId: "a11y-static",
            priority: 12,
            scope: "site-wide",
            issues: a11yIssues(siteA11y, "site-wide", totalPages, totalPages),
            searchHints: [...REPO_SEARCH_BASE, "shared components", "image alt", "html lang"],
            mcpServers: mcpServersForStack(stackProfile, ["Sanity"]),
            prTitle: "fix(a11y): resolve site-wide accessibility issues",
        }));
    }
    for (const [template, fields] of analysis.templateFieldMap) {
        if (fields.size === 0)
            continue;
        const items = analysis.templateGroups.get(template) ?? [];
        packages.push(buildRepoPackage({
            id: `seo-template-${template}`,
            promptId: "seo-template",
            priority: 20,
            scope: `template: ${template}`,
            template,
            issues: seoIssuesFromFields([...fields], `template: ${template}`, items.length, totalPages),
            searchHints: [...TEMPLATE_SEARCH_BASE, `template meta value: ${template}`, ...stackHints],
            prTitle: `fix(seo): add metadata for ${template} template`,
        }));
    }
    for (const [template, keys] of analysis.templateWarningKeyMap) {
        const warningKeys = [...keys].filter((key) => BEST_PRACTICE_WARNING_KEYS.has(key));
        if (warningKeys.length === 0)
            continue;
        const items = analysis.templateGroups.get(template) ?? [];
        packages.push(buildRepoPackage({
            id: `best-practices-template-${template}`,
            promptId: "best-practices-template",
            priority: 21,
            scope: `template: ${template}`,
            template,
            issues: warningIssues(warningKeys, `template: ${template}`, items.length, totalPages),
            searchHints: [...TEMPLATE_SEARCH_BASE, `template meta value: ${template}`],
            prTitle: `fix: resolve best-practice issues for ${template} template`,
        }));
    }
    for (const [template, keys] of analysis.templateTier1KeyMap) {
        const a11yKeys = [...keys].filter((key) => A11Y_TIER1_IDS.has(key));
        if (a11yKeys.length === 0)
            continue;
        const items = analysis.templateGroups.get(template) ?? [];
        packages.push(buildRepoPackage({
            id: `a11y-template-${template}`,
            promptId: "a11y-static",
            priority: 22,
            scope: `template: ${template}`,
            template,
            issues: a11yIssues(a11yKeys, `template: ${template}`, items.length, totalPages),
            searchHints: [...TEMPLATE_SEARCH_BASE, `template meta value: ${template}`, "image alt"],
            mcpServers: mcpServersForStack(stackProfile, ["Sanity"]),
            prTitle: `fix(a11y): resolve accessibility issues for ${template} template`,
        }));
    }
    if (!redirectOnly) {
        const pageSeo = collectPageIssues(analysis.pageFixes, "seo");
        if (pageSeo.length > 0) {
            packages.push(buildRepoPackage({
                id: "seo-pages",
                promptId: "seo-page",
                priority: 30,
                scope: "page-specific",
                issues: pageSeo,
                searchHints: [...PAGE_SEARCH_BASE, ...stackHints],
                prTitle: "fix(seo): resolve page-specific metadata issues",
            }));
        }
        const pageBest = collectPageIssues(analysis.pageFixes, "best-practices");
        if (pageBest.length > 0) {
            packages.push(buildRepoPackage({
                id: "best-practices-pages",
                promptId: "best-practices-page",
                priority: 31,
                scope: "page-specific",
                issues: pageBest,
                searchHints: PAGE_SEARCH_BASE,
                prTitle: "fix: resolve page-specific best-practice issues",
            }));
        }
        const pageA11y = collectPageIssues(analysis.pageFixes, "a11y");
        if (pageA11y.length > 0) {
            packages.push(buildRepoPackage({
                id: "a11y-pages",
                promptId: "a11y-static",
                priority: 32,
                scope: "page-specific",
                issues: pageA11y,
                searchHints: [...PAGE_SEARCH_BASE, "image alt", "Sanity image", "cms"],
                mcpServers: mcpServersForStack(stackProfile, ["Sanity"]),
                prTitle: "fix(a11y): resolve page-specific accessibility issues",
            }));
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
    return packages.sort((a, b) => a.priority - b.priority);
}
export async function buildFixManifest(sourcePath, records, tier1 = {}, options = {}) {
    const analysis = await buildReportAnalysis(records, tier1, {
        redirectOnly: options.redirectOnly ?? false,
        stackProfile: options.stackProfile,
    });
    const reportPath = options.reportPath ?? defaultReportPathForInput(sourcePath);
    return {
        version: FIX_MANIFEST_VERSION,
        generatedAt: new Date().toISOString(),
        source: sourcePath,
        reportPath,
        redirectOnly: analysis.redirectOnly,
        stack: stackManifestEntries(analysis.stackProfile, analysis.totalPages),
        workPackages: buildWorkPackages(analysis, tier1, analysis.stackProfile),
    };
}
export { defaultManifestPathForInput };

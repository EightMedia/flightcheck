import { detectStackFromDns, detectStackFromHeaders, detectStackFromRobots, } from "../crawler/stack.js";
const TRACKING_PROVIDER_LABELS = {
    "google-tag-manager": "Google Tag Manager",
    "google-analytics-ga4": "Google Analytics (GA4)",
    "google-analytics-ua": "Google Analytics (Universal)",
    matomo: "Matomo",
    "facebook-pixel": "Facebook Pixel",
    plausible: "Plausible",
};
function confidenceRank(confidence) {
    return confidence === "high" ? 2 : confidence === "medium" ? 1 : 0;
}
function mergeConfidence(a, b) {
    return confidenceRank(a) >= confidenceRank(b) ? a : b;
}
function dedupeTracking(items) {
    const seen = new Set();
    return items.filter((item) => {
        const key = `${item.provider}:${item.id}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
function aggregateTracking(records) {
    const tagManager = [];
    const analytics = [];
    for (const record of records) {
        tagManager.push(...record.tracking.tagManager);
        analytics.push(...record.tracking.analytics);
    }
    return {
        tagManager: dedupeTracking(tagManager),
        analytics: dedupeTracking(analytics),
    };
}
const STACK_CATEGORY_ORDER = ["Platform", "Framework", "CMS", "Search", "Hosting", "CDN", "Other"];
function isCuratedStackDetection(detection) {
    return detection.detector === "flightcheck-v1";
}
function filterCuratedDetections(detections) {
    return detections.filter(isCuratedStackDetection);
}
function primaryCategory(detection) {
    return detection.categories[0] ?? "Other";
}
function categorySortKey(category) {
    const index = STACK_CATEGORY_ORDER.indexOf(category);
    return index === -1 ? STACK_CATEGORY_ORDER.length : index;
}
function aggregateDetections(pageDetections, originDetections) {
    const merged = new Map();
    const add = (detection, pageUrl) => {
        const key = detection.name;
        const existing = merged.get(key);
        if (!existing) {
            merged.set(key, {
                ...detection,
                evidence: [...detection.evidence],
                pageCount: pageUrl ? 1 : 0,
                pages: new Set(pageUrl ? [pageUrl] : []),
            });
            return;
        }
        existing.evidence = [...new Set([...existing.evidence, ...detection.evidence])];
        existing.confidence = mergeConfidence(existing.confidence, detection.confidence);
        existing.categories = [...new Set([...existing.categories, ...detection.categories])];
        if (!existing.website && detection.website)
            existing.website = detection.website;
        if (!existing.version && detection.version)
            existing.version = detection.version;
        if (pageUrl)
            existing.pages.add(pageUrl);
    };
    for (const { url, detections } of pageDetections) {
        for (const detection of filterCuratedDetections(detections)) {
            add(detection, url);
        }
    }
    for (const detection of originDetections) {
        add(detection);
    }
    return [...merged.values()]
        .map(({ pages, ...detection }) => ({
        ...detection,
        pageCount: pages.size,
    }))
        .sort((a, b) => {
        const categoryDiff = categorySortKey(primaryCategory(a)) - categorySortKey(primaryCategory(b));
        if (categoryDiff !== 0)
            return categoryDiff;
        return a.name.localeCompare(b.name);
    });
}
export function aggregateStackFromRecords(records) {
    const pageDetections = records
        .filter((record) => record.stack?.detections?.length)
        .map((record) => ({ url: record.url, detections: record.stack.detections }));
    return {
        detections: aggregateDetections(pageDetections, []),
        tracking: aggregateTracking(records),
    };
}
export function buildStackProfile(records, options = {}) {
    const pageDetections = records
        .filter((record) => record.stack?.detections?.length)
        .map((record) => ({ url: record.url, detections: record.stack.detections }));
    const originDetections = [];
    if (options.securityHeaders) {
        originDetections.push(...detectStackFromHeaders(options.securityHeaders.headers));
    }
    if (options.dns) {
        originDetections.push(...detectStackFromDns({
            cname: options.dns.records.cname,
            ns: options.dns.records.ns,
            mx: options.dns.records.mx,
            txt: options.dns.records.txt,
        }));
    }
    if (options.robotsTxt?.body) {
        originDetections.push(...detectStackFromRobots(options.robotsTxt.body));
    }
    return {
        detections: aggregateDetections(pageDetections, originDetections),
        tracking: aggregateTracking(records),
    };
}
function formatTrackingItem(item) {
    const label = TRACKING_PROVIDER_LABELS[item.provider] ?? item.provider;
    return item.id ? `${label}: \`${item.id}\`` : label;
}
export function buildStackSection(profile, totalPages) {
    const hasDetections = profile.detections.length > 0;
    const hasTracking = profile.tracking.tagManager.length > 0 || profile.tracking.analytics.length > 0;
    if (!hasDetections && !hasTracking) {
        return [];
    }
    const lines = ["## Stack", ""];
    if (hasDetections) {
        const byCategory = new Map();
        for (const detection of profile.detections) {
            const category = primaryCategory(detection);
            const list = byCategory.get(category) ?? [];
            list.push(detection);
            byCategory.set(category, list);
        }
        for (const [category, items] of [...byCategory.entries()].sort(([a], [b]) => categorySortKey(a) - categorySortKey(b))) {
            lines.push(`### ${category}`, "");
            for (const item of items) {
                const scope = item.pageCount > 0
                    ? item.pageCount === totalPages
                        ? "site-wide"
                        : `${item.pageCount}/${totalPages} page(s)`
                    : "origin";
                const versionSuffix = item.version ? `, v${item.version}` : "";
                lines.push(`- **${item.name}** (${item.confidence}${versionSuffix}, ${scope})`);
                for (const evidence of item.evidence.slice(0, 3)) {
                    lines.push(`  - ${evidence}`);
                }
                if (item.evidence.length > 3) {
                    lines.push(`  - …and ${item.evidence.length - 3} more signal(s)`);
                }
                if (item.website) {
                    lines.push(`  - website: ${item.website}`);
                }
            }
            lines.push("");
        }
    }
    if (hasTracking) {
        lines.push("### Tracking (flightcheck crawl)", "");
        if (profile.tracking.tagManager.length > 0) {
            lines.push("- Tag managers:");
            for (const item of profile.tracking.tagManager) {
                lines.push(`  - ${formatTrackingItem(item)}`);
            }
        }
        if (profile.tracking.analytics.length > 0) {
            lines.push("- Analytics & pixels:");
            for (const item of profile.tracking.analytics) {
                lines.push(`  - ${formatTrackingItem(item)}`);
            }
        }
        lines.push("");
    }
    return lines;
}

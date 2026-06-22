import type { DnsCheckResult } from "../checks/dns.js";
import type { RobotsTxtCheckResult } from "../checks/robots-txt.js";
import type { SecurityHeadersCheckResult } from "../checks/security-headers.js";
import {
  detectStackFromDns,
  detectStackFromHeaders,
  detectStackFromRobots,
  loadTechnologyIndex,
  type StackDetection,
} from "../crawler/stack.js";
import type { TrackingItem } from "../crawler/schema.js";

export type StackRecord = {
  url: string;
  stack?: { detections: StackDetection[] };
  tracking: {
    tagManager: TrackingItem[];
    analytics: TrackingItem[];
  };
};

export type AggregatedStackDetection = StackDetection & {
  pageCount: number;
};

export type StackProfile = {
  detections: AggregatedStackDetection[];
  tracking: {
    tagManager: TrackingItem[];
    analytics: TrackingItem[];
  };
};

const TRACKING_PROVIDER_LABELS: Record<string, string> = {
  "google-tag-manager": "Google Tag Manager",
  "google-analytics-ga4": "Google Analytics (GA4)",
  "google-analytics-ua": "Google Analytics (Universal)",
  matomo: "Matomo",
  "facebook-pixel": "Facebook Pixel",
  plausible: "Plausible",
};

type StackConfidence = StackDetection["confidence"];

function confidenceRank(confidence: StackConfidence): number {
  return confidence === "high" ? 2 : confidence === "medium" ? 1 : 0;
}

function mergeConfidence(a: StackConfidence, b: StackConfidence): StackConfidence {
  return confidenceRank(a) >= confidenceRank(b) ? a : b;
}

function dedupeTracking(items: TrackingItem[]): TrackingItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.provider}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function aggregateTracking(records: StackRecord[]): StackProfile["tracking"] {
  const tagManager: TrackingItem[] = [];
  const analytics: TrackingItem[] = [];

  for (const record of records) {
    tagManager.push(...record.tracking.tagManager);
    analytics.push(...record.tracking.analytics);
  }

  return {
    tagManager: dedupeTracking(tagManager),
    analytics: dedupeTracking(analytics),
  };
}

function primaryCategory(detection: StackDetection): string {
  return detection.categories[0] ?? "Other";
}

function aggregateDetections(
  pageDetections: Array<{ url: string; detections: StackDetection[] }>,
  originDetections: StackDetection[]
): AggregatedStackDetection[] {
  const merged = new Map<string, AggregatedStackDetection & { pages: Set<string> }>();

  const add = (detection: StackDetection, pageUrl?: string) => {
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
    if (!existing.website && detection.website) existing.website = detection.website;
    if (!existing.version && detection.version) existing.version = detection.version;
    if (pageUrl) existing.pages.add(pageUrl);
  };

  for (const { url, detections } of pageDetections) {
    for (const detection of detections) {
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
      const categoryDiff = primaryCategory(a).localeCompare(primaryCategory(b));
      if (categoryDiff !== 0) return categoryDiff;
      return a.name.localeCompare(b.name);
    });
}

export function aggregateStackFromRecords(records: StackRecord[]): StackProfile {
  const pageDetections = records
    .filter((record) => record.stack?.detections?.length)
    .map((record) => ({ url: record.url, detections: record.stack!.detections }));

  return {
    detections: aggregateDetections(pageDetections, []),
    tracking: aggregateTracking(records),
  };
}

export async function buildStackProfile(
  records: StackRecord[],
  options: {
    securityHeaders?: SecurityHeadersCheckResult;
    dns?: DnsCheckResult;
    robotsTxt?: RobotsTxtCheckResult;
  } = {}
): Promise<StackProfile> {
  await loadTechnologyIndex();

  const pageDetections = records
    .filter((record) => record.stack?.detections?.length)
    .map((record) => ({ url: record.url, detections: record.stack!.detections }));

  const originDetections: StackDetection[] = [];
  if (options.securityHeaders) {
    originDetections.push(...(await detectStackFromHeaders(options.securityHeaders.headers)));
  }
  if (options.dns) {
    originDetections.push(
      ...(await detectStackFromDns({
        cname: options.dns.records.cname,
        ns: options.dns.records.ns,
        mx: options.dns.records.mx,
        txt: options.dns.records.txt,
      }))
    );
  }
  if (options.robotsTxt?.body) {
    originDetections.push(...(await detectStackFromRobots(options.robotsTxt.body)));
  }

  return {
    detections: aggregateDetections(pageDetections, originDetections),
    tracking: aggregateTracking(records),
  };
}

function formatTrackingItem(item: TrackingItem): string {
  const label = TRACKING_PROVIDER_LABELS[item.provider] ?? item.provider;
  return item.id ? `${label}: \`${item.id}\`` : label;
}

export function buildStackSection(profile: StackProfile, totalPages: number): string[] {
  const hasDetections = profile.detections.length > 0;
  const hasTracking = profile.tracking.tagManager.length > 0 || profile.tracking.analytics.length > 0;

  if (!hasDetections && !hasTracking) {
    return [];
  }

  const lines: string[] = ["## Stack", ""];

  if (hasDetections) {
    const byCategory = new Map<string, AggregatedStackDetection[]>();
    for (const detection of profile.detections) {
      const category = primaryCategory(detection);
      const list = byCategory.get(category) ?? [];
      list.push(detection);
      byCategory.set(category, list);
    }

    for (const [category, items] of [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      lines.push(`### ${category}`, "");
      for (const item of items) {
        const scope =
          item.pageCount > 0
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

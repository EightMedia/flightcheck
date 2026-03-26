import type { TrackingItem } from "./schema.js";

type TrackingResult = {
  tagManager: TrackingItem[];
  analytics: TrackingItem[];
};

function uniq(values: string[]): string[] {
  return [...new Set(values)];
}

export function extractTracking(html: string): TrackingResult {
  const fullText = html;
  const tagManager: TrackingItem[] = [];
  const analytics: TrackingItem[] = [];

  const gtmMatches = fullText.match(/GTM-[A-Z0-9]+/gi) ?? [];
  const ga4Matches = fullText.match(/\bG-[A-Z0-9]{6,}\b/gi) ?? [];
  const uaMatches = fullText.match(/\bUA-\d+-\d+\b/gi) ?? [];
  const matomoSiteIdMatches =
    fullText.match(
      /(?:_paq\.push\(\[['"]setSiteId['"],\s*['"]?(\d+)['"]?\]\)|siteId['"]?\s*[:=]\s*['"]?(\d+)['"]?)/gi
    ) ?? [];
  const pixelMatches = fullText.match(/\bfbq\(['"]init['"],\s*['"](\d{6,})['"]\)/gi) ?? [];
  const plausibleMatch = /plausible\.io\/js\/script\.js/i.test(fullText);

  for (const id of uniq(gtmMatches)) {
    tagManager.push({ provider: "google-tag-manager", id });
  }
  for (const id of uniq(ga4Matches)) {
    analytics.push({ provider: "google-analytics-ga4", id });
  }
  for (const id of uniq(uaMatches)) {
    analytics.push({ provider: "google-analytics-ua", id });
  }
  for (const raw of uniq(matomoSiteIdMatches)) {
    const idMatch = raw.match(/(\d+)/);
    if (idMatch) analytics.push({ provider: "matomo", id: idMatch[1] });
  }
  for (const raw of uniq(pixelMatches)) {
    const idMatch = raw.match(/(\d{6,})/);
    if (idMatch) analytics.push({ provider: "facebook-pixel", id: idMatch[1] });
  }
  if (plausibleMatch) {
    analytics.push({ provider: "plausible", id: "" });
  }

  const dedupeByProviderAndId = (items: TrackingItem[]): TrackingItem[] => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.provider}:${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  return {
    tagManager: dedupeByProviderAndId(tagManager),
    analytics: dedupeByProviderAndId(analytics),
  };
}

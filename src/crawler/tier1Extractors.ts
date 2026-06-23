import type { CheerioAPI } from "cheerio";
import type { CrawlIssue } from "./schema.js";

type CheerioSelection = ReturnType<CheerioAPI>;

type ImageReference = {
  filename: string;
  url: string;
};

function crawlIssue(id: string, severity: CrawlIssue["severity"], message: string): CrawlIssue {
  return { id, severity, message };
}

function parsePixelSize(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)px$/i);
  return match ? Number(match[1]) : null;
}

function isDecorativeImage($img: CheerioSelection): boolean {
  if ($img.attr("aria-hidden") === "true") return true;
  if (($img.attr("role") ?? "").toLowerCase() === "presentation") return true;

  const width = parsePixelSize($img.attr("width")) ?? parsePixelSize($img.attr("style")?.match(/width:\s*(\d+px)/i)?.[1]);
  const height = parsePixelSize($img.attr("height")) ?? parsePixelSize($img.attr("style")?.match(/height:\s*(\d+px)/i)?.[1]);
  if (width !== null && height !== null && width <= 2 && height <= 2) return true;

  return false;
}

const GENERIC_ALT = new Set(["image", "photo", "picture", "img", "logo", "icon"]);
const IMAGE_EXTENSION_RE = /\.(?:jpe?g|png|gif|webp|avif|svg)$/i;
const IMAGE_FILENAME_IN_TEXT_RE = /([^\/?#\s&,=]+\.(?:jpe?g|png|gif|webp|avif|svg))/gi;

function tryDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function looksUrlEncoded(value: string): boolean {
  return /%[0-9a-f]{2}/i.test(value);
}

function extractProxyImageUrl(value: string): string | null {
  if (!/[?&]url=/i.test(value)) return null;
  const match = value.match(/[?&]url=([^&]+)/i);
  if (!match?.[1]) return null;
  return tryDecodeURIComponent(match[1]);
}

function isValidImageFilename(filename: string): boolean {
  if (!filename || filename.includes("&") || filename.includes("=")) return false;
  if (filename.includes("%") || filename.includes("://")) return false;
  if (!IMAGE_EXTENSION_RE.test(filename)) return false;
  return !/^\d+$/.test(filename.replace(IMAGE_EXTENSION_RE, ""));
}

function filenameFromUrl(url: string): string | null {
  let working = url.trim();
  if (!working || working.startsWith("data:") || working.startsWith("blob:")) return null;

  if (looksUrlEncoded(working)) {
    working = tryDecodeURIComponent(working);
  }

  const proxyUrl = extractProxyImageUrl(working);
  if (proxyUrl) {
    working = proxyUrl;
  }

  let pathname: string;
  try {
    pathname = working.includes("://") ? new URL(working).pathname : working.split(/[?#]/)[0] ?? "";
  } catch {
    pathname = working.split(/[?#]/)[0] ?? "";
  }

  const filename = pathname.split("/").filter(Boolean).pop() ?? "";
  return isValidImageFilename(filename) ? filename : null;
}

function filenamesInText(text: string): string[] {
  const seen = new Set<string>();
  const filenames: string[] = [];
  const decoded = looksUrlEncoded(text) ? tryDecodeURIComponent(text) : text;

  for (const source of [text, decoded]) {
    for (const match of source.matchAll(IMAGE_FILENAME_IN_TEXT_RE)) {
      const filename = match[1];
      if (!isValidImageFilename(filename) || seen.has(filename)) continue;
      seen.add(filename);
      filenames.push(filename);
    }
  }

  return filenames;
}

function srcsetCandidates(srcset: string): string[] {
  return srcset
    .split(/,\s*(?=(?:https?:)?\/)/i)
    .map((entry) => entry.trim().split(/\s+/)[0] ?? "")
    .filter(Boolean);
}

function imageReferenceFromValue(value: string, pageUrl: string): ImageReference | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidates = /\d+w|\d+x/i.test(trimmed) ? srcsetCandidates(trimmed) : [trimmed];

  for (const candidate of candidates) {
    const decoded = tryDecodeURIComponent(candidate);
    const proxyUrl = extractProxyImageUrl(candidate) ?? extractProxyImageUrl(decoded);
    const lookups = [proxyUrl, decoded, candidate].filter((entry): entry is string => Boolean(entry));

    for (const lookup of lookups) {
      const filename = filenameFromUrl(lookup) ?? filenamesInText(lookup)[0];
      if (!filename) continue;
      const url = toAbsoluteImageUrl(lookup, pageUrl);
      if (!url) continue;
      return { filename, url };
    }
  }

  return null;
}

function toAbsoluteImageUrl(value: string, pageUrl: string): string | null {
  let working = value.trim();
  if (!working || working.startsWith("data:") || working.startsWith("blob:")) return null;

  if (looksUrlEncoded(working)) {
    working = tryDecodeURIComponent(working);
  }

  const proxyUrl = extractProxyImageUrl(working);
  if (proxyUrl) {
    working = proxyUrl;
  }

  try {
    return working.includes("://") ? new URL(working).href : new URL(working, pageUrl).href;
  } catch {
    return null;
  }
}

function collectImageReference($: CheerioAPI, $img: CheerioSelection, pageUrl: string): ImageReference | null {
  const candidates: string[] = [];

  const src = ($img.attr("src") ?? "").trim();
  if (src) candidates.push(src);

  const srcset = ($img.attr("srcset") ?? "").trim();
  if (srcset) candidates.push(srcset);

  const $picture = $img.closest("picture");
  if ($picture.length > 0) {
    $picture.find("source").each((_, source) => {
      const $source = $(source);
      const sourceSrc = ($source.attr("src") ?? "").trim();
      if (sourceSrc) candidates.push(sourceSrc);
      const sourceSrcset = ($source.attr("srcset") ?? "").trim();
      if (sourceSrcset) candidates.push(sourceSrcset);
    });
  }

  for (const candidate of candidates) {
    const reference = imageReferenceFromValue(candidate, pageUrl);
    if (reference) return reference;
  }

  return null;
}

function imageIssueMessage(base: string, reference: ImageReference | null): string {
  if (!reference) return base;
  return `${base} ([${reference.filename}](${reference.url}))`;
}

function isGenericAlt(alt: string, src: string): boolean {
  const normalized = alt.trim().toLowerCase();
  if (!normalized) return false;
  if (GENERIC_ALT.has(normalized)) return true;

  const filename = src.split("/").pop()?.split("?")[0] ?? "";
  const basename = filename.replace(/\.[^.]+$/, "").toLowerCase();
  return basename.length > 0 && normalized === basename;
}

export function extractImageIssues($: CheerioAPI, pageUrl: string): CrawlIssue[] {
  const issues: CrawlIssue[] = [];

  $("img").each((_, element) => {
    const $img = $(element);
    if (isDecorativeImage($img)) return;

    const src = ($img.attr("src") ?? "").trim();
    const reference = collectImageReference($, $img, pageUrl);
    const hasAlt = $img.get(0)?.attribs && Object.prototype.hasOwnProperty.call($img.get(0)!.attribs, "alt");
    const alt = ($img.attr("alt") ?? "").trim();

    if (!hasAlt) {
      issues.push(
        crawlIssue("missing-alt", "error", imageIssueMessage("Image is missing an alt attribute.", reference))
      );
      return;
    }

    if (alt.length === 0) {
      issues.push(
        crawlIssue("empty-alt", "warning", imageIssueMessage("Image has an empty alt attribute.", reference))
      );
      return;
    }

    if (isGenericAlt(alt, src)) {
      issues.push(
        crawlIssue("generic-alt", "warning", imageIssueMessage("Image uses generic alt text.", reference))
      );
    }
  });

  return issues;
}

function headingLevel(tagName: string): number | null {
  const match = tagName.match(/^h([1-6])$/i);
  return match ? Number(match[1]) : null;
}

function hasAssociatedLabel($: CheerioAPI, $input: CheerioSelection): boolean {
  const id = ($input.attr("id") ?? "").trim();
  if (id && $(`label[for="${id}"]`).length > 0) return true;
  if (($input.attr("aria-label") ?? "").trim()) return true;
  if (($input.attr("aria-labelledby") ?? "").trim()) return true;
  if ($input.parents("label").length > 0) return true;
  if (($input.attr("title") ?? "").trim()) return true;
  return false;
}

export function extractA11yStaticIssues($: CheerioAPI): CrawlIssue[] {
  const issues: CrawlIssue[] = [];

  const headings = $("h1, h2, h3, h4, h5, h6")
    .toArray()
    .map((element) => headingLevel("name" in element ? String(element.name) : ""))
    .filter((level): level is number => level !== null);

  if ($("h1").length > 1) {
    issues.push(crawlIssue("multiple-h1", "warning", "Page has multiple h1 elements."));
  }

  let previousLevel: number | null = null;
  for (const level of headings) {
    if (previousLevel !== null && level > previousLevel + 1) {
      issues.push(crawlIssue("heading-skip", "warning", "Heading levels skip a rank."));
      break;
    }
    previousLevel = level;
  }

  const lang = ($("html").first().attr("lang") ?? "").trim();
  if (!lang) {
    issues.push(crawlIssue("missing-lang", "error", "html element is missing a lang attribute."));
  }

  $("input, select, textarea")
    .not('[type="hidden"], [type="submit"], [type="button"], [type="reset"], [type="image"]')
    .each((_, element) => {
      const $input = $(element);
      if (!hasAssociatedLabel($, $input)) {
        issues.push(crawlIssue("unlabeled-input", "error", "Form control is missing an associated label."));
      }
    });

  $("[tabindex]")
    .toArray()
    .forEach((element) => {
      const value = Number.parseInt($(element).attr("tabindex") ?? "", 10);
      if (Number.isFinite(value) && value > 0) {
        issues.push(crawlIssue("positive-tabindex", "warning", "Element uses a positive tabindex."));
      }
    });

  return issues;
}

import * as cheerio from "cheerio";
import { createEmptyVerificationRecord, type VerificationRecord } from "./schema.js";
import { extractTracking } from "./tracking.js";
import { resolveUrlMaybe } from "./urlUtils.js";
import { CHECK_GROUPS, type CheckGroup } from "./checkGroups.js";

function textOrEmpty(value: string | undefined | null): string {
  return (value ?? "").trim();
}

function attrOrEmpty(
  $: cheerio.CheerioAPI,
  selector: string,
  attrName: string,
  options?: { containsRel?: string }
): string {
  if (options?.containsRel) {
    const containsRel = options.containsRel.toLowerCase();
    const node = $(selector)
      .toArray()
      .map((el) => $(el))
      .find((nodeEl) => textOrEmpty(nodeEl.attr("rel")).toLowerCase().includes(containsRel));
    return textOrEmpty(node?.attr(attrName));
  }
  return textOrEmpty($(selector).first().attr(attrName));
}

export function extractVerificationRecord(
  html: string,
  url: string,
  status: number | null,
  contentType: string,
  activeGroups: Set<CheckGroup> = new Set(CHECK_GROUPS)
): VerificationRecord {
  const empty = createEmptyVerificationRecord(url, status);

  if (!contentType.includes("text/html")) {
    return {
      ...empty,
      note: `Skipped non-HTML content-type: ${contentType || "unknown"}`,
    };
  }

  const $ = cheerio.load(html);
  const result: VerificationRecord = { ...empty };

  if (activeGroups.has("meta")) {
    const title = textOrEmpty($("title").first().text());
    result.title = title;
    result.h1 = textOrEmpty($("h1").first().text());
    result.metaDescription = attrOrEmpty($, 'meta[name="description"]', "content");
    result.robots = attrOrEmpty($, 'meta[name="robots"]', "content");
    result.template = attrOrEmpty($, 'meta[name="template"]', "content");
    result.colorScheme = attrOrEmpty($, 'meta[name="color-scheme"]', "content");
    result.themeColor = attrOrEmpty($, 'meta[name="theme-color"]', "content");
    result.viewport = attrOrEmpty($, 'meta[name="viewport"]', "content");
    result.language = textOrEmpty($("html").first().attr("lang"));
    result.charset = textOrEmpty($("meta[charset]").first().attr("charset"));
    const doctypeMatch = html.match(/<!doctype\s+([^>]+)>/i);
    result.doctype = textOrEmpty(doctypeMatch?.[1]);
    result.canonical = resolveUrlMaybe(attrOrEmpty($, 'link[rel="canonical"]', "href"), url);
  }

  if (activeGroups.has("social")) {
    result.og = {
      title: attrOrEmpty($, 'meta[property="og:title"]', "content"),
      description: attrOrEmpty($, 'meta[property="og:description"]', "content"),
      image: resolveUrlMaybe(attrOrEmpty($, 'meta[property="og:image"]', "content"), url),
      url: resolveUrlMaybe(attrOrEmpty($, 'meta[property="og:url"]', "content"), url),
      type: attrOrEmpty($, 'meta[property="og:type"]', "content"),
      siteName: attrOrEmpty($, 'meta[property="og:site_name"]', "content"),
    };
    result.twitter = {
      card: attrOrEmpty($, 'meta[name="twitter:card"]', "content"),
      title: attrOrEmpty($, 'meta[name="twitter:title"]', "content"),
      description: attrOrEmpty($, 'meta[name="twitter:description"]', "content"),
      image: resolveUrlMaybe(attrOrEmpty($, 'meta[name="twitter:image"]', "content"), url),
    };
  }

  if (activeGroups.has("meta")) {
    result.metaTitle = textOrEmpty(result.og.title || result.twitter.title || result.title);
  }

  if (activeGroups.has("icons")) {
    result.favicon = resolveUrlMaybe(attrOrEmpty($, "link[rel]", "href", { containsRel: "icon" }), url);
    result.icons = $("link[rel]")
      .toArray()
      .map((el) => $(el))
      .filter((el) => textOrEmpty(el.attr("rel")).toLowerCase().includes("icon"))
      .map((el) => ({
        rel: textOrEmpty(el.attr("rel")).toLowerCase(),
        href: resolveUrlMaybe(textOrEmpty(el.attr("href")), url),
        type: textOrEmpty(el.attr("type")),
        sizes: textOrEmpty(el.attr("sizes")),
        media: textOrEmpty(el.attr("media")),
      }));
  }

  if (activeGroups.has("tracking")) {
    result.tracking = extractTracking(html);
  }

  return result;
}

const NON_HTML_EXTENSIONS = new Set([
  "pdf",
  "zip",
  "rar",
  "gz",
  "tar",
  "7z",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "csv",
  "rtf",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "ico",
  "bmp",
  "tiff",
  "mp3",
  "wav",
  "ogg",
  "mp4",
  "webm",
  "mov",
  "avi",
  "mkv",
  "woff",
  "woff2",
  "ttf",
  "eot",
  "dmg",
  "exe",
  "apk",
]);

function hasNonHtmlExtension(pathname: string): boolean {
  const lastSegment = pathname.split("/").pop() ?? "";
  const dotIndex = lastSegment.lastIndexOf(".");
  if (dotIndex === -1) return false;
  const extension = lastSegment.slice(dotIndex + 1).toLowerCase();
  return NON_HTML_EXTENSIONS.has(extension);
}

export function extractInternalLinks(html: string, currentUrl: string, origin: string): Set<string> {
  const $ = cheerio.load(html);
  const links = new Set<string>();

  $("a[href]").each((_, element) => {
    const rawHref = textOrEmpty($(element).attr("href"));
    if (
      !rawHref ||
      rawHref.startsWith("#") ||
      rawHref.startsWith("mailto:") ||
      rawHref.startsWith("tel:") ||
      rawHref.startsWith("javascript:")
    ) {
      return;
    }

    try {
      const absolute = new URL(rawHref, currentUrl);
      if (absolute.origin !== origin) return;
      if (absolute.protocol !== "http:" && absolute.protocol !== "https:") return;
      if (hasNonHtmlExtension(absolute.pathname)) return;
      absolute.hash = "";
      absolute.search = "";
      links.add(absolute.toString());
    } catch {
      // Ignore malformed links.
    }
  });

  return links;
}

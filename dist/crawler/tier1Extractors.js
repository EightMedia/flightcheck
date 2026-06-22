function crawlIssue(id, severity, message) {
    return { id, severity, message };
}
function parsePixelSize(value) {
    if (!value)
        return null;
    const match = value.trim().match(/^(\d+(?:\.\d+)?)px$/i);
    return match ? Number(match[1]) : null;
}
function isDecorativeImage($img) {
    if ($img.attr("aria-hidden") === "true")
        return true;
    if (($img.attr("role") ?? "").toLowerCase() === "presentation")
        return true;
    const width = parsePixelSize($img.attr("width")) ?? parsePixelSize($img.attr("style")?.match(/width:\s*(\d+px)/i)?.[1]);
    const height = parsePixelSize($img.attr("height")) ?? parsePixelSize($img.attr("style")?.match(/height:\s*(\d+px)/i)?.[1]);
    if (width !== null && height !== null && width <= 2 && height <= 2)
        return true;
    return false;
}
const GENERIC_ALT = new Set(["image", "photo", "picture", "img", "logo", "icon"]);
const IMAGE_EXTENSION_RE = /\.(?:jpe?g|png|gif|webp|avif|svg)$/i;
const IMAGE_FILENAME_IN_TEXT_RE = /([^\/?#\s&,=]+\.(?:jpe?g|png|gif|webp|avif|svg))/gi;
function isValidImageFilename(filename) {
    if (!filename || filename.includes("&") || filename.includes("="))
        return false;
    if (!IMAGE_EXTENSION_RE.test(filename))
        return false;
    return !/^\d+$/.test(filename.replace(IMAGE_EXTENSION_RE, ""));
}
function filenameFromUrl(url) {
    const trimmed = url.trim();
    if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:"))
        return null;
    let pathname;
    try {
        pathname = trimmed.includes("://") ? new URL(trimmed).pathname : trimmed.split(/[?#]/)[0] ?? "";
    }
    catch {
        pathname = trimmed.split(/[?#]/)[0] ?? "";
    }
    const filename = pathname.split("/").filter(Boolean).pop() ?? "";
    return isValidImageFilename(filename) ? filename : null;
}
function filenamesInText(text) {
    const seen = new Set();
    const filenames = [];
    for (const match of text.matchAll(IMAGE_FILENAME_IN_TEXT_RE)) {
        const filename = match[1];
        if (!isValidImageFilename(filename) || seen.has(filename))
            continue;
        seen.add(filename);
        filenames.push(filename);
    }
    return filenames;
}
function filenameFromAttributeValue(value) {
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    let decoded = trimmed;
    try {
        decoded = decodeURIComponent(trimmed);
    }
    catch {
        // keep original value
    }
    return filenameFromUrl(trimmed) ?? filenameFromUrl(decoded) ?? filenamesInText(trimmed)[0] ?? filenamesInText(decoded)[0] ?? null;
}
function collectImageFilename($, $img) {
    const candidates = [];
    const src = ($img.attr("src") ?? "").trim();
    if (src)
        candidates.push(src);
    const srcset = ($img.attr("srcset") ?? "").trim();
    if (srcset)
        candidates.push(srcset);
    const $picture = $img.closest("picture");
    if ($picture.length > 0) {
        $picture.find("source").each((_, source) => {
            const $source = $(source);
            const sourceSrc = ($source.attr("src") ?? "").trim();
            if (sourceSrc)
                candidates.push(sourceSrc);
            const sourceSrcset = ($source.attr("srcset") ?? "").trim();
            if (sourceSrcset)
                candidates.push(sourceSrcset);
        });
    }
    for (const candidate of candidates) {
        const filename = filenameFromAttributeValue(candidate);
        if (filename)
            return filename;
    }
    return null;
}
function imageIssueMessage(base, filename) {
    return filename ? `${base} (${filename})` : base;
}
function isGenericAlt(alt, src) {
    const normalized = alt.trim().toLowerCase();
    if (!normalized)
        return false;
    if (GENERIC_ALT.has(normalized))
        return true;
    const filename = src.split("/").pop()?.split("?")[0] ?? "";
    const basename = filename.replace(/\.[^.]+$/, "").toLowerCase();
    return basename.length > 0 && normalized === basename;
}
export function extractImageIssues($) {
    const issues = [];
    $("img").each((_, element) => {
        const $img = $(element);
        if (isDecorativeImage($img))
            return;
        const src = ($img.attr("src") ?? "").trim();
        const filename = collectImageFilename($, $img);
        const hasAlt = $img.get(0)?.attribs && Object.prototype.hasOwnProperty.call($img.get(0).attribs, "alt");
        const alt = ($img.attr("alt") ?? "").trim();
        if (!hasAlt) {
            issues.push(crawlIssue("missing-alt", "error", imageIssueMessage("Image is missing an alt attribute.", filename)));
            return;
        }
        if (alt.length === 0) {
            issues.push(crawlIssue("empty-alt", "warning", imageIssueMessage("Image has an empty alt attribute.", filename)));
            return;
        }
        if (isGenericAlt(alt, src)) {
            issues.push(crawlIssue("generic-alt", "warning", imageIssueMessage("Image uses generic alt text.", filename)));
        }
    });
    return issues;
}
function headingLevel(tagName) {
    const match = tagName.match(/^h([1-6])$/i);
    return match ? Number(match[1]) : null;
}
function hasAssociatedLabel($, $input) {
    const id = ($input.attr("id") ?? "").trim();
    if (id && $(`label[for="${id}"]`).length > 0)
        return true;
    if (($input.attr("aria-label") ?? "").trim())
        return true;
    if (($input.attr("aria-labelledby") ?? "").trim())
        return true;
    if ($input.parents("label").length > 0)
        return true;
    if (($input.attr("title") ?? "").trim())
        return true;
    return false;
}
export function extractA11yStaticIssues($) {
    const issues = [];
    const headings = $("h1, h2, h3, h4, h5, h6")
        .toArray()
        .map((element) => headingLevel("name" in element ? String(element.name) : ""))
        .filter((level) => level !== null);
    if ($("h1").length > 1) {
        issues.push(crawlIssue("multiple-h1", "warning", "Page has multiple h1 elements."));
    }
    let previousLevel = null;
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

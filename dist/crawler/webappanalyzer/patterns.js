function toArray(value) {
    return Array.isArray(value) ? value : [value];
}
export function slugify(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/--+/g, "-")
        .replace(/(?:^-|-$)/g, "");
}
export function parsePattern(pattern, isRegex = true) {
    const parts = pattern.toString().split("\\;");
    const attrs = { value: parts[0] };
    for (let i = 1; i < parts.length; i += 1) {
        const segment = parts[i];
        const colon = segment.indexOf(":");
        if (colon === -1)
            continue;
        const key = segment.slice(0, colon);
        attrs[key] = segment.slice(colon + 1);
    }
    const value = typeof pattern === "number" ? String(pattern) : attrs.value;
    const regexSource = isRegex
        ? value
            .replace(/\//g, "\\/")
            .replace(/\\\+/g, "__escapedPlus__")
            .replace(/\+/g, "{1,250}")
            .replace(/\*/g, "{0,250}")
            .replace(/__escapedPlus__/g, "\\+")
        : value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return {
        value,
        regex: new RegExp(regexSource, "i"),
        confidence: Number.parseInt(attrs.confidence ?? "100", 10),
        version: attrs.version ?? "",
    };
}
export function transformPatterns(patterns, caseSensitive = false, isRegex = true) {
    if (!patterns)
        return [];
    let normalized;
    if (typeof patterns === "string" || typeof patterns === "number" || Array.isArray(patterns)) {
        normalized = { main: patterns };
    }
    else {
        normalized = patterns;
    }
    const parsed = Object.entries(normalized).reduce((acc, [key, value]) => {
        const normalizedKey = caseSensitive ? key : key.toLowerCase();
        acc[normalizedKey] = toArray(value).map((entry) => parsePattern(entry, isRegex));
        return acc;
    }, {});
    return "main" in parsed ? parsed.main : parsed;
}
export function resolveVersion(pattern, matchValue) {
    let resolved = pattern.version;
    if (!resolved)
        return "";
    const matches = pattern.regex.exec(matchValue);
    if (!matches)
        return "";
    for (let index = 0; index < matches.length; index += 1) {
        const match = matches[index];
        if (String(match).length > 10)
            continue;
        const ternary = new RegExp(`\\\\${index}\\?([^:]+):(.*)$`).exec(resolved);
        if (ternary && ternary.length === 3) {
            resolved = resolved.replace(ternary[0], match ? ternary[1] : ternary[2]);
        }
        resolved = resolved.trim().replace(new RegExp(`\\\\${index}`, "g"), match || "");
    }
    return resolved.replace(/\\\d/, "");
}

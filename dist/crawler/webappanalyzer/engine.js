import { analyzeDom } from "./dom.js";
import { parsePattern, resolveVersion, slugify, transformPatterns } from "./patterns.js";
function toArray(value) {
    return Array.isArray(value) ? value : [value];
}
function normalizeDom(dom) {
    if (!dom)
        return {};
    if (typeof dom === "string" || Array.isArray(dom)) {
        return toArray(dom).reduce((acc, selector) => {
            acc[selector] = { exists: parsePattern("", false) };
            return acc;
        }, {});
    }
    const result = {};
    for (const [selector, value] of Object.entries(dom)) {
        if (typeof value === "string") {
            result[selector] = { exists: parsePattern(value, false) };
            continue;
        }
        const objectValue = value;
        const entry = {};
        if ("exists" in objectValue) {
            entry.exists = parsePattern(String(objectValue.exists ?? ""), false);
        }
        if (objectValue.attributes && typeof objectValue.attributes === "object") {
            entry.attributes = Object.fromEntries(Object.entries(objectValue.attributes).map(([key, pattern]) => [
                key,
                parsePattern(pattern),
            ]));
        }
        if (objectValue.text) {
            entry.text = parsePattern(String(objectValue.text));
        }
        result[selector] = entry;
    }
    return result;
}
function transformStringMap(patterns, lowercaseKeys = true) {
    if (!patterns || typeof patterns !== "object")
        return {};
    return Object.fromEntries(Object.entries(patterns).map(([key, value]) => [
        lowercaseKeys ? key.toLowerCase() : key,
        transformPatterns(value),
    ]));
}
export function createTechnologyIndex(rawTechnologies, rawCategories) {
    const categories = Object.entries(rawCategories)
        .map(([id, category]) => ({
        id: Number.parseInt(id, 10),
        slug: slugify(category.name),
        ...category,
    }))
        .sort((a, b) => b.priority - a.priority);
    const allTechnologies = Object.entries(rawTechnologies).map(([name, raw]) => ({
        name,
        slug: slugify(name),
        categories: raw.cats ?? [],
        description: raw.description ?? null,
        website: raw.website ?? null,
        html: transformPatterns(raw.html),
        text: transformPatterns(raw.text),
        scripts: transformPatterns(raw.scripts),
        scriptSrc: transformPatterns(raw.scriptSrc),
        url: transformPatterns(raw.url),
        meta: transformStringMap(raw.meta),
        headers: transformStringMap(raw.headers),
        cookies: transformStringMap(raw.cookies),
        dns: transformStringMap(raw.dns),
        robots: transformPatterns(raw.robots),
        css: transformPatterns(raw.css),
        js: transformStringMap(raw.js, false),
        dom: normalizeDom(raw.dom),
        excludes: toArray(raw.excludes ?? []).map((value) => ({
            name: String(value).split("\\;")[0],
        })),
        implies: toArray(raw.implies ?? []).map((value) => {
            const parts = String(value).split("\\;");
            return {
                name: parts[0],
                confidence: Number.parseInt(parts.find((part) => part.startsWith("confidence:"))?.split(":")[1] ?? "100", 10),
                version: parts.find((part) => part.startsWith("version:"))?.split(":").slice(1).join(":") ?? "",
            };
        }),
    }));
    const rootTechnologies = allTechnologies.filter((technology) => {
        const requires = toArray(rawTechnologies[technology.name]?.requires ?? []);
        const requiresCategory = toArray(rawTechnologies[technology.name]?.requiresCategory ?? []);
        return requires.length === 0 && requiresCategory.length === 0;
    });
    const byName = new Map(allTechnologies.map((technology) => [technology.name, technology]));
    return {
        technologies: rootTechnologies,
        categories,
        byName,
    };
}
function getCategory(index, id) {
    return index.categories.find((category) => category.id === id);
}
function pushPatternMatch(matches, technology, type, pattern, value, match, version = "") {
    matches.push({
        technology,
        pattern: { ...pattern, type, value, match },
        version: version || resolveVersion(pattern, value),
    });
}
function analyzeJsOnHtml(technology, html) {
    const matches = [];
    for (const [property, patterns] of Object.entries(technology.js)) {
        for (const pattern of patterns) {
            if (pattern.value) {
                const result = pattern.regex.exec(html);
                if (result) {
                    pushPatternMatch(matches, technology, "js", pattern, html, result[0]);
                }
                continue;
            }
            if (html.includes(property)) {
                pushPatternMatch(matches, technology, "js", pattern, html, property);
            }
        }
    }
    return matches;
}
function analyzeOneToOne(technology, type, value) {
    const patterns = technology[type];
    if (!Array.isArray(patterns))
        return [];
    const matches = [];
    for (const pattern of patterns) {
        const result = pattern.regex.exec(value);
        if (!result)
            continue;
        matches.push({
            technology,
            pattern: { ...pattern, type: String(type), value, match: result[0] },
            version: resolveVersion(pattern, value),
        });
    }
    return matches;
}
function analyzeOneToMany(technology, type, values) {
    const patterns = technology[type];
    if (!Array.isArray(patterns))
        return [];
    const matches = [];
    for (const value of values) {
        for (const pattern of patterns) {
            const result = pattern.regex.exec(value);
            if (!result)
                continue;
            matches.push({
                technology,
                pattern: { ...pattern, type: String(type), value, match: result[0] },
                version: resolveVersion(pattern, value),
            });
        }
    }
    return matches;
}
function analyzeManyToMany(technology, type, items) {
    const patternsByKey = technology[type];
    const matches = [];
    for (const [key, patterns] of Object.entries(patternsByKey)) {
        const values = items[key] ?? [];
        for (const pattern of patterns) {
            for (const value of values) {
                if (!pattern.value && value) {
                    pushPatternMatch(matches, technology, type, pattern, value, value);
                    continue;
                }
                const result = pattern.regex.exec(value);
                if (!result)
                    continue;
                pushPatternMatch(matches, technology, type, pattern, value, result[0]);
            }
        }
    }
    return matches;
}
function resolveMatches(index, matches) {
    const grouped = new Map();
    for (const match of matches) {
        const key = match.technology.name;
        const existing = grouped.get(key);
        const evidence = `${match.pattern.type}: \`${match.pattern.match}\``;
        if (!existing) {
            grouped.set(key, {
                technology: match.technology,
                confidence: match.pattern.confidence,
                version: match.version,
                evidence: [evidence],
            });
            continue;
        }
        existing.confidence = Math.min(100, existing.confidence + match.pattern.confidence);
        if (match.version.length > existing.version.length && match.version.length <= 15) {
            existing.version = match.version;
        }
        existing.evidence.push(evidence);
    }
    let resolved = [...grouped.values()].map((entry) => ({
        name: entry.technology.name,
        categories: entry.technology.categories
            .map((id) => getCategory(index, id))
            .filter((category) => Boolean(category)),
        confidence: entry.confidence,
        version: entry.version,
        website: entry.technology.website,
        description: entry.technology.description,
        evidence: [...new Set(entry.evidence)],
    }));
    let changed = true;
    while (changed) {
        changed = false;
        for (const item of [...resolved]) {
            const technology = index.byName.get(item.name);
            if (!technology)
                continue;
            for (const implied of technology.implies) {
                if (resolved.some((entry) => entry.name === implied.name))
                    continue;
                const impliedTechnology = index.byName.get(implied.name);
                if (!impliedTechnology)
                    continue;
                resolved.push({
                    name: implied.name,
                    categories: impliedTechnology.categories
                        .map((id) => getCategory(index, id))
                        .filter((category) => Boolean(category)),
                    confidence: Math.min(item.confidence, implied.confidence),
                    version: implied.version,
                    website: impliedTechnology.website,
                    description: impliedTechnology.description,
                    evidence: [`implied by ${item.name}`],
                });
                changed = true;
            }
        }
    }
    for (const item of [...resolved]) {
        const technology = index.byName.get(item.name);
        if (!technology)
            continue;
        for (const excluded of technology.excludes) {
            resolved = resolved.filter((entry) => entry.name !== excluded.name);
        }
    }
    return resolved.sort((a, b) => {
        const priority = (categories) => categories.reduce((max, category) => Math.max(max, category.priority), 0);
        return priority(b.categories) - priority(a.categories);
    });
}
export function analyzeWithIndex(index, items, $) {
    const matches = [];
    for (const technology of index.technologies) {
        if (items.html)
            matches.push(...analyzeOneToOne(technology, "html", items.html));
        if (items.url)
            matches.push(...analyzeOneToOne(technology, "url", items.url));
        if (items.robots)
            matches.push(...analyzeOneToOne(technology, "robots", items.robots));
        if (items.text)
            matches.push(...analyzeOneToMany(technology, "text", items.text));
        if (items.scripts)
            matches.push(...analyzeOneToMany(technology, "scripts", items.scripts));
        if (items.scriptSrc)
            matches.push(...analyzeOneToMany(technology, "scriptSrc", items.scriptSrc));
        if (items.css)
            matches.push(...analyzeOneToMany(technology, "css", items.css));
        if (items.meta)
            matches.push(...analyzeManyToMany(technology, "meta", items.meta));
        if (items.headers)
            matches.push(...analyzeManyToMany(technology, "headers", items.headers));
        if (items.cookies)
            matches.push(...analyzeManyToMany(technology, "cookies", items.cookies));
        if (items.dns)
            matches.push(...analyzeManyToMany(technology, "dns", items.dns));
        if (items.html) {
            matches.push(...analyzeJsOnHtml(technology, items.html));
        }
        if (items.dom && $ && Object.keys(technology.dom).length > 0) {
            matches.push(...analyzeDom($, technology));
        }
    }
    return resolveMatches(index, matches);
}

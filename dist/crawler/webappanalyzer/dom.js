import { resolveVersion } from "./patterns.js";
function pushMatch(matches, technology, pattern, type, value, match) {
    matches.push({
        technology,
        pattern: { ...pattern, type, value, match },
        version: resolveVersion(pattern, value),
    });
}
function testPattern(pattern, value) {
    if (!pattern)
        return null;
    const result = pattern.regex.exec(value);
    return result ? result[0] : null;
}
export function analyzeDom($, technology) {
    const matches = [];
    for (const [selector, rules] of Object.entries(technology.dom)) {
        const elements = $(selector);
        if (elements.length === 0)
            continue;
        elements.each((_, element) => {
            const node = $(element);
            const domRules = rules;
            if (domRules.exists) {
                const existsPattern = domRules.exists;
                if (!existsPattern.value) {
                    pushMatch(matches, technology, existsPattern, "dom", selector, selector);
                }
                else {
                    const match = testPattern(existsPattern, selector) ?? selector;
                    pushMatch(matches, technology, existsPattern, "dom", selector, match);
                }
            }
            for (const [attr, pattern] of Object.entries(domRules.attributes ?? {})) {
                const value = node.attr(attr) ?? "";
                if (!pattern.value) {
                    if (value) {
                        pushMatch(matches, technology, pattern, "dom", value, value);
                    }
                    continue;
                }
                const match = testPattern(pattern, value);
                if (match)
                    pushMatch(matches, technology, pattern, "dom", value, match);
            }
            for (const [, pattern] of Object.entries(domRules.properties ?? {})) {
                const value = String(element.properties ?? "");
                const match = testPattern(pattern, value);
                if (match)
                    pushMatch(matches, technology, pattern, "dom", value, match);
            }
            if (domRules.text) {
                const value = node.text();
                const match = testPattern(domRules.text, value);
                if (match)
                    pushMatch(matches, technology, domRules.text, "dom", value, match);
            }
        });
    }
    return matches;
}

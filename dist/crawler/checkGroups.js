export const CHECK_GROUPS = ["meta", "icons", "social", "tracking", "stack", "security", "images", "a11y-static"];
function parseList(value) {
    return value
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
}
function assertValid(names) {
    const valid = new Set(CHECK_GROUPS);
    for (const name of names) {
        if (!valid.has(name)) {
            throw new Error(`Unknown check group "${name}". Valid groups: ${CHECK_GROUPS.join(", ")}.`);
        }
    }
    return names;
}
export function resolveActiveGroups(opts) {
    if (opts.only && opts.skip) {
        throw new Error("--only and --skip are mutually exclusive. Use one or the other.");
    }
    if (opts.only) {
        return new Set(assertValid(parseList(opts.only)));
    }
    if (opts.skip) {
        const skip = new Set(assertValid(parseList(opts.skip)));
        return new Set(CHECK_GROUPS.filter((group) => !skip.has(group)));
    }
    return new Set(CHECK_GROUPS);
}

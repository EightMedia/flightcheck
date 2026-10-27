export declare const CHECK_GROUPS: readonly ["meta", "icons", "social", "tracking", "stack", "security", "images", "a11y-static"];
export type CheckGroup = (typeof CHECK_GROUPS)[number];
export declare function resolveActiveGroups(opts: {
    only?: string;
    skip?: string;
}): Set<CheckGroup>;
//# sourceMappingURL=checkGroups.d.ts.map
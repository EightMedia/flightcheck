export type RobotsPolicy = {
    isAllowed: (url: string) => boolean;
};
export declare function loadRobotsPolicy(origin: string, timeoutMs: number): Promise<RobotsPolicy | null>;
//# sourceMappingURL=robots.d.ts.map
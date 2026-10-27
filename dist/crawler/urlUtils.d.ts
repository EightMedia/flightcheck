export declare function sleep(ms: number): Promise<void>;
/**
 * True for Vercel or Netlify platform default/preview hostnames.
 * Custom production domains mapped onto those platforms return false.
 */
export declare function isPlatformPreviewHostname(hostname: string): boolean;
export declare function isHttpUrl(urlString: string): boolean;
export declare function normalizeUrl(urlString: string): string;
export declare function resolveUrlMaybe(value: string, baseUrl: string): string;
export declare function parseExcludePatterns(rawExcludes: string[]): string[];
export declare function matchesExcludePattern(urlString: string, patterns: string[]): boolean;
//# sourceMappingURL=urlUtils.d.ts.map
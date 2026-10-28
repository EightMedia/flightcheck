/** Installed package version from package.json (works from src/ and dist/). */
export declare function getPackageVersion(): string;
/**
 * CLI flags as passed on the command line (everything after node + script path).
 * Example: `["https://example.com", "--quiet", "--max-pages", "50"]`
 */
export declare function cliFlagsFromArgv(argv?: string[]): string[];
export declare function formatCliFlags(flags: string[]): string;
//# sourceMappingURL=version.d.ts.map
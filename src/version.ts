import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** Installed package version from package.json (works from src/ and dist/). */
export function getPackageVersion(): string {
  try {
    const pkg = require("../package.json") as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * CLI flags as passed on the command line (everything after node + script path).
 * Example: `["https://example.com", "--quiet", "--max-pages", "50"]`
 */
export function cliFlagsFromArgv(argv: string[] = process.argv): string[] {
  return argv.slice(2);
}

export function formatCliFlags(flags: string[]): string {
  if (flags.length === 0) return "(defaults)";
  return flags.map((flag) => (/\s/.test(flag) ? JSON.stringify(flag) : flag)).join(" ");
}

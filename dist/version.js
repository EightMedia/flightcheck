import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
/** Installed package version from package.json (works from src/ and dist/). */
export function getPackageVersion() {
    try {
        const pkg = require("../package.json");
        return pkg.version ?? "unknown";
    }
    catch {
        return "unknown";
    }
}
/**
 * CLI flags as passed on the command line (everything after node + script path).
 * Example: `["https://example.com", "--quiet", "--max-pages", "50"]`
 */
export function cliFlagsFromArgv(argv = process.argv) {
    return argv.slice(2);
}
export function formatCliFlags(flags) {
    if (flags.length === 0)
        return "(defaults)";
    return flags.map((flag) => (/\s/.test(flag) ? JSON.stringify(flag) : flag)).join(" ");
}

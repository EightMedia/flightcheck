import { CHECK_DEFINITIONS, getCheckDefinition, listChecks, listImplementedChecks } from "./registry.js";
import { analyzeRedirect, resolveChecksForRedirect, type RedirectCheckResult } from "./redirect.js";
import { type CheckExecutionResult, type CheckId, type RunChecksOptions, type RunChecksResult } from "./types.js";
export declare function planCheckWaves(requestedChecks: CheckId[]): CheckId[][];
export declare function runCheck(id: CheckId, options: RunChecksOptions): Promise<CheckExecutionResult>;
export declare function probeStartUrlRedirect(startUrl: string): Promise<RedirectCheckResult>;
export declare function runChecks(options: RunChecksOptions): Promise<RunChecksResult>;
export { CHECK_DEFINITIONS, getCheckDefinition, listChecks, listImplementedChecks, analyzeRedirect, resolveChecksForRedirect };
//# sourceMappingURL=runner.d.ts.map
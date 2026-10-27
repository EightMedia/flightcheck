import { CHECK_IDS, type CheckDefinition, type CheckExecutionResult, type CheckId, type CheckRunContext } from "./types.js";
export { CHECK_IDS };
export declare const CHECK_DEFINITIONS: Record<CheckId, CheckDefinition>;
export declare function getCheckDefinition(id: CheckId): CheckDefinition;
export declare function listChecks(): CheckDefinition[];
export declare function listImplementedChecks(): CheckDefinition[];
export declare function runRegisteredCheck(context: CheckRunContext, id: CheckId): Promise<CheckExecutionResult>;
//# sourceMappingURL=registry.d.ts.map
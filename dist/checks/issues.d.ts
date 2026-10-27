export type CheckIssueSeverity = "critical" | "error" | "warning" | "review";
export type CheckIssue = {
    id: string;
    severity: CheckIssueSeverity;
    message: string;
};
export declare function issue(id: string, severity: CheckIssueSeverity, message: string): CheckIssue;
//# sourceMappingURL=issues.d.ts.map
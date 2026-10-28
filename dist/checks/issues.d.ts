export type CheckIssueSeverity = "critical" | "error" | "warning" | "review";
export type CheckIssue = {
    id: string;
    severity: CheckIssueSeverity;
    message: string;
    /** Concrete remediation suggestion for reports / agents. */
    fix?: string;
};
export declare function issue(id: string, severity: CheckIssueSeverity, message: string, fix?: string): CheckIssue;
//# sourceMappingURL=issues.d.ts.map
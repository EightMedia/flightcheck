export type CheckIssueSeverity = "critical" | "error" | "warning" | "review";

export type CheckIssue = {
  id: string;
  severity: CheckIssueSeverity;
  message: string;
};

export function issue(id: string, severity: CheckIssueSeverity, message: string): CheckIssue {
  return { id, severity, message };
}

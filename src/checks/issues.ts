export type CheckIssueSeverity = "critical" | "error" | "warning" | "review";

export type CheckIssue = {
  id: string;
  severity: CheckIssueSeverity;
  message: string;
  /** Concrete remediation suggestion for reports / agents. */
  fix?: string;
};

export function issue(
  id: string,
  severity: CheckIssueSeverity,
  message: string,
  fix?: string
): CheckIssue {
  return fix === undefined ? { id, severity, message } : { id, severity, message, fix };
}

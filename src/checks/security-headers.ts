import { issue, type CheckIssue } from "./issues.js";

export type AnalyzeSecurityHeadersOptions = {
  isHttps?: boolean;
};

function headerValue(headers: Headers, name: string): string | undefined {
  return headers.get(name) ?? undefined;
}

function hasFrameAncestorsCsp(csp: string | undefined): boolean {
  if (!csp) return false;
  return /frame-ancestors/i.test(csp);
}

export function analyzeSecurityHeaders(
  headers: Headers,
  options: AnalyzeSecurityHeadersOptions = {}
): CheckIssue[] {
  const isHttps = options.isHttps ?? true;
  const issues: CheckIssue[] = [];

  const hsts = headerValue(headers, "strict-transport-security");
  const csp = headerValue(headers, "content-security-policy");
  const xFrameOptions = headerValue(headers, "x-frame-options");
  const nosniff = headerValue(headers, "x-content-type-options");
  const referrerPolicy = headerValue(headers, "referrer-policy");
  const permissionsPolicy = headerValue(headers, "permissions-policy");

  if (isHttps && !hsts) {
    issues.push(
      issue(
        "missing-hsts",
        "error",
        "Strict-Transport-Security header is missing on HTTPS.",
        "Send `Strict-Transport-Security: max-age=31536000; includeSubDomains` on HTTPS responses (hosting or app headers)."
      )
    );
  }

  if (!csp) {
    issues.push(
      issue(
        "missing-csp",
        "warning",
        "Content-Security-Policy header is missing.",
        "Add a Content-Security-Policy header tailored to your app (start with report-only if needed)."
      )
    );
  }

  if (!xFrameOptions && !hasFrameAncestorsCsp(csp)) {
    issues.push(
      issue(
        "missing-clickjacking-protection",
        "warning",
        "Neither X-Frame-Options nor CSP frame-ancestors is set.",
        "Set `X-Frame-Options: DENY` (or SAMEORIGIN) or add `frame-ancestors` to your Content-Security-Policy."
      )
    );
  }

  if (!nosniff || nosniff.toLowerCase() !== "nosniff") {
    issues.push(
      issue(
        "missing-nosniff",
        "warning",
        "X-Content-Type-Options: nosniff is missing.",
        "Send `X-Content-Type-Options: nosniff` on all responses."
      )
    );
  }

  if (!referrerPolicy) {
    issues.push(
      issue(
        "missing-referrer-policy",
        "review",
        "Referrer-Policy header is missing.",
        "Send a Referrer-Policy such as `strict-origin-when-cross-origin`."
      )
    );
  }

  if (!permissionsPolicy) {
    issues.push(
      issue(
        "missing-permissions-policy",
        "review",
        "Permissions-Policy header is missing.",
        "Add a Permissions-Policy header that disables unused browser features (camera, mic, geolocation, …)."
      )
    );
  }

  return issues;
}

export type SecurityHeadersCheckResult = {
  url: string;
  headers: Record<string, string>;
  issues: CheckIssue[];
};

export async function runSecurityHeadersCheck(startUrl: string): Promise<SecurityHeadersCheckResult> {
  const url = new URL(startUrl);
  const response = await fetch(url.origin, { redirect: "follow" });
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const headerBag = new Headers(headers);
  const issues = analyzeSecurityHeaders(headerBag, { isHttps: url.protocol === "https:" });

  return {
    url: url.origin,
    headers,
    issues,
  };
}

import { describe, expect, it } from "vitest";
import { analyzeSecurityHeaders } from "./security-headers.js";

function headers(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe("analyzeSecurityHeaders", () => {
  it("flags missing HSTS as error on HTTPS origins", () => {
    const issues = analyzeSecurityHeaders(headers({}), { isHttps: true });

    expect(issues).toContainEqual(
      expect.objectContaining({
        id: "missing-hsts",
        severity: "error",
      })
    );
  });

  it("does not require HSTS on HTTP origins", () => {
    const issues = analyzeSecurityHeaders(headers({}), { isHttps: false });

    expect(issues.find((issue) => issue.id === "missing-hsts")).toBeUndefined();
  });

  it("flags missing Content-Security-Policy as warning", () => {
    const issues = analyzeSecurityHeaders(headers({}), { isHttps: true });

    expect(issues).toContainEqual(
      expect.objectContaining({
        id: "missing-csp",
        severity: "warning",
      })
    );
  });

  it("flags missing X-Frame-Options when CSP frame-ancestors is absent", () => {
    const issues = analyzeSecurityHeaders(headers({}), { isHttps: true });

    expect(issues).toContainEqual(
      expect.objectContaining({
        id: "missing-clickjacking-protection",
        severity: "warning",
      })
    );
  });

  it("accepts CSP frame-ancestors instead of X-Frame-Options", () => {
    const issues = analyzeSecurityHeaders(
      headers({
        "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
        "strict-transport-security": "max-age=31536000",
        "x-content-type-options": "nosniff",
      }),
      { isHttps: true }
    );

    expect(issues.find((issue) => issue.id === "missing-clickjacking-protection")).toBeUndefined();
  });

  it("flags missing X-Content-Type-Options as warning", () => {
    const issues = analyzeSecurityHeaders(
      headers({
        "strict-transport-security": "max-age=31536000",
      }),
      { isHttps: true }
    );

    expect(issues).toContainEqual(
      expect.objectContaining({
        id: "missing-nosniff",
        severity: "warning",
      })
    );
  });

  it("returns no issues when required headers are present", () => {
    const issues = analyzeSecurityHeaders(
      headers({
        "strict-transport-security": "max-age=31536000; includeSubDomains",
        "content-security-policy": "default-src 'self'",
        "x-frame-options": "DENY",
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
        "permissions-policy": "camera=()",
      }),
      { isHttps: true }
    );

    const blocking = issues.filter((issue) => issue.severity === "error" || issue.severity === "warning");
    expect(blocking).toHaveLength(0);
  });
});

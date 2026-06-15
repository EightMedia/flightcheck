import { describe, it, expect } from "vitest";
import { scanText, maskSecret } from "./secrets.js";

describe("maskSecret", () => {
  it("masks long values as first6…last4", () => {
    expect(maskSecret("AIzaSyBCb8P7RZHp0DcWeyhMr0ULIcqjCYEBC0Y")).toBe("AIzaSy…BC0Y");
  });
  it("masks short values as first2…last2", () => {
    expect(maskSecret("abcdef")).toBe("ab…ef");
  });
});

describe("scanText", () => {
  it("finds a Google API key as review severity, masked by default", () => {
    const findings = scanText(
      "var k='AIzaSyBCb8P7RZHp0DcWeyhMr0ULIcqjCYEBC0Y';",
      "html"
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      type: "google-api-key",
      provider: "google",
      severity: "review",
      masked: "AIzaSy…BC0Y",
      source: "html",
    });
  });

  it("finds an AWS access key as critical", () => {
    const findings = scanText("AKIAIOSFODNN7EXAMPLE", "app.js");
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      type: "aws-access-key-id",
      provider: "aws",
      severity: "critical",
      source: "app.js",
    });
  });

  it("reveals full values when reveal=true", () => {
    const key = "AIzaSyBCb8P7RZHp0DcWeyhMr0ULIcqjCYEBC0Y";
    const findings = scanText(`x="${key}"`, "html", true);
    expect(findings[0].masked).toBe(key);
  });

  it("dedupes the same key found twice", () => {
    const key = "AIzaSyBCb8P7RZHp0DcWeyhMr0ULIcqjCYEBC0Y";
    const findings = scanText(`${key} and again ${key}`, "html");
    expect(findings).toHaveLength(1);
  });

  it("does not double-report a specific key also matching a generic assignment", () => {
    const findings = scanText(
      `apiKey: "AIzaSyBCb8P7RZHp0DcWeyhMr0ULIcqjCYEBC0Y"`,
      "html"
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe("google-api-key");
  });

  it("produces no findings on clean text", () => {
    expect(scanText("<html><body>Hello world</body></html>", "html")).toHaveLength(0);
  });

  it("flags a private key block with a fixed placeholder, not a masked header", () => {
    const findings = scanText("-----BEGIN RSA PRIVATE KEY-----\nMIIE...", "app.js");
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      type: "private-key",
      provider: "generic",
      severity: "critical",
      masked: "[PRIVATE KEY BLOCK]",
      source: "app.js",
    });
  });
});

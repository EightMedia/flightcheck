import { describe, expect, it } from "vitest";
import type { CheckGroup } from "./checkGroups.js";
import { extractVerificationRecord } from "./extractors.js";

function withGroups(...groups: string[]): Set<CheckGroup> {
  return new Set(groups as CheckGroup[]);
}

describe("extractVerificationRecord main landmark", () => {
  it("counts a single main element", () => {
    const record = extractVerificationRecord(
      "<!doctype html><html><body><main>Content</main></body></html>",
      "https://example.com",
      200,
      "text/html"
    );
    expect(record.mainCount).toBe(1);
  });

  it("counts zero main elements", () => {
    const record = extractVerificationRecord(
      "<!doctype html><html><body><div>Content</div></body></html>",
      "https://example.com",
      200,
      "text/html"
    );
    expect(record.mainCount).toBe(0);
  });

  it("counts multiple main elements", () => {
    const record = extractVerificationRecord(
      "<!doctype html><html><body><main>One</main><main>Two</main></body></html>",
      "https://example.com",
      200,
      "text/html"
    );
    expect(record.mainCount).toBe(2);
  });

  it("leaves mainCount null when meta group is skipped", () => {
    const record = extractVerificationRecord(
      "<!doctype html><html><body><main>Content</main></body></html>",
      "https://example.com",
      200,
      "text/html",
      new Set(["social"])
    );
    expect(record.mainCount).toBeNull();
  });
});

describe("extractVerificationRecord images group", () => {
  it("flags images without an alt attribute", () => {
    const record = extractVerificationRecord(
      '<!doctype html><html><body><img src="/hero.jpg"></body></html>',
      "https://example.com",
      200,
      "text/html",
      withGroups("images")
    );

    expect(record.images).toEqual(
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({ id: "missing-alt", severity: "error" }),
        ]),
      })
    );
  });

  it("flags empty alt on non-decorative images", () => {
    const record = extractVerificationRecord(
      '<!doctype html><html><body><img src="/hero.jpg" alt=""></body></html>',
      "https://example.com",
      200,
      "text/html",
      withGroups("images")
    );

    expect(record.images).toEqual(
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({ id: "empty-alt", severity: "warning" }),
        ]),
      })
    );
  });

  it("ignores decorative images with aria-hidden", () => {
    const record = extractVerificationRecord(
      '<!doctype html><html><body><img src="/spacer.gif" aria-hidden="true"></body></html>',
      "https://example.com",
      200,
      "text/html",
      withGroups("images")
    );

    expect(record.images).toEqual({ issues: [] });
  });

  it("flags generic alt text", () => {
    const record = extractVerificationRecord(
      '<!doctype html><html><body><img src="/team.jpg" alt="image"></body></html>',
      "https://example.com",
      200,
      "text/html",
      withGroups("images")
    );

    expect(record.images).toEqual(
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({ id: "generic-alt", severity: "warning" }),
        ]),
      })
    );
  });
});

describe("extractVerificationRecord a11y-static group", () => {
  it("flags heading hierarchy skips", () => {
    const record = extractVerificationRecord(
      "<!doctype html><html lang=\"en\"><body><h1>Title</h1><h3>Skipped h2</h3></body></html>",
      "https://example.com",
      200,
      "text/html",
      withGroups("a11y-static")
    );

    expect(record.a11yStatic).toEqual(
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({ id: "heading-skip", severity: "warning" }),
        ]),
      })
    );
  });

  it("flags multiple h1 elements", () => {
    const record = extractVerificationRecord(
      "<!doctype html><html lang=\"en\"><body><h1>One</h1><h1>Two</h1></body></html>",
      "https://example.com",
      200,
      "text/html",
      withGroups("a11y-static")
    );

    expect(record.a11yStatic).toEqual(
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({ id: "multiple-h1", severity: "warning" }),
        ]),
      })
    );
  });

  it("flags form inputs without associated labels", () => {
    const record = extractVerificationRecord(
      '<!doctype html><html lang="en"><body><input type="email" name="email"></body></html>',
      "https://example.com",
      200,
      "text/html",
      withGroups("a11y-static")
    );

    expect(record.a11yStatic).toEqual(
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({ id: "unlabeled-input", severity: "error" }),
        ]),
      })
    );
  });

  it("flags missing lang on html", () => {
    const record = extractVerificationRecord(
      "<!doctype html><html><body><h1>Title</h1></body></html>",
      "https://example.com",
      200,
      "text/html",
      withGroups("a11y-static")
    );

    expect(record.a11yStatic).toEqual(
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({ id: "missing-lang", severity: "error" }),
        ]),
      })
    );
  });

  it("flags positive tabindex values", () => {
    const record = extractVerificationRecord(
      '<!doctype html><html lang="en"><body><button tabindex="5">Go</button></body></html>',
      "https://example.com",
      200,
      "text/html",
      withGroups("a11y-static")
    );

    expect(record.a11yStatic).toEqual(
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({ id: "positive-tabindex", severity: "warning" }),
        ]),
      })
    );
  });
});

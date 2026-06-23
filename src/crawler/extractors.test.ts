import { describe, expect, it } from "vitest";
import type { CheckGroup } from "./checkGroups.js";
import { extractVerificationRecord } from "./extractors.js";

function withGroups(...groups: string[]): Set<CheckGroup> {
  return new Set(groups as CheckGroup[]);
}

function imageLink(filename: string, url: string): string {
  return `([${filename}](${url}))`;
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
          expect.objectContaining({
            id: "missing-alt",
            severity: "error",
            message: `Image is missing an alt attribute. ${imageLink("hero.jpg", "https://example.com/hero.jpg")}`,
          }),
        ]),
      })
    );
  });

  it("includes a single filename from srcset and picture sources", () => {
    const record = extractVerificationRecord(
      `<!doctype html><html><body>
        <img srcset="/responsive-480.jpg 480w, /responsive-800.jpg 800w">
        <picture>
          <source srcset="/hero.webp" type="image/webp">
          <img src="/hero.jpg">
        </picture>
      </body></html>`,
      "https://example.com",
      200,
      "text/html",
      withGroups("images")
    );

    expect(record.images?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "missing-alt",
          message: `Image is missing an alt attribute. ${imageLink("responsive-480.jpg", "https://example.com/responsive-480.jpg")}`,
        }),
        expect.objectContaining({
          id: "missing-alt",
          message: `Image is missing an alt attribute. ${imageLink("hero.jpg", "https://example.com/hero.jpg")}`,
        }),
      ])
    );
  });

  it("extracts one filename from srcset with commas in query params", () => {
    const record = extractVerificationRecord(
      `<!doctype html><html><body><img alt="" srcset="https://cdn.sanity.io/images/project/production/4ed48727d6fc4e99b5e71625efc57e1d52b88e53-3840x2160.jpg?rect=0,1620,2160,3840&w=768&h=1024&fm=webp&q=40&dpr=2 768w, https://cdn.sanity.io/images/project/production/4ed48727d6fc4e99b5e71625efc57e1d52b88e53-3840x2160.jpg?w=345&h=690&fm=webp&q=80 345w"></body></html>`,
      "https://example.com",
      200,
      "text/html",
      withGroups("images")
    );

    expect(record.images?.issues).toEqual([
      expect.objectContaining({
        id: "empty-alt",
        message: `Image has an empty alt attribute. ${imageLink(
          "4ed48727d6fc4e99b5e71625efc57e1d52b88e53-3840x2160.jpg",
          "https://cdn.sanity.io/images/project/production/4ed48727d6fc4e99b5e71625efc57e1d52b88e53-3840x2160.jpg?rect=0,1620,2160,3840&w=768&h=1024&fm=webp&q=40&dpr=2"
        )}`,
      }),
    ]);
  });

  it("extracts filename from url-encoded sanity src values", () => {
    const encoded =
      "https%3A%2F%2Fcdn.sanity.io%2Fimages%2Ftble4w97%2Fproduction%2Fb512b2eac8e0a689ac8622eca96dc557fda91497-5328x3150.jpg";
    const record = extractVerificationRecord(
      `<!doctype html><html><body><img src="${encoded}"></body></html>`,
      "https://example.com",
      200,
      "text/html",
      withGroups("images")
    );

    expect(record.images?.issues).toEqual([
      expect.objectContaining({
        id: "missing-alt",
        message: `Image is missing an alt attribute. ${imageLink(
          "b512b2eac8e0a689ac8622eca96dc557fda91497-5328x3150.jpg",
          "https://cdn.sanity.io/images/tble4w97/production/b512b2eac8e0a689ac8622eca96dc557fda91497-5328x3150.jpg"
        )}`,
      }),
    ]);
  });

  it("extracts filename from next/image proxy src values", () => {
    const src =
      "/_next/image?url=https%3A%2F%2Fcdn.sanity.io%2Fimages%2Ftble4w97%2Fproduction%2Fb512b2eac8e0a689ac8622eca96dc557fda91497-5328x3150.jpg&w=3840&q=75";
    const record = extractVerificationRecord(
      `<!doctype html><html><body><img src="${src}"></body></html>`,
      "https://example.com",
      200,
      "text/html",
      withGroups("images")
    );

    expect(record.images?.issues).toEqual([
      expect.objectContaining({
        id: "missing-alt",
        message: `Image is missing an alt attribute. ${imageLink(
          "b512b2eac8e0a689ac8622eca96dc557fda91497-5328x3150.jpg",
          "https://cdn.sanity.io/images/tble4w97/production/b512b2eac8e0a689ac8622eca96dc557fda91497-5328x3150.jpg"
        )}`,
      }),
    ]);
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

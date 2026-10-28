import { describe, expect, it } from "vitest";
import { cliFlagsFromArgv, formatCliFlags, getPackageVersion } from "../src/version.js";

describe("version helpers", () => {
  it("reads the package version", () => {
    expect(getPackageVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("extracts CLI flags from argv", () => {
    expect(cliFlagsFromArgv(["node", "cli.js", "https://example.com", "--quiet"])).toEqual([
      "https://example.com",
      "--quiet",
    ]);
  });

  it("formats flags for Markdown", () => {
    expect(formatCliFlags([])).toBe("(defaults)");
    expect(formatCliFlags(["https://example.com", "--max-pages", "10"])).toBe(
      "https://example.com --max-pages 10"
    );
  });
});

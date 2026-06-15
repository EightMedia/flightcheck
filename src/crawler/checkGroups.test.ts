import { describe, it, expect } from "vitest";
import { resolveActiveGroups, CHECK_GROUPS } from "./checkGroups.js";

describe("resolveActiveGroups", () => {
  it("activates all groups when no flags given", () => {
    const active = resolveActiveGroups({});
    expect(active.size).toBe(CHECK_GROUPS.length);
    expect(active.has("security")).toBe(true);
  });

  it("--only selects just the listed groups", () => {
    const active = resolveActiveGroups({ only: "security" });
    expect([...active]).toEqual(["security"]);
  });

  it("--skip removes the listed groups", () => {
    const active = resolveActiveGroups({ skip: "tracking,social" });
    expect(active.has("tracking")).toBe(false);
    expect(active.has("social")).toBe(false);
    expect(active.has("meta")).toBe(true);
  });

  it("throws when both --only and --skip are given", () => {
    expect(() => resolveActiveGroups({ only: "meta", skip: "icons" })).toThrow(/mutually exclusive/i);
  });

  it("throws on an unknown group name", () => {
    expect(() => resolveActiveGroups({ only: "bogus" })).toThrow(/bogus/);
  });
});

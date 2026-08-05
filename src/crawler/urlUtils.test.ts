import { describe, expect, it } from "vitest";
import { isPlatformPreviewHostname } from "./urlUtils.js";

describe("isPlatformPreviewHostname", () => {
  it("detects Vercel platform hostnames", () => {
    expect(isPlatformPreviewHostname("staywoud.vercel.app")).toBe(true);
    expect(isPlatformPreviewHostname("project-git-development-team.vercel.app")).toBe(true);
    expect(isPlatformPreviewHostname("vercel.app")).toBe(true);
  });

  it("detects Netlify platform hostnames", () => {
    expect(isPlatformPreviewHostname("my-site.netlify.app")).toBe(true);
    expect(isPlatformPreviewHostname("netlify.app")).toBe(true);
  });

  it("ignores custom domains even when hosted on those platforms", () => {
    expect(isPlatformPreviewHostname("example.com")).toBe(false);
    expect(isPlatformPreviewHostname("www.example.com")).toBe(false);
    expect(isPlatformPreviewHostname("vercel.app.example.com")).toBe(false);
    expect(isPlatformPreviewHostname("notvercel.app")).toBe(false);
  });
});

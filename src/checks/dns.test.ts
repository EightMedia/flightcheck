import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as dns from "node:dns";
import { analyzeDnsRecords } from "./dns.js";

describe("analyzeDnsRecords", () => {
  beforeEach(() => {
    vi.spyOn(dns.promises, "resolve4").mockResolvedValue(["93.184.216.34"]);
    vi.spyOn(dns.promises, "resolve6").mockResolvedValue([]);
    vi.spyOn(dns.promises, "resolveCname").mockRejectedValue(Object.assign(new Error("ENODATA"), { code: "ENODATA" }));
    vi.spyOn(dns.promises, "resolveMx").mockResolvedValue([{ exchange: "mail.example.com", priority: 10 }]);
    vi.spyOn(dns.promises, "resolveTxt").mockResolvedValue([
      ["v=spf1 include:_spf.example.com ~all"],
      ["v=DMARC1; p=reject; rua=mailto:dmarc@example.com"],
    ]);
    vi.spyOn(dns.promises, "resolveNs").mockResolvedValue(["ns1.example.com", "ns2.example.com"]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves A records for the hostname", async () => {
    const result = await analyzeDnsRecords("example.com");

    expect(result.hostname).toBe("example.com");
    expect(result.records.a).toEqual(["93.184.216.34"]);
    expect(dns.promises.resolve4).toHaveBeenCalledWith("example.com");
  });

  it("collects MX records", async () => {
    const result = await analyzeDnsRecords("example.com");

    expect(result.records.mx).toEqual([{ exchange: "mail.example.com", priority: 10 }]);
  });

  it("detects SPF and DMARC from TXT records", async () => {
    const result = await analyzeDnsRecords("example.com");

    expect(result.mail.spf).toContain("v=spf1");
    expect(result.mail.dmarc).toContain("v=DMARC1");
  });

  it("flags missing SPF as warning", async () => {
    vi.spyOn(dns.promises, "resolveTxt").mockResolvedValue([["google-site-verification=abc"]]);

    const result = await analyzeDnsRecords("example.com");

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        id: "missing-spf",
        severity: "warning",
      })
    );
  });

  it("flags missing DMARC as warning", async () => {
    vi.spyOn(dns.promises, "resolveTxt").mockResolvedValue([["v=spf1 include:_spf.example.com ~all"]]);

    const result = await analyzeDnsRecords("example.com");

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        id: "missing-dmarc",
        severity: "warning",
      })
    );
  });

  it("skips SPF and DMARC warnings on Vercel and Netlify preview domains", async () => {
    vi.spyOn(dns.promises, "resolveTxt").mockResolvedValue([["google-site-verification=abc"]]);

    const vercel = await analyzeDnsRecords("https://staywoud.vercel.app/");
    const netlify = await analyzeDnsRecords("https://my-site.netlify.app/");

    expect(vercel.issues.find((entry) => entry.id === "missing-spf")).toBeUndefined();
    expect(vercel.issues.find((entry) => entry.id === "missing-dmarc")).toBeUndefined();
    expect(netlify.issues.find((entry) => entry.id === "missing-spf")).toBeUndefined();
    expect(netlify.issues.find((entry) => entry.id === "missing-dmarc")).toBeUndefined();
  });

  it("extracts hostname from a full URL", async () => {
    await analyzeDnsRecords("https://www.example.com/path");

    expect(dns.promises.resolve4).toHaveBeenCalledWith("www.example.com");
  });
});

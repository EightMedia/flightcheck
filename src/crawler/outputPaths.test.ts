import { describe, expect, it } from "vitest";
import {
  buildDefaultOutputPaths,
  defaultAgentJobsPathForInput,
  defaultManifestPathForInput,
  defaultReportJsonPathForInput,
  defaultReportPathForInput,
  formatRunTimestamp,
  hostnameFromUrl,
} from "./outputPaths.js";

describe("formatRunTimestamp", () => {
  it("formats date as YYYYMMDD.HHmm", () => {
    expect(formatRunTimestamp(new Date("2026-06-18T14:13:00"))).toBe("20260618.1413");
  });
});

describe("hostnameFromUrl", () => {
  it("strips www prefix", () => {
    expect(hostnameFromUrl("https://www.eight.nl/page")).toBe("eight.nl");
  });

  it("keeps hostname without www", () => {
    expect(hostnameFromUrl("https://eight.nl")).toBe("eight.nl");
  });
});

describe("buildDefaultOutputPaths", () => {
  it("builds timestamped raw json, report md and report json paths", () => {
    const now = new Date("2026-06-18T14:13:00");
    expect(buildDefaultOutputPaths("https://eight.nl", now)).toEqual({
      rawJson: "./flightcheck/20260618.1413-eight.nl-raw.json",
      reportMd: "./flightcheck/20260618.1413-eight.nl-report.md",
      reportJson: "./flightcheck/20260618.1413-eight.nl-report.json",
    });
  });
});

describe("defaultReportPathForInput", () => {
  it("replaces -raw.json suffix", () => {
    expect(defaultReportPathForInput("./flightcheck/20260618.1413-eight.nl-raw.json")).toBe(
      "./flightcheck/20260618.1413-eight.nl-report.md"
    );
  });

  it("replaces generic .json suffix", () => {
    expect(defaultReportPathForInput("./flightcheck/report.json")).toBe("./flightcheck/report-report.md");
  });
});

describe("defaultReportJsonPathForInput", () => {
  it("replaces -raw.json suffix", () => {
    expect(defaultReportJsonPathForInput("./flightcheck/20260618.1413-eight.nl-raw.json")).toBe(
      "./flightcheck/20260618.1413-eight.nl-report.json"
    );
  });
});

describe("defaultManifestPathForInput", () => {
  it("still resolves a deprecated fix-manifest path from -raw.json", () => {
    expect(defaultManifestPathForInput("./flightcheck/20260618.1413-eight.nl-raw.json")).toBe(
      "./flightcheck/20260618.1413-eight.nl-fix-manifest.json"
    );
  });
});

describe("defaultAgentJobsPathForInput", () => {
  it("still resolves a deprecated agent-jobs path from -raw.json", () => {
    expect(defaultAgentJobsPathForInput("./flightcheck/20260618.1413-eight.nl-raw.json")).toBe(
      "./flightcheck/20260618.1413-eight.nl-agent-jobs"
    );
  });
});

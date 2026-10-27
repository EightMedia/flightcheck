import { DEFAULT_OUTPUT_DIR } from "./defaults.js";

export function formatRunTimestamp(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}.${pad(date.getHours())}${pad(date.getMinutes())}`;
}

export function hostnameFromUrl(url: string): string {
  const hostname = new URL(url).hostname;
  return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
}

export function buildDefaultOutputPaths(
  startUrl: string,
  now = new Date()
): { rawJson: string; reportMd: string; reportJson: string } {
  const stamp = formatRunTimestamp(now);
  const host = hostnameFromUrl(startUrl);
  const base = `${stamp}-${host}`;
  return {
    rawJson: `${DEFAULT_OUTPUT_DIR}/${base}-raw.json`,
    reportMd: `${DEFAULT_OUTPUT_DIR}/${base}-report.md`,
    reportJson: `${DEFAULT_OUTPUT_DIR}/${base}-report.json`,
  };
}

function reportBasename(inputPath: string): string {
  if (inputPath.endsWith("-raw.json")) {
    return inputPath.slice(0, -"-raw.json".length);
  }
  if (inputPath.endsWith("-report.md")) {
    return inputPath.slice(0, -"-report.md".length);
  }
  if (inputPath.endsWith("-report.json")) {
    return inputPath.slice(0, -"-report.json".length);
  }
  if (inputPath.endsWith("-fix-manifest.json")) {
    return inputPath.slice(0, -"-fix-manifest.json".length);
  }
  if (inputPath.endsWith(".json")) {
    return inputPath.slice(0, -".json".length);
  }
  return inputPath;
}

export function defaultReportPathForInput(inputPath: string): string {
  return `${reportBasename(inputPath)}-report.md`;
}

export function defaultReportJsonPathForInput(inputPath: string): string {
  return `${reportBasename(inputPath)}-report.json`;
}

/** @deprecated Fix-manifest output is removed; kept for callers that still resolve paths. */
export function defaultManifestPathForInput(inputPath: string): string {
  return `${reportBasename(inputPath)}-fix-manifest.json`;
}

/** @deprecated Agent-jobs output is removed; kept for callers that still resolve paths. */
export function defaultAgentJobsPathForInput(inputPath: string): string {
  return `${reportBasename(inputPath)}-agent-jobs`;
}

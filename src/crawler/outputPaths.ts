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
): { rawJson: string; reportMd: string } {
  const stamp = formatRunTimestamp(now);
  const host = hostnameFromUrl(startUrl);
  const base = `${stamp}-${host}`;
  return {
    rawJson: `${DEFAULT_OUTPUT_DIR}/${base}-raw.json`,
    reportMd: `${DEFAULT_OUTPUT_DIR}/${base}-report.md`,
  };
}

export function defaultReportPathForInput(inputPath: string): string {
  if (inputPath.endsWith("-raw.json")) {
    return `${inputPath.slice(0, -"-raw.json".length)}-report.md`;
  }
  if (inputPath.endsWith(".json")) {
    return `${inputPath.slice(0, -".json".length)}-report.md`;
  }
  return `${inputPath}-report.md`;
}

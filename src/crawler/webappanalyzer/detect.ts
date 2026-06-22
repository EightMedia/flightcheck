import * as cheerio from "cheerio";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAnalyzeItemsFromDns,
  buildAnalyzeItemsFromHeaders,
  buildAnalyzeItemsFromHtml,
  buildAnalyzeItemsFromRobots,
} from "./buildItems.js";
import { analyzeWithIndex, createTechnologyIndex, type TechnologyIndex } from "./engine.js";

export type { ResolvedTechnology };

let cachedIndex: TechnologyIndex | null = null;

const dataDirCandidates = [
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "data", "webappanalyzer"),
  path.join(process.cwd(), "data", "webappanalyzer"),
];

async function resolveDataDir(): Promise<string> {
  for (const candidate of dataDirCandidates) {
    try {
      await readFile(path.join(candidate, "categories.json"), "utf8");
      return candidate;
    } catch {
      // try next candidate
    }
  }

  throw new Error("webappanalyzer fingerprint data not found. Run: pnpm run sync:webappanalyzer");
}

export async function loadTechnologyIndex(): Promise<TechnologyIndex> {
  if (cachedIndex) return cachedIndex;

  const dataDir = await resolveDataDir();
  const [categoriesRaw, technologiesRaw] = await Promise.all([
    readFile(path.join(dataDir, "categories.json"), "utf8"),
    readFile(path.join(dataDir, "technologies.json"), "utf8"),
  ]);

  cachedIndex = createTechnologyIndex(JSON.parse(technologiesRaw), JSON.parse(categoriesRaw));
  return cachedIndex;
}

export function resetTechnologyIndexCache(): void {
  cachedIndex = null;
}

function toStackConfidence(score: number): "high" | "medium" | "low" {
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
}

export type StackDetection = {
  name: string;
  categories: string[];
  confidence: "high" | "medium" | "low";
  evidence: string[];
  website?: string;
  version?: string;
};

function mapResolved(resolved: ResolvedTechnology[]): StackDetection[] {
  return resolved
    .filter((item) => item.confidence >= 50)
    .map((item) => ({
      name: item.name,
      categories: item.categories.map((category) => category.name),
      confidence: toStackConfidence(item.confidence),
      evidence: item.evidence,
      website: item.website ?? undefined,
      version: item.version || undefined,
    }));
}

export async function detectStackFromHtml(html: string, pageUrl: string): Promise<StackDetection[]> {
  if (!html.trim()) return [];
  const index = await loadTechnologyIndex();
  const items = buildAnalyzeItemsFromHtml(html, pageUrl);
  const $ = cheerio.load(html);
  return mapResolved(analyzeWithIndex(index, items, $));
}

export async function detectStackFromHeaders(headers: Record<string, string>): Promise<StackDetection[]> {
  const index = await loadTechnologyIndex();
  return mapResolved(analyzeWithIndex(index, buildAnalyzeItemsFromHeaders(headers)));
}

export async function detectStackFromDns(records: {
  cname: string[];
  ns: string[];
  mx: Array<{ exchange: string }>;
  txt: string[];
}): Promise<StackDetection[]> {
  const index = await loadTechnologyIndex();
  return mapResolved(analyzeWithIndex(index, buildAnalyzeItemsFromDns(records)));
}

export async function detectStackFromRobots(body: string): Promise<StackDetection[]> {
  if (!body.trim()) return [];
  const index = await loadTechnologyIndex();
  return mapResolved(analyzeWithIndex(index, buildAnalyzeItemsFromRobots(body)));
}

import type { ResolvedTechnology } from "./types.js";

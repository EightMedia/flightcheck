import * as cheerio from "cheerio";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAnalyzeItemsFromDns, buildAnalyzeItemsFromHeaders, buildAnalyzeItemsFromHtml, buildAnalyzeItemsFromRobots, } from "./buildItems.js";
import { analyzeWithIndex, createTechnologyIndex } from "./engine.js";
let cachedIndex = null;
const dataDirCandidates = [
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "data", "webappanalyzer"),
    path.join(process.cwd(), "data", "webappanalyzer"),
];
async function resolveDataDir() {
    for (const candidate of dataDirCandidates) {
        try {
            await readFile(path.join(candidate, "categories.json"), "utf8");
            return candidate;
        }
        catch {
            // try next candidate
        }
    }
    throw new Error("webappanalyzer fingerprint data not found. Run: pnpm run sync:webappanalyzer");
}
export async function loadTechnologyIndex() {
    if (cachedIndex)
        return cachedIndex;
    const dataDir = await resolveDataDir();
    const [categoriesRaw, technologiesRaw] = await Promise.all([
        readFile(path.join(dataDir, "categories.json"), "utf8"),
        readFile(path.join(dataDir, "technologies.json"), "utf8"),
    ]);
    cachedIndex = createTechnologyIndex(JSON.parse(technologiesRaw), JSON.parse(categoriesRaw));
    return cachedIndex;
}
export function resetTechnologyIndexCache() {
    cachedIndex = null;
}
function toStackConfidence(score) {
    if (score >= 80)
        return "high";
    if (score >= 50)
        return "medium";
    return "low";
}
function mapResolved(resolved) {
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
export async function detectStackFromHtml(html, pageUrl) {
    if (!html.trim())
        return [];
    const index = await loadTechnologyIndex();
    const items = buildAnalyzeItemsFromHtml(html, pageUrl);
    const $ = cheerio.load(html);
    return mapResolved(analyzeWithIndex(index, items, $));
}
export async function detectStackFromHeaders(headers) {
    const index = await loadTechnologyIndex();
    return mapResolved(analyzeWithIndex(index, buildAnalyzeItemsFromHeaders(headers)));
}
export async function detectStackFromDns(records) {
    const index = await loadTechnologyIndex();
    return mapResolved(analyzeWithIndex(index, buildAnalyzeItemsFromDns(records)));
}
export async function detectStackFromRobots(body) {
    if (!body.trim())
        return [];
    const index = await loadTechnologyIndex();
    return mapResolved(analyzeWithIndex(index, buildAnalyzeItemsFromRobots(body)));
}

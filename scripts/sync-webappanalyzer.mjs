#!/usr/bin/env node
/**
 * Downloads and merges enthec/webappanalyzer fingerprint data.
 * Flightcheck is GPL-3.0 — see repository root LICENSE.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "data", "webappanalyzer");
const baseUrl = "https://raw.githubusercontent.com/enthec/webappanalyzer/main/src";

const technologyFiles = "abcdefghijklmnopqrstuvwxyz_.".split("");

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const categories = await fetchJson(`${baseUrl}/categories.json`);
  const technologies = {};

  for (const file of technologyFiles) {
    const url = `${baseUrl}/technologies/${file}.json`;
    const response = await fetch(url);
    if (!response.ok) continue;
    const chunk = await response.json();
    Object.assign(technologies, chunk);
  }

  const count = Object.keys(technologies).length;
  if (count < 1000) {
    throw new Error(`Expected thousands of technologies, got ${count}`);
  }

  await writeFile(path.join(outDir, "categories.json"), `${JSON.stringify(categories, null, 2)}\n`);
  await writeFile(path.join(outDir, "technologies.json"), `${JSON.stringify(technologies)}\n`);

  const license = `Technology fingerprints derived from enthec/webappanalyzer:
https://github.com/enthec/webappanalyzer

Flightcheck is licensed under GPL-3.0. See the repository root LICENSE file.

Sync with: pnpm run sync:webappanalyzer
Technology count: ${count}
`;

  await writeFile(path.join(outDir, "LICENSE"), license);
  console.log(`Synced ${count} technologies to ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

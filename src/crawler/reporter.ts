import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { VerificationRecord } from "./schema.js";

function ensureParentDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

export function writeReportToFile(records: VerificationRecord[], outputPath: string): void {
  ensureParentDir(outputPath);
  const tempPath = `${outputPath}.tmp`;
  const json = JSON.stringify(records, null, 2) + "\n";
  writeFileSync(tempPath, json, "utf8");
  renameSync(tempPath, outputPath);
}

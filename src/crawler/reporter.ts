import { renameSync, writeFileSync } from "node:fs";
import type { VerificationRecord } from "./schema.js";

export function writeReportToFile(records: VerificationRecord[], outputPath: string): void {
  const tempPath = `${outputPath}.tmp`;
  const json = JSON.stringify(records, null, 2) + "\n";
  writeFileSync(tempPath, json, "utf8");
  renameSync(tempPath, outputPath);
}

import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
function ensureParentDir(filePath) {
    mkdirSync(dirname(filePath), { recursive: true });
}
export function writeReportToFile(records, outputPath) {
    ensureParentDir(outputPath);
    const tempPath = `${outputPath}.tmp`;
    const json = JSON.stringify(records, null, 2) + "\n";
    writeFileSync(tempPath, json, "utf8");
    renameSync(tempPath, outputPath);
}

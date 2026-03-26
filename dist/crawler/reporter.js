import { renameSync, writeFileSync } from "node:fs";
export function writeReportToFile(records, outputPath) {
    const tempPath = `${outputPath}.tmp`;
    const json = JSON.stringify(records, null, 2) + "\n";
    writeFileSync(tempPath, json, "utf8");
    renameSync(tempPath, outputPath);
}

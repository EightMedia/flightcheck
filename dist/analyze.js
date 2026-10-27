#!/usr/bin/env node
import { basename, resolve } from "node:path";
import { Command } from "commander";
import { runAnalyzeCheck } from "./checks/analyze.js";
import { defaultReportPathForInput } from "./crawler/outputPaths.js";
async function main() {
    const sanitizedArgv = [...process.argv];
    const separatorIndex = sanitizedArgv.indexOf("--");
    if (separatorIndex >= 2) {
        sanitizedArgv.splice(separatorIndex, 1);
    }
    const program = new Command();
    program
        .name("flightcheck-analyze")
        .description("Analyze crawl JSON and generate structured JSON + Markdown reports.")
        .argument("<input>", "Input JSON report file path")
        .option("--output <file>", "Output Markdown file path")
        .option("--errors-only", "Include only critical/error findings in the Markdown report", false)
        .action(async (input, options) => {
        const inputPath = resolve(input);
        const result = await runAnalyzeCheck({
            inputPath,
            reportPath: resolve(options.output ?? defaultReportPathForInput(inputPath)),
            errorsOnly: options.errorsOnly,
        });
        process.stdout.write(`${JSON.stringify({
            message: "Report generated",
            input: basename(result.inputPath),
            report: result.reportPath,
            reportJson: result.reportJsonPath,
            pagesAnalyzed: result.pagesAnalyzed,
            findings: result.report.findings.length,
        }, null, 2)}\n`);
    });
    await program.parseAsync(sanitizedArgv);
}
main().catch((error) => {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
});

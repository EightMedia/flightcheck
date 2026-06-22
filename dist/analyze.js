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
        .description("Analyze crawl JSON and generate a Markdown TODO report.")
        .argument("<input>", "Input JSON report file path")
        .option("--output <file>", "Output Markdown file path")
        .option("--errors-only", "Include only records with errors or missing attributes", false)
        .action(async (input, options) => {
        const inputPath = resolve(input);
        const result = await runAnalyzeCheck({
            inputPath,
            reportPath: resolve(options.output ?? defaultReportPathForInput(inputPath)),
            errorsOnly: options.errorsOnly,
        });
        process.stdout.write(`${JSON.stringify({
            message: "TODO report generated",
            input: basename(result.inputPath),
            output: result.reportPath,
            pagesAnalyzed: result.pagesAnalyzed,
        }, null, 2)}\n`);
    });
    await program.parseAsync(sanitizedArgv);
}
main().catch((error) => {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
});

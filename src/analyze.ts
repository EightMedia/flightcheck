#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { Command } from "commander";
import { z } from "zod";

const iconSchema = z.object({
  rel: z.string(),
  href: z.string(),
  type: z.string(),
  sizes: z.string(),
  media: z.string(),
});

const trackingItemSchema = z.object({
  provider: z.string(),
  id: z.string(),
});

const recordSchema = z.object({
  url: z.string(),
  status: z.number().nullable(),
  h1: z.string(),
  title: z.string(),
  metaTitle: z.string(),
  metaDescription: z.string(),
  robots: z.string(),
  charset: z.string(),
  language: z.string(),
  colorScheme: z.string(),
  themeColor: z.string(),
  doctype: z.string(),
  viewport: z.string(),
  canonical: z.string(),
  favicon: z.string(),
  icons: z.array(iconSchema),
  og: z.object({
    title: z.string(),
    description: z.string(),
    image: z.string(),
    url: z.string(),
    type: z.string(),
    siteName: z.string(),
  }),
  twitter: z.object({
    card: z.string(),
    title: z.string(),
    description: z.string(),
    image: z.string(),
  }),
  tracking: z.object({
    tagManager: z.array(trackingItemSchema),
    analytics: z.array(trackingItemSchema),
  }),
  note: z.string().optional(),
  error: z.string().optional(),
});

const reportSchema = z.array(recordSchema);

type RecordType = z.infer<typeof recordSchema>;

const fieldSelectors: Array<{ label: string; get: (record: RecordType) => string | string[] }> = [
  { label: "h1", get: (r) => r.h1 },
  { label: "title", get: (r) => r.title },
  { label: "metaTitle", get: (r) => r.metaTitle },
  { label: "metaDescription", get: (r) => r.metaDescription },
  { label: "robots", get: (r) => r.robots },
  { label: "charset", get: (r) => r.charset },
  { label: "language", get: (r) => r.language },
  { label: "colorScheme", get: (r) => r.colorScheme },
  { label: "themeColor", get: (r) => r.themeColor },
  { label: "doctype", get: (r) => r.doctype },
  { label: "viewport", get: (r) => r.viewport },
  { label: "canonical", get: (r) => r.canonical },
  { label: "favicon", get: (r) => r.favicon },
  { label: "og.title", get: (r) => r.og.title },
  { label: "og.description", get: (r) => r.og.description },
  { label: "og.image", get: (r) => r.og.image },
  { label: "og.url", get: (r) => r.og.url },
  { label: "og.type", get: (r) => r.og.type },
  { label: "og.siteName", get: (r) => r.og.siteName },
  { label: "twitter.card", get: (r) => r.twitter.card },
  { label: "twitter.title", get: (r) => r.twitter.title },
  { label: "twitter.description", get: (r) => r.twitter.description },
  { label: "twitter.image", get: (r) => r.twitter.image },
  { label: "icons", get: (r) => (r.icons.length > 0 ? ["present"] : []) },
];

function isMissingValue(value: string | string[]): boolean {
  if (Array.isArray(value)) return value.length === 0;
  return value.trim() === "";
}

function buildMarkdown(inputPath: string, records: RecordType[], includeOnlyErrors: boolean): string {
  const perFieldMissingCount = new Map<string, number>();
  const perUrlTodos: Array<{
    url: string;
    status: number | null;
    missingFields: string[];
    note?: string;
    error?: string;
  }> = [];

  for (const record of records) {
    const missingFields = fieldSelectors
      .filter((selector) => isMissingValue(selector.get(record)))
      .map((selector) => selector.label);

    if (record.error) {
      missingFields.unshift("fetch");
    }

    if (includeOnlyErrors && !record.error && missingFields.length === 0) {
      continue;
    }

    for (const field of missingFields) {
      perFieldMissingCount.set(field, (perFieldMissingCount.get(field) ?? 0) + 1);
    }

    perUrlTodos.push({
      url: record.url,
      status: record.status,
      missingFields,
      note: record.note,
      error: record.error,
    });
  }

  const sortedFieldCounts = [...perFieldMissingCount.entries()].sort((a, b) => b[1] - a[1]);
  const now = new Date().toISOString();

  const lines: string[] = [
    "# Flightcheck TODO Report",
    "",
    `Generated: ${now}`,
    `Input: \`${inputPath}\``,
    `Pages analyzed: ${records.length}`,
    `Pages with TODOs: ${perUrlTodos.length}`,
    "",
    "## Priority overview",
    "",
  ];

  if (sortedFieldCounts.length === 0) {
    lines.push("- No missing attributes found.");
  } else {
    for (const [field, count] of sortedFieldCounts) {
      lines.push(`- [ ] ${field}: missing on ${count} page(s)`);
    }
  }

  lines.push("", "## Page-level TODO list", "");

  if (perUrlTodos.length === 0) {
    lines.push("- No page-level TODOs found.");
  } else {
    for (const item of perUrlTodos) {
      const statusValue = item.status === null ? "error" : String(item.status);
      lines.push(`### ${item.url}`);
      lines.push("");
      lines.push(`- Status: \`${statusValue}\``);
      if (item.note) lines.push(`- Note: ${item.note}`);
      if (item.error) lines.push(`- Error: ${item.error}`);
      if (item.missingFields.length === 0) {
        lines.push("- [ ] Review manually");
      } else {
        lines.push(`- [ ] Fix missing attributes: ${item.missingFields.join(", ")}`);
      }
      lines.push("");
    }
  }

  lines.push("## Suggested workflow", "");
  lines.push("- [ ] Fix high-frequency fields first from the priority overview.");
  lines.push("- [ ] Re-run crawl and analyze scripts.");
  lines.push("- [ ] Confirm TODO count decreases to zero for target pages.");
  lines.push("");

  return lines.join("\n");
}

async function main(): Promise<void> {
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
    .option("--output <file>", "Output Markdown file path", "./todo-report.md")
    .option("--errors-only", "Include only records with errors or missing attributes", false)
    .action((input: string, options: { output: string; errorsOnly: boolean }) => {
      const inputPath = resolve(input);
      const outputPath = resolve(options.output);
      const raw = readFileSync(inputPath, "utf8");
      const json = JSON.parse(raw) as unknown;
      const records = reportSchema.parse(json);
      const markdown = buildMarkdown(inputPath, records, options.errorsOnly);
      writeFileSync(outputPath, markdown, "utf8");

      process.stdout.write(
        `${JSON.stringify(
          {
            message: "TODO report generated",
            input: basename(inputPath),
            output: outputPath,
            pagesAnalyzed: records.length,
          },
          null,
          2
        )}\n`
      );
    });

  await program.parseAsync(sanitizedArgv);
}

main().catch((error: unknown) => {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

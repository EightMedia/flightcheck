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
const secretFindingSchema = z.object({
    type: z.string(),
    provider: z.string(),
    severity: z.enum(["critical", "review"]),
    masked: z.string(),
    source: z.string(),
});
const recordSchema = z.object({
    url: z.string(),
    status: z.number().nullable(),
    h1: z.string(),
    title: z.string(),
    metaTitle: z.string(),
    metaDescription: z.string(),
    robots: z.string(),
    template: z.string().optional().default(""),
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
    security: z
        .object({
        secrets: z.array(secretFindingSchema),
        scannedAssets: z.number(),
    })
        .optional(),
    note: z.string().optional(),
    error: z.string().optional(),
});
const reportSchema = z.array(recordSchema);
const fieldSelectors = [
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
function isMissingValue(value) {
    if (Array.isArray(value))
        return value.length === 0;
    return value.trim() === "";
}
function parseRobotsDirectives(robots) {
    return new Set(robots
        .toLowerCase()
        .split(/[\s,]+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 0));
}
function collectWarnings(record) {
    const warnings = [];
    const directives = parseRobotsDirectives(record.robots);
    if (directives.has("noindex") || directives.has("none")) {
        warnings.push(`Page is set to noindex (robots: "${record.robots}") — search engines are told not to index it.`);
    }
    if (directives.has("nofollow") || directives.has("none")) {
        warnings.push(`Page is set to nofollow (robots: "${record.robots}") — search engines are told not to follow its links.`);
    }
    return warnings;
}
function buildMarkdown(inputPath, records, includeOnlyErrors) {
    const perFieldMissingCount = new Map();
    const perWarningCount = new Map();
    let pagesWithWarnings = 0;
    const perUrlTodos = [];
    for (const record of records) {
        const missingFields = fieldSelectors
            .filter((selector) => isMissingValue(selector.get(record)))
            .map((selector) => selector.label);
        if (record.error) {
            missingFields.unshift("fetch");
        }
        const warnings = collectWarnings(record);
        const hasSecrets = (record.security?.secrets.length ?? 0) > 0;
        if (includeOnlyErrors && !record.error && missingFields.length === 0 && warnings.length === 0 && !hasSecrets) {
            continue;
        }
        for (const field of missingFields) {
            perFieldMissingCount.set(field, (perFieldMissingCount.get(field) ?? 0) + 1);
        }
        const warningKeys = [];
        if (warnings.length > 0) {
            pagesWithWarnings += 1;
            const directives = parseRobotsDirectives(record.robots);
            if (directives.has("noindex") || directives.has("none")) {
                warningKeys.push("noindex");
            }
            if (directives.has("nofollow") || directives.has("none")) {
                warningKeys.push("nofollow");
            }
            for (const key of warningKeys) {
                perWarningCount.set(key, (perWarningCount.get(key) ?? 0) + 1);
            }
        }
        perUrlTodos.push({
            url: record.url,
            status: record.status,
            template: record.template.trim(),
            missingFields,
            warnings,
            warningKeys,
            note: record.note,
            error: record.error,
        });
    }
    const hasTemplates = perUrlTodos.some((item) => item.template !== "");
    const sortedFieldCounts = [...perFieldMissingCount.entries()].sort((a, b) => b[1] - a[1]);
    const sortedWarningCounts = [...perWarningCount.entries()].sort((a, b) => b[1] - a[1]);
    const now = new Date().toISOString();
    const securityPages = records
        .map((record) => ({ url: record.url, secrets: record.security?.secrets ?? [] }))
        .filter((entry) => entry.secrets.length > 0);
    const securityLines = [];
    if (securityPages.length > 0) {
        const anyMasked = securityPages.some((page) => page.secrets.some((secret) => secret.masked.includes("…")));
        securityLines.push("## 🔑 Security", "");
        if (anyMasked) {
            securityLines.push("Secret values are masked. Re-run the crawl with `--reveal-secrets` to show full values.", "");
        }
        const severityRank = (severity) => (severity === "critical" ? 0 : 1);
        for (const page of securityPages) {
            const sorted = [...page.secrets].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
            securityLines.push(`### ${page.url}`, "");
            for (const secret of sorted) {
                securityLines.push(`- [ ] **${secret.severity.toUpperCase()}** ${secret.provider} ${secret.type}: \`${secret.masked}\` (source: ${secret.source})`);
            }
            securityLines.push("");
        }
    }
    const lines = [
        "# Flightcheck TODO Report",
        "",
        `Generated: ${now}`,
        `Input: \`${inputPath}\``,
        `Pages analyzed: ${records.length}`,
        `Pages with TODOs: ${perUrlTodos.length}`,
        `Pages with warnings: ${pagesWithWarnings}`,
        "",
        ...securityLines,
        "## Important warnings",
        "",
    ];
    if (sortedWarningCounts.length === 0) {
        lines.push("- No important warnings found.");
    }
    else {
        for (const [warning, count] of sortedWarningCounts) {
            lines.push(`- [ ] ${warning}: set on ${count} page(s)`);
        }
    }
    lines.push("", "## Priority overview", "");
    if (sortedFieldCounts.length === 0) {
        lines.push("- No missing attributes found.");
    }
    else {
        for (const [field, count] of sortedFieldCounts) {
            lines.push(`- [ ] ${field}: missing on ${count} page(s)`);
        }
    }
    if (hasTemplates) {
        lines.push("", "## TODOs by template", "");
        const groups = new Map();
        for (const item of perUrlTodos) {
            const key = item.template === "" ? "(no template)" : item.template;
            const group = groups.get(key);
            if (group) {
                group.push(item);
            }
            else {
                groups.set(key, [item]);
            }
        }
        const sortedGroups = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
        for (const [template, items] of sortedGroups) {
            const groupFieldCount = new Map();
            const groupWarningCount = new Map();
            for (const item of items) {
                for (const field of item.missingFields) {
                    groupFieldCount.set(field, (groupFieldCount.get(field) ?? 0) + 1);
                }
                for (const key of item.warningKeys) {
                    groupWarningCount.set(key, (groupWarningCount.get(key) ?? 0) + 1);
                }
            }
            lines.push(`### Template: ${template} (${items.length} page(s))`, "");
            const sortedGroupWarnings = [...groupWarningCount.entries()].sort((a, b) => b[1] - a[1]);
            for (const [warning, count] of sortedGroupWarnings) {
                lines.push(`- [ ] Warning ${warning}: set on ${count}/${items.length} page(s)`);
            }
            const sortedGroupFields = [...groupFieldCount.entries()].sort((a, b) => b[1] - a[1]);
            if (sortedGroupFields.length === 0) {
                lines.push("- No missing attributes for this template.");
            }
            else {
                for (const [field, count] of sortedGroupFields) {
                    lines.push(`- [ ] ${field}: missing on ${count}/${items.length} page(s)`);
                }
            }
            lines.push("");
        }
    }
    lines.push("", "## Page-level TODO list", "");
    if (perUrlTodos.length === 0) {
        lines.push("- No page-level TODOs found.");
    }
    else {
        for (const item of perUrlTodos) {
            const statusValue = item.status === null ? "error" : String(item.status);
            lines.push(`### ${item.url}`);
            lines.push("");
            lines.push(`- Status: \`${statusValue}\``);
            if (item.template)
                lines.push(`- Template: \`${item.template}\``);
            if (item.note)
                lines.push(`- Note: ${item.note}`);
            if (item.error)
                lines.push(`- Error: ${item.error}`);
            for (const warning of item.warnings) {
                lines.push(`- [ ] Warning: ${warning}`);
            }
            if (item.missingFields.length === 0 && item.warnings.length === 0) {
                lines.push("- [ ] Review manually");
            }
            else if (item.missingFields.length > 0) {
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
    return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}
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
        .option("--output <file>", "Output Markdown file path", "./todo-report.md")
        .option("--errors-only", "Include only records with errors or missing attributes", false)
        .action((input, options) => {
        const inputPath = resolve(input);
        const outputPath = resolve(options.output);
        const raw = readFileSync(inputPath, "utf8");
        const json = JSON.parse(raw);
        const records = reportSchema.parse(json);
        const markdown = buildMarkdown(inputPath, records, options.errorsOnly);
        writeFileSync(outputPath, markdown, "utf8");
        process.stdout.write(`${JSON.stringify({
            message: "TODO report generated",
            input: basename(inputPath),
            output: outputPath,
            pagesAnalyzed: records.length,
        }, null, 2)}\n`);
    });
    await program.parseAsync(sanitizedArgv);
}
main().catch((error) => {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
});

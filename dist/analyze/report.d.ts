import { z } from "zod";
import { type BuildMarkdownOptions, type CrawlIssueCounts, type Tier1ReportData } from "./reportTier1.js";
import { type StackProfile } from "./stack.js";
export type { Tier1ReportData, BuildMarkdownOptions } from "./reportTier1.js";
declare const recordSchema: z.ZodObject<{
    url: z.ZodString;
    status: z.ZodNullable<z.ZodNumber>;
    h1: z.ZodString;
    title: z.ZodString;
    metaTitle: z.ZodString;
    metaDescription: z.ZodString;
    robots: z.ZodString;
    template: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    mainCount: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    charset: z.ZodString;
    language: z.ZodString;
    colorScheme: z.ZodString;
    themeColor: z.ZodString;
    doctype: z.ZodString;
    viewport: z.ZodString;
    canonical: z.ZodString;
    favicon: z.ZodString;
    icons: z.ZodArray<z.ZodObject<{
        rel: z.ZodString;
        href: z.ZodString;
        type: z.ZodString;
        sizes: z.ZodString;
        media: z.ZodString;
    }, z.core.$strip>>;
    og: z.ZodObject<{
        title: z.ZodString;
        description: z.ZodString;
        image: z.ZodString;
        url: z.ZodString;
        type: z.ZodString;
        siteName: z.ZodString;
    }, z.core.$strip>;
    twitter: z.ZodObject<{
        card: z.ZodString;
        title: z.ZodString;
        description: z.ZodString;
        image: z.ZodString;
    }, z.core.$strip>;
    tracking: z.ZodObject<{
        tagManager: z.ZodArray<z.ZodObject<{
            provider: z.ZodString;
            id: z.ZodString;
        }, z.core.$strip>>;
        analytics: z.ZodArray<z.ZodObject<{
            provider: z.ZodString;
            id: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    stack: z.ZodOptional<z.ZodObject<{
        detections: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            categories: z.ZodArray<z.ZodString>;
            confidence: z.ZodEnum<{
                high: "high";
                medium: "medium";
                low: "low";
            }>;
            evidence: z.ZodArray<z.ZodString>;
            website: z.ZodOptional<z.ZodString>;
            version: z.ZodOptional<z.ZodString>;
            detector: z.ZodOptional<z.ZodLiteral<"flightcheck-v1">>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    security: z.ZodOptional<z.ZodObject<{
        secrets: z.ZodArray<z.ZodObject<{
            type: z.ZodString;
            provider: z.ZodString;
            severity: z.ZodEnum<{
                critical: "critical";
                review: "review";
            }>;
            masked: z.ZodString;
            source: z.ZodString;
        }, z.core.$strip>>;
        scannedAssets: z.ZodNumber;
    }, z.core.$strip>>;
    images: z.ZodOptional<z.ZodObject<{
        issues: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            severity: z.ZodEnum<{
                critical: "critical";
                error: "error";
                warning: "warning";
                review: "review";
            }>;
            message: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    a11yStatic: z.ZodOptional<z.ZodObject<{
        issues: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            severity: z.ZodEnum<{
                critical: "critical";
                error: "error";
                warning: "warning";
                review: "review";
            }>;
            message: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    note: z.ZodOptional<z.ZodString>;
    error: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const reportSchema: z.ZodArray<z.ZodObject<{
    url: z.ZodString;
    status: z.ZodNullable<z.ZodNumber>;
    h1: z.ZodString;
    title: z.ZodString;
    metaTitle: z.ZodString;
    metaDescription: z.ZodString;
    robots: z.ZodString;
    template: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    mainCount: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    charset: z.ZodString;
    language: z.ZodString;
    colorScheme: z.ZodString;
    themeColor: z.ZodString;
    doctype: z.ZodString;
    viewport: z.ZodString;
    canonical: z.ZodString;
    favicon: z.ZodString;
    icons: z.ZodArray<z.ZodObject<{
        rel: z.ZodString;
        href: z.ZodString;
        type: z.ZodString;
        sizes: z.ZodString;
        media: z.ZodString;
    }, z.core.$strip>>;
    og: z.ZodObject<{
        title: z.ZodString;
        description: z.ZodString;
        image: z.ZodString;
        url: z.ZodString;
        type: z.ZodString;
        siteName: z.ZodString;
    }, z.core.$strip>;
    twitter: z.ZodObject<{
        card: z.ZodString;
        title: z.ZodString;
        description: z.ZodString;
        image: z.ZodString;
    }, z.core.$strip>;
    tracking: z.ZodObject<{
        tagManager: z.ZodArray<z.ZodObject<{
            provider: z.ZodString;
            id: z.ZodString;
        }, z.core.$strip>>;
        analytics: z.ZodArray<z.ZodObject<{
            provider: z.ZodString;
            id: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    stack: z.ZodOptional<z.ZodObject<{
        detections: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            categories: z.ZodArray<z.ZodString>;
            confidence: z.ZodEnum<{
                high: "high";
                medium: "medium";
                low: "low";
            }>;
            evidence: z.ZodArray<z.ZodString>;
            website: z.ZodOptional<z.ZodString>;
            version: z.ZodOptional<z.ZodString>;
            detector: z.ZodOptional<z.ZodLiteral<"flightcheck-v1">>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    security: z.ZodOptional<z.ZodObject<{
        secrets: z.ZodArray<z.ZodObject<{
            type: z.ZodString;
            provider: z.ZodString;
            severity: z.ZodEnum<{
                critical: "critical";
                review: "review";
            }>;
            masked: z.ZodString;
            source: z.ZodString;
        }, z.core.$strip>>;
        scannedAssets: z.ZodNumber;
    }, z.core.$strip>>;
    images: z.ZodOptional<z.ZodObject<{
        issues: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            severity: z.ZodEnum<{
                critical: "critical";
                error: "error";
                warning: "warning";
                review: "review";
            }>;
            message: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    a11yStatic: z.ZodOptional<z.ZodObject<{
        issues: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            severity: z.ZodEnum<{
                critical: "critical";
                error: "error";
                warning: "warning";
                review: "review";
            }>;
            message: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    note: z.ZodOptional<z.ZodString>;
    error: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>;
export type ReportRecord = z.infer<typeof recordSchema>;
export declare function parseReport(json: unknown): ReportRecord[];
type UrlTodoItem = {
    url: string;
    status: number | null;
    template: string;
    missingFields: string[];
    warnings: string[];
    warningKeys: string[];
    tier1IssueKeys: string[];
    imageIssues: {
        id: string;
        severity: string;
        message: string;
    }[];
    a11yStaticIssues: {
        id: string;
        severity: string;
        message: string;
    }[];
    mainLandmarkTodos: string[];
    mainCount?: number | null;
    note?: string;
    error?: string;
};
export type RemainingA11yIssue = {
    id: string;
    message: string;
};
export type PageFix = {
    item: UrlTodoItem;
    remainingTodos: string[];
    /** SEO fields still missing after site-wide and template coverage is removed. */
    remainingFields: string[];
    /** Best-practice warning keys (template, robots, landmark) still open after coverage. */
    remainingWarningKeys: string[];
    /** Accessibility issues (image alt, heading skip, lang, etc.) still open after coverage. Landmarks live in remainingWarningKeys. */
    remainingA11yIssues: RemainingA11yIssue[];
};
export type ReportAnalysis = {
    allItems: UrlTodoItem[];
    totalPages: number;
    redirectOnly: boolean;
    siteWideFields: Set<string>;
    siteWideWarningKeys: Set<string>;
    siteWideTier1Keys: Set<string>;
    siteWideFixTodos: string[];
    templateGroups: Map<string, UrlTodoItem[]>;
    templateFieldMap: Map<string, Set<string>>;
    templateWarningKeyMap: Map<string, Set<string>>;
    templateTier1KeyMap: Map<string, Set<string>>;
    coveredFieldsByTemplate: Map<string, Set<string>>;
    coveredWarningKeysByTemplate: Map<string, Set<string>>;
    coveredTier1KeysByTemplate: Map<string, Set<string>>;
    pageFixes: PageFix[];
    securityPages: Array<{
        url: string;
        secrets: Array<{
            type: string;
            provider: string;
            severity: string;
            masked: string;
            source: string;
        }>;
    }>;
    stackProfile: StackProfile;
    crawlIssueCounts: CrawlIssueCounts;
};
export declare function buildReportAnalysis(records: ReportRecord[], tier1?: Tier1ReportData, options?: BuildMarkdownOptions): Promise<ReportAnalysis>;
export declare function buildMarkdown(inputPath: string, records: ReportRecord[], includeOnlyErrors: boolean, tier1?: Tier1ReportData, options?: BuildMarkdownOptions): Promise<string>;
//# sourceMappingURL=report.d.ts.map
# Security Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an API-key / secret scan to Flightcheck (page HTML + same-origin JS) and a check-group system so any scan can be skipped or run on its own.

**Architecture:** Introduce named check groups (`meta`, `icons`, `social`, `tracking`, `security`) resolved from `--only`/`--skip` CLI flags. Pure extraction stays in `extractVerificationRecord`; the `security` group runs in `runCrawler` because it needs network access to fetch linked JS. A pure `scanText` function applies a pattern table classified by severity (`critical` vs `review`). Findings are masked by default; `--reveal-secrets` shows full values.

**Tech Stack:** Node 22 (global `fetch`), TypeScript (ESM/NodeNext), cheerio, commander, zod, crawlee, vitest (new).

---

## File structure

- Create `src/crawler/secrets.ts` — pure secret scanner (`scanText`, `maskSecret`, pattern table).
- Create `src/crawler/checkGroups.ts` — group constants + `resolveActiveGroups`.
- Create `src/crawler/jsAssets.ts` — `extractSameOriginScripts` (pure).
- Modify `src/crawler/schema.ts` — add `SecretFinding`/`SecretSeverity` types + `security` field.
- Modify `src/crawler/extractors.ts` — conditional extraction by active group.
- Modify `src/crawler/runCrawler.ts` — run security scan (HTML + fetched JS), thread options.
- Modify `src/cli.ts` — `--only`, `--skip`, `--reveal-secrets`, hint in summary.
- Modify `src/analyze.ts` — schema + "🔑 Security" report section + hint + errors-only keep.
- Create `src/crawler/secrets.test.ts`, `src/crawler/checkGroups.test.ts`, `src/crawler/jsAssets.test.ts`.
- Modify `package.json` — add vitest + test scripts.

---

## Task 1: Add vitest

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install vitest as a dev dependency**

Run: `npm install -D vitest`
Expected: `vitest` added under `devDependencies`.

- [ ] **Step 2: Add test scripts**

In `package.json`, add to the `"scripts"` block:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Verify vitest runs (no tests yet)**

Run: `npm test`
Expected: vitest reports "No test files found" (exit code may be non-zero) — this confirms vitest is installed and runnable.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add vitest for unit tests"
```

---

## Task 2: Secret scanner (`secrets.ts`)

**Files:**
- Create: `src/crawler/secrets.ts`
- Test: `src/crawler/secrets.test.ts`
- (Types `SecretFinding`/`SecretSeverity` are added to `schema.ts` in Step 3 below before the implementation imports them.)

- [ ] **Step 1: Write the failing test**

Create `src/crawler/secrets.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { scanText, maskSecret } from "./secrets.js";

describe("maskSecret", () => {
  it("masks long values as first6…last4", () => {
    expect(maskSecret("AIzaSyBCb8P7RZHp0DcWeyhMr0ULIcqjCYEBC0Y")).toBe("AIzaSy…BC0Y");
  });
  it("masks short values as first2…last2", () => {
    expect(maskSecret("abcdef")).toBe("ab…ef");
  });
});

describe("scanText", () => {
  it("finds a Google API key as review severity, masked by default", () => {
    const findings = scanText(
      "var k='AIzaSyBCb8P7RZHp0DcWeyhMr0ULIcqjCYEBC0Y';",
      "html"
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      type: "google-api-key",
      provider: "google",
      severity: "review",
      masked: "AIzaSy…BC0Y",
      source: "html",
    });
  });

  it("finds an AWS access key as critical", () => {
    const findings = scanText("AKIAIOSFODNN7EXAMPLE", "app.js");
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      type: "aws-access-key-id",
      provider: "aws",
      severity: "critical",
      source: "app.js",
    });
  });

  it("reveals full values when reveal=true", () => {
    const key = "AIzaSyBCb8P7RZHp0DcWeyhMr0ULIcqjCYEBC0Y";
    const findings = scanText(`x="${key}"`, "html", true);
    expect(findings[0].masked).toBe(key);
  });

  it("dedupes the same key found twice", () => {
    const key = "AIzaSyBCb8P7RZHp0DcWeyhMr0ULIcqjCYEBC0Y";
    const findings = scanText(`${key} and again ${key}`, "html");
    expect(findings).toHaveLength(1);
  });

  it("does not double-report a specific key also matching a generic assignment", () => {
    const findings = scanText(
      `apiKey: "AIzaSyBCb8P7RZHp0DcWeyhMr0ULIcqjCYEBC0Y"`,
      "html"
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].type).toBe("google-api-key");
  });

  it("produces no findings on clean text", () => {
    expect(scanText("<html><body>Hello world</body></html>", "html")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/crawler/secrets.test.ts`
Expected: FAIL — cannot resolve `./secrets.js` (module not created yet).

- [ ] **Step 3: Add the shared types to `schema.ts`**

In `src/crawler/schema.ts`, above `TrackingItem`, add:

```ts
export type SecretSeverity = "critical" | "review";

export type SecretFinding = {
  type: string;
  provider: string;
  severity: SecretSeverity;
  masked: string;
  source: string;
};
```

- [ ] **Step 4: Write the implementation**

Create `src/crawler/secrets.ts`:

```ts
import type { SecretFinding, SecretSeverity } from "./schema.js";

type SecretPattern = {
  type: string;
  provider: string;
  severity: SecretSeverity;
  regex: RegExp;
  group?: number; // capture group holding the value; default = whole match
  generic?: boolean; // generic patterns skip values already matched by a specific one
};

const PATTERNS: SecretPattern[] = [
  { type: "google-api-key", provider: "google", severity: "review", regex: /\bAIzaSy[0-9A-Za-z_-]{33}\b/g },
  { type: "aws-access-key-id", provider: "aws", severity: "critical", regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { type: "stripe-secret-key", provider: "stripe", severity: "critical", regex: /\bsk_live_[0-9a-zA-Z]{24,}\b/g },
  { type: "stripe-publishable-key", provider: "stripe", severity: "review", regex: /\bpk_live_[0-9a-zA-Z]{24,}\b/g },
  { type: "github-token", provider: "github", severity: "critical", regex: /\bgh[posru]_[0-9A-Za-z]{36,}\b/g },
  {
    type: "private-key",
    provider: "generic",
    severity: "critical",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g,
  },
  {
    type: "generic-secret",
    provider: "generic",
    severity: "critical",
    regex: /["']?(?:secret|password|api[_-]?secret)["']?\s*[:=]\s*["']([^"'\s]{8,})["']/gi,
    group: 1,
    generic: true,
  },
  {
    type: "generic-api-key",
    provider: "generic",
    severity: "review",
    regex: /["']?(?:api[_-]?key|access[_-]?token|auth[_-]?token)["']?\s*[:=]\s*["']([^"'\s]{12,})["']/gi,
    group: 1,
    generic: true,
  },
];

export function maskSecret(value: string): string {
  if (value.length <= 10) {
    return `${value.slice(0, 2)}…${value.slice(-2)}`;
  }
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function scanText(text: string, source: string, reveal = false): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const seen = new Set<string>(); // dedup: type + raw value
  const specificValues = new Set<string>(); // raw values from non-generic patterns

  const collect = (pattern: SecretPattern): void => {
    const re = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const raw = pattern.group ? match[pattern.group] : match[0];
      if (!raw) continue;
      if (pattern.generic && specificValues.has(raw)) continue;
      const key = `${pattern.type}:${raw}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!pattern.generic) specificValues.add(raw);
      findings.push({
        type: pattern.type,
        provider: pattern.provider,
        severity: pattern.severity,
        masked: reveal ? raw : maskSecret(raw),
        source,
      });
    }
  };

  for (const pattern of PATTERNS.filter((p) => !p.generic)) collect(pattern);
  for (const pattern of PATTERNS.filter((p) => p.generic)) collect(pattern);

  return findings;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/crawler/secrets.test.ts`
Expected: PASS (all cases).

- [ ] **Step 6: Commit**

```bash
git add src/crawler/secrets.ts src/crawler/secrets.test.ts src/crawler/schema.ts
git commit -m "feat: add secret scanner with masking and severity"
```

---

## Task 3: Check-group resolver (`checkGroups.ts`)

**Files:**
- Create: `src/crawler/checkGroups.ts`
- Test: `src/crawler/checkGroups.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/crawler/checkGroups.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveActiveGroups, CHECK_GROUPS } from "./checkGroups.js";

describe("resolveActiveGroups", () => {
  it("activates all groups when no flags given", () => {
    const active = resolveActiveGroups({});
    expect(active.size).toBe(CHECK_GROUPS.length);
    expect(active.has("security")).toBe(true);
  });

  it("--only selects just the listed groups", () => {
    const active = resolveActiveGroups({ only: "security" });
    expect([...active]).toEqual(["security"]);
  });

  it("--skip removes the listed groups", () => {
    const active = resolveActiveGroups({ skip: "tracking,social" });
    expect(active.has("tracking")).toBe(false);
    expect(active.has("social")).toBe(false);
    expect(active.has("meta")).toBe(true);
  });

  it("throws when both --only and --skip are given", () => {
    expect(() => resolveActiveGroups({ only: "meta", skip: "icons" })).toThrow(/mutually exclusive/i);
  });

  it("throws on an unknown group name", () => {
    expect(() => resolveActiveGroups({ only: "bogus" })).toThrow(/bogus/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/crawler/checkGroups.test.ts`
Expected: FAIL — cannot resolve `./checkGroups.js`.

- [ ] **Step 3: Write the implementation**

Create `src/crawler/checkGroups.ts`:

```ts
export const CHECK_GROUPS = ["meta", "icons", "social", "tracking", "security"] as const;

export type CheckGroup = (typeof CHECK_GROUPS)[number];

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function assertValid(names: string[]): CheckGroup[] {
  const valid = new Set<string>(CHECK_GROUPS);
  for (const name of names) {
    if (!valid.has(name)) {
      throw new Error(`Unknown check group "${name}". Valid groups: ${CHECK_GROUPS.join(", ")}.`);
    }
  }
  return names as CheckGroup[];
}

export function resolveActiveGroups(opts: { only?: string; skip?: string }): Set<CheckGroup> {
  if (opts.only && opts.skip) {
    throw new Error("--only and --skip are mutually exclusive. Use one or the other.");
  }
  if (opts.only) {
    return new Set(assertValid(parseList(opts.only)));
  }
  if (opts.skip) {
    const skip = new Set(assertValid(parseList(opts.skip)));
    return new Set(CHECK_GROUPS.filter((group) => !skip.has(group)));
  }
  return new Set(CHECK_GROUPS);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/crawler/checkGroups.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/crawler/checkGroups.ts src/crawler/checkGroups.test.ts
git commit -m "feat: add check-group resolver for --only/--skip"
```

---

## Task 4: Same-origin script extractor (`jsAssets.ts`)

**Files:**
- Create: `src/crawler/jsAssets.ts`
- Test: `src/crawler/jsAssets.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/crawler/jsAssets.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { extractSameOriginScripts } from "./jsAssets.js";

const ORIGIN = "https://example.com";

describe("extractSameOriginScripts", () => {
  it("returns absolute URLs for same-origin scripts", () => {
    const html = `
      <script src="/static/app.js"></script>
      <script src="https://example.com/vendor.js"></script>
    `;
    const result = extractSameOriginScripts(html, "https://example.com/page", ORIGIN);
    expect(result).toEqual([
      "https://example.com/static/app.js",
      "https://example.com/vendor.js",
    ]);
  });

  it("drops cross-origin and inline scripts", () => {
    const html = `
      <script src="https://cdn.other.com/lib.js"></script>
      <script>console.log("inline")</script>
    `;
    expect(extractSameOriginScripts(html, "https://example.com/page", ORIGIN)).toEqual([]);
  });

  it("dedupes repeated script URLs", () => {
    const html = `
      <script src="/app.js"></script>
      <script src="/app.js"></script>
    `;
    expect(extractSameOriginScripts(html, "https://example.com/", ORIGIN)).toEqual([
      "https://example.com/app.js",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/crawler/jsAssets.test.ts`
Expected: FAIL — cannot resolve `./jsAssets.js`.

- [ ] **Step 3: Write the implementation**

Create `src/crawler/jsAssets.ts`:

```ts
import * as cheerio from "cheerio";

export function extractSameOriginScripts(html: string, baseUrl: string, origin: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();

  $("script[src]").each((_, element) => {
    const src = ($(element).attr("src") ?? "").trim();
    if (!src) return;
    try {
      const absolute = new URL(src, baseUrl);
      if (absolute.origin !== origin) return;
      if (absolute.protocol !== "http:" && absolute.protocol !== "https:") return;
      urls.add(absolute.toString());
    } catch {
      // Ignore malformed src values.
    }
  });

  return [...urls];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/crawler/jsAssets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/crawler/jsAssets.ts src/crawler/jsAssets.test.ts
git commit -m "feat: add same-origin script URL extractor"
```

---

## Task 5: Extend the record schema with `security`

**Files:**
- Modify: `src/crawler/schema.ts`

- [ ] **Step 1: Add `security` to the `VerificationRecord` type**

In `src/crawler/schema.ts`, inside the `VerificationRecord` type, after the `tracking` block and before `note?`, add:

```ts
  security: {
    secrets: SecretFinding[];
    scannedAssets: number;
  };
```

- [ ] **Step 2: Add `security` defaults to `createEmptyVerificationRecord`**

In the returned object of `createEmptyVerificationRecord`, after the `tracking` block, add:

```ts
    security: {
      secrets: [],
      scannedAssets: 0,
    },
```

- [ ] **Step 3: Verify it type-checks**

Run: `npm run build`
Expected: PASS (no type errors). `dist/` is generated.

- [ ] **Step 4: Commit**

```bash
git add src/crawler/schema.ts
git commit -m "feat: add security field to verification record"
```

---

## Task 6: Conditional extraction by active group

**Files:**
- Modify: `src/crawler/extractors.ts`

- [ ] **Step 1: Import groups and accept an `activeGroups` parameter**

At the top of `src/crawler/extractors.ts`, add to the imports:

```ts
import { CHECK_GROUPS, type CheckGroup } from "./checkGroups.js";
```

Change the `extractVerificationRecord` signature to accept an optional active-group set (defaults to all groups so existing call sites stay valid):

```ts
export function extractVerificationRecord(
  html: string,
  url: string,
  status: number | null,
  contentType: string,
  activeGroups: Set<CheckGroup> = new Set(CHECK_GROUPS)
): VerificationRecord {
```

- [ ] **Step 2: Guard each extraction block by its group**

Replace the body from `const $ = cheerio.load(html);` through the `return { ...empty, ... }` statement with this group-aware version:

```ts
  const $ = cheerio.load(html);
  const result: VerificationRecord = { ...empty };

  if (activeGroups.has("meta")) {
    const title = textOrEmpty($("title").first().text());
    result.title = title;
    result.h1 = textOrEmpty($("h1").first().text());
    result.metaDescription = attrOrEmpty($, 'meta[name="description"]', "content");
    result.robots = attrOrEmpty($, 'meta[name="robots"]', "content");
    result.colorScheme = attrOrEmpty($, 'meta[name="color-scheme"]', "content");
    result.themeColor = attrOrEmpty($, 'meta[name="theme-color"]', "content");
    result.viewport = attrOrEmpty($, 'meta[name="viewport"]', "content");
    result.language = textOrEmpty($("html").first().attr("lang"));
    result.charset = textOrEmpty($("meta[charset]").first().attr("charset"));
    const doctypeMatch = html.match(/<!doctype\s+([^>]+)>/i);
    result.doctype = textOrEmpty(doctypeMatch?.[1]);
    result.canonical = resolveUrlMaybe(attrOrEmpty($, 'link[rel="canonical"]', "href"), url);
  }

  if (activeGroups.has("social")) {
    result.og = {
      title: attrOrEmpty($, 'meta[property="og:title"]', "content"),
      description: attrOrEmpty($, 'meta[property="og:description"]', "content"),
      image: resolveUrlMaybe(attrOrEmpty($, 'meta[property="og:image"]', "content"), url),
      url: resolveUrlMaybe(attrOrEmpty($, 'meta[property="og:url"]', "content"), url),
      type: attrOrEmpty($, 'meta[property="og:type"]', "content"),
      siteName: attrOrEmpty($, 'meta[property="og:site_name"]', "content"),
    };
    result.twitter = {
      card: attrOrEmpty($, 'meta[name="twitter:card"]', "content"),
      title: attrOrEmpty($, 'meta[name="twitter:title"]', "content"),
      description: attrOrEmpty($, 'meta[name="twitter:description"]', "content"),
      image: resolveUrlMaybe(attrOrEmpty($, 'meta[name="twitter:image"]', "content"), url),
    };
  }

  if (activeGroups.has("meta")) {
    result.metaTitle = textOrEmpty(result.og.title || result.twitter.title || result.title);
  }

  if (activeGroups.has("icons")) {
    result.favicon = resolveUrlMaybe(attrOrEmpty($, "link[rel]", "href", { containsRel: "icon" }), url);
    result.icons = $("link[rel]")
      .toArray()
      .map((el) => $(el))
      .filter((el) => textOrEmpty(el.attr("rel")).toLowerCase().includes("icon"))
      .map((el) => ({
        rel: textOrEmpty(el.attr("rel")).toLowerCase(),
        href: resolveUrlMaybe(textOrEmpty(el.attr("href")), url),
        type: textOrEmpty(el.attr("type")),
        sizes: textOrEmpty(el.attr("sizes")),
        media: textOrEmpty(el.attr("media")),
      }));
  }

  if (activeGroups.has("tracking")) {
    result.tracking = extractTracking(html);
  }

  return result;
```

Note: `metaTitle` is computed after `social` so it can still fall back to og/twitter titles when both groups are active; when `social` is skipped, `result.og`/`result.twitter` keep their empty defaults and `metaTitle` falls back to `<title>`. The `security` group is intentionally not handled here — it is network-bound and runs in `runCrawler` (Task 7).

- [ ] **Step 3: Verify build and existing tests still pass**

Run: `npm run build && npm test`
Expected: build PASS; the three unit test files still PASS.

- [ ] **Step 4: Commit**

```bash
git add src/crawler/extractors.ts
git commit -m "feat: gate extraction blocks by active check group"
```

---

## Task 7: Run the security scan in the crawler

**Files:**
- Modify: `src/crawler/runCrawler.ts`

- [ ] **Step 1: Add imports and extend `RunCrawlerOptions`**

In `src/crawler/runCrawler.ts`, add imports:

```ts
import { CHECK_GROUPS, type CheckGroup } from "./checkGroups.js";
import { extractSameOriginScripts } from "./jsAssets.js";
import { scanText } from "./secrets.js";
import type { SecretFinding, VerificationRecord } from "./schema.js";
```

(There is already a `import type { VerificationRecord } from "./schema.js";` line — replace it with the combined import above so `SecretFinding` is also imported.)

Add two fields to `RunCrawlerOptions`:

```ts
  activeGroups?: Set<CheckGroup>;
  revealSecrets?: boolean;
```

- [ ] **Step 2: Resolve the new options near the other option defaults**

After the `respectRobotsTxt` line in `runCrawler`, add:

```ts
  const activeGroups = options.activeGroups ?? new Set<CheckGroup>(CHECK_GROUPS);
  const revealSecrets = options.revealSecrets ?? false;
  const jsScanCache = new Map<string, SecretFinding[]>();

  const fetchText = async (assetUrl: string): Promise<string | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(assetUrl, { signal: controller.signal });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const scanSecurity = async (html: string, pageUrl: string): Promise<{ secrets: SecretFinding[]; scannedAssets: number }> => {
    const secrets: SecretFinding[] = [...scanText(html, "html", revealSecrets)];
    const scripts = extractSameOriginScripts(html, pageUrl, origin);
    let scannedAssets = 0;
    for (const scriptUrl of scripts) {
      let assetFindings = jsScanCache.get(scriptUrl);
      if (!assetFindings) {
        const js = await fetchText(scriptUrl);
        if (js === null) continue;
        assetFindings = scanText(js, scriptUrl, revealSecrets);
        jsScanCache.set(scriptUrl, assetFindings);
      }
      scannedAssets += 1;
      secrets.push(...assetFindings);
    }
    return { secrets, scannedAssets };
  };
```

- [ ] **Step 3: Pass `activeGroups` to extraction and run the scan in the main handler**

In the main `requestHandler`, change the extraction call to pass `activeGroups`:

```ts
      const record = extractVerificationRecord(html, currentUrl, status, effectiveContentType, activeGroups);
```

Immediately after that line (and before `records.push(record);`), add the security scan:

```ts
      if (activeGroups.has("security") && effectiveContentType.includes("text/html") && html) {
        record.security = await scanSecurity(html, currentUrl);
      }
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: PASS. (`fetch` is available as a Node 22 global; no new dependency needed.)

- [ ] **Step 5: Commit**

```bash
git add src/crawler/runCrawler.ts
git commit -m "feat: scan html and same-origin js for secrets during crawl"
```

---

## Task 8: Wire CLI flags and the masked-mode hint

**Files:**
- Modify: `src/cli.ts`

- [ ] **Step 1: Import the resolver**

At the top of `src/cli.ts`, add:

```ts
import { resolveActiveGroups } from "./crawler/checkGroups.js";
```

- [ ] **Step 2: Add the new options**

In the `program` option chain (after `--exclude`), add:

```ts
    .option("--only <groups>", "Run only these check groups (comma-separated): meta,icons,social,tracking,security")
    .option("--skip <groups>", "Skip these check groups (comma-separated)")
    .option("--reveal-secrets", "Show full secret values instead of masked ones", false)
```

- [ ] **Step 3: Resolve active groups inside the action (with a friendly error)**

In the `.action` callback, after the numeric validation block and before `const normalizedStartUrl = ...`, add:

```ts
      let activeGroups;
      try {
        activeGroups = resolveActiveGroups({ only: opts.only as string | undefined, skip: opts.skip as string | undefined });
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : String(error));
      }
      const revealSecrets = Boolean(opts.revealSecrets);
```

- [ ] **Step 4: Pass the new options to `runCrawler`**

In the `runCrawler({ ... })` call, add these two fields to the options object (after `respectRobotsTxt`):

```ts
        activeGroups,
        revealSecrets,
```

- [ ] **Step 5: Add the secret count + hint to the summary**

Replace the final `process.stdout.write(...)` summary block with:

```ts
      const totalSecrets = records.reduce((sum, record) => sum + (record.security?.secrets.length ?? 0), 0);
      const summary: Record<string, unknown> = {
        message: interrupted ? "H1 crawl interrupted, partial report written" : "H1 crawl report written",
        output: outputPath,
        pages: records.length,
        secretsFound: totalSecrets,
        interrupted,
      };
      if (totalSecrets > 0 && !revealSecrets) {
        summary.hint = `${totalSecrets} secret(s) found (masked). Re-run with --reveal-secrets to show full values.`;
      }

      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
```

- [ ] **Step 6: Verify build and a help run**

Run: `npm run build && node dist/cli.js --help`
Expected: build PASS; help output lists `--only`, `--skip`, and `--reveal-secrets`.

- [ ] **Step 7: Commit**

```bash
git add src/cli.ts
git commit -m "feat: add --only/--skip/--reveal-secrets flags and secret hint"
```

---

## Task 9: Surface findings in the analyzer report

**Files:**
- Modify: `src/analyze.ts`

- [ ] **Step 1: Add the secret schema and extend the record schema**

In `src/analyze.ts`, after `trackingItemSchema`, add:

```ts
const secretFindingSchema = z.object({
  type: z.string(),
  provider: z.string(),
  severity: z.enum(["critical", "review"]),
  masked: z.string(),
  source: z.string(),
});
```

Inside `recordSchema`, after the `tracking` block and before `note`, add:

```ts
  security: z
    .object({
      secrets: z.array(secretFindingSchema),
      scannedAssets: z.number(),
    })
    .optional(),
```

(`.optional()` keeps older report files without a `security` field readable.)

- [ ] **Step 2: Keep pages with security findings under `--errors-only`**

In `buildMarkdown`, find the early-continue:

```ts
    if (includeOnlyErrors && !record.error && missingFields.length === 0) {
      continue;
    }
```

Replace it with:

```ts
    const hasSecrets = (record.security?.secrets.length ?? 0) > 0;
    if (includeOnlyErrors && !record.error && missingFields.length === 0 && !hasSecrets) {
      continue;
    }
```

- [ ] **Step 3: Build and inject the Security section**

In `buildMarkdown`, after the `const now = new Date().toISOString();` line, add the section builder:

```ts
  const securityPages = records
    .map((record) => ({ url: record.url, secrets: record.security?.secrets ?? [] }))
    .filter((entry) => entry.secrets.length > 0);

  const securityLines: string[] = [];
  if (securityPages.length > 0) {
    const anyMasked = securityPages.some((page) => page.secrets.some((secret) => secret.masked.includes("…")));
    securityLines.push("## 🔑 Security", "");
    if (anyMasked) {
      securityLines.push("Secret values are masked. Re-run the crawl with `--reveal-secrets` to show full values.", "");
    }
    const severityRank = (severity: string): number => (severity === "critical" ? 0 : 1);
    for (const page of securityPages) {
      const sorted = [...page.secrets].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
      securityLines.push(`### ${page.url}`, "");
      for (const secret of sorted) {
        securityLines.push(`- [ ] **${secret.severity.toUpperCase()}** ${secret.provider} ${secret.type}: \`${secret.masked}\` (source: ${secret.source})`);
      }
      securityLines.push("");
    }
  }
```

- [ ] **Step 4: Place the Security section at the top of the report body**

In the `lines` array literal, change the header block so the Security section is spread in right after the summary counts. Replace:

```ts
    `Pages with TODOs: ${perUrlTodos.length}`,
    "",
    "## Priority overview",
    "",
  ];
```

with:

```ts
    `Pages with TODOs: ${perUrlTodos.length}`,
    "",
    ...securityLines,
    "## Priority overview",
    "",
  ];
```

- [ ] **Step 5: Verify build passes**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/analyze.ts
git commit -m "feat: report exposed secrets in analyzer markdown"
```

---

## Task 10: Full verification, docs, and smoke run

**Files:**
- Modify: `docs/crawler.md`
- Modify: `docs/analyze.md`

- [ ] **Step 1: Run the full test suite and build**

Run: `npm test && npm run build`
Expected: all three unit test files PASS; build PASS.

- [ ] **Step 2: Document the new flags**

In `docs/crawler.md`, add a "Check groups" section describing `--only`, `--skip` (valid groups: `meta`, `icons`, `social`, `tracking`, `security`), `--reveal-secrets`, and the `security.secrets` / `security.scannedAssets` output fields with an example. In `docs/analyze.md`, document the "🔑 Security" report section and the masked-mode hint.

- [ ] **Step 3: Live smoke run — only the security scan**

Run: `npx tsx src/cli.ts https://eight.nl --only security --max-pages 5 --output ./security-report.json`
Expected: a `security-report.json` is written; each record has a `security` object; summary JSON includes `secretsFound` and (if any found, masked) a `hint`. Note: a Google `AIzaSy…` key here would appear as `review` severity, not a breach.

- [ ] **Step 4: Live smoke run — analyzer**

Run: `npx tsx src/analyze.ts ./security-report.json --output ./security-todo.md`
Expected: if any secrets were found, `security-todo.md` opens with a "🔑 Security" section listing them; otherwise the report is unchanged from prior behavior.

- [ ] **Step 5: Clean up smoke artifacts and commit docs**

```bash
rm -f ./security-report.json ./security-todo.md
git add docs/crawler.md docs/analyze.md
git commit -m "docs: document check groups and security scan"
```

---

## Self-review notes

- **Spec coverage:** check groups + `--only`/`--skip` (Tasks 3, 8); secret scanner with severity + masking (Task 2); HTML + same-origin JS scanning with shared-bundle cache (Tasks 4, 7); `security` output shape + `scannedAssets` (Tasks 5, 7); `--reveal-secrets` + masked-mode hint in CLI and analyzer (Tasks 8, 9); analyzer Security section + errors-only keep (Task 9); vitest on pure modules only (Tasks 1–4). All spec sections map to a task.
- **Type consistency:** `SecretFinding`/`SecretSeverity` defined once in `schema.ts`, imported by `secrets.ts`, `runCrawler.ts`, and mirrored by `secretFindingSchema` in `analyze.ts`. `CheckGroup`/`CHECK_GROUPS` from `checkGroups.ts` used consistently in `extractors.ts`, `runCrawler.ts`, `cli.ts`. `scanText(text, source, reveal?)` and `extractSameOriginScripts(html, baseUrl, origin)` signatures match across definition, tests, and call sites.
- **No placeholders:** every code step contains complete code.

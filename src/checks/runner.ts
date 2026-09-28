import { CHECK_DEFINITIONS, getCheckDefinition, listChecks, listImplementedChecks, runRegisteredCheck } from "./registry.js";
import {
  analyzeRedirect,
  checksSkippedByRedirect,
  resolveChecksForRedirect,
  runRedirectCheck,
  type RedirectCheckResult,
} from "./redirect.js";
import { DEFAULT_CHECK_IDS, type CheckExecutionResult, type CheckId, type CheckRunContext, type RunChecksOptions, type RunChecksResult } from "./types.js";

export function planCheckWaves(requestedChecks: CheckId[]): CheckId[][] {
  const requested = new Set(requestedChecks);
  const waves: CheckId[][] = [];

  const independent = (
    ["crawl", "lighthouse", "security-headers", "dns", "robots-txt", "agent-ready"] as CheckId[]
  ).filter((id) => requested.has(id));
  if (independent.length > 0) {
    waves.push(independent);
  }

  const afterCrawl = (["sitemap"] as CheckId[]).filter((id) => requested.has(id));
  if (afterCrawl.length > 0) {
    waves.push(afterCrawl);
  }

  if (requested.has("analyze")) {
    waves.push(["analyze"]);
  }

  return waves;
}

function canRunAnalyze(context: CheckRunContext): boolean {
  return Boolean(
    context.outputs.redirect?.redirectOnly ||
      context.outputs.crawl ||
      context.options.analyze?.records ||
      context.options.analyze?.inputPath
  );
}

function skippedResult(id: CheckId, message: string): CheckExecutionResult {
  return {
    id,
    status: "skipped",
    error: message,
    durationMs: 0,
  };
}

async function executeCheck(context: CheckRunContext, id: CheckId): Promise<CheckExecutionResult> {
  const definition = getCheckDefinition(id);

  if (!definition.implemented) {
    return {
      id,
      status: "unsupported",
      error: `${definition.name} check is not implemented yet.`,
      durationMs: 0,
    };
  }

  if (id === "analyze" && !canRunAnalyze(context)) {
    return {
      id,
      status: "skipped",
      error: "Analyze check requires crawl output, redirect output, or analyze.inputPath / analyze.records.",
      durationMs: 0,
    };
  }

  if (id === "sitemap" && !context.outputs.crawl) {
    return {
      id,
      status: "skipped",
      error: "Sitemap check requires crawl output.",
      durationMs: 0,
    };
  }

  return runRegisteredCheck(context, id);
}

export async function runCheck(id: CheckId, options: RunChecksOptions): Promise<CheckExecutionResult> {
  const context: CheckRunContext = {
    startUrl: options.startUrl,
    outputs: {},
    options,
  };
  return executeCheck(context, id);
}

export async function probeStartUrlRedirect(startUrl: string): Promise<RedirectCheckResult> {
  return runRedirectCheck(startUrl);
}

export async function runChecks(options: RunChecksOptions): Promise<RunChecksResult> {
  const requestedChecks = options.checks ?? DEFAULT_CHECK_IDS;
  const context: CheckRunContext = {
    startUrl: options.startUrl,
    outputs: {},
    options,
  };
  const results: CheckExecutionResult[] = [];

  const redirect = await runRedirectCheck(options.startUrl);
  context.outputs.redirect = redirect;

  const effectiveChecks = resolveChecksForRedirect(requestedChecks, redirect);
  const skippedChecks = checksSkippedByRedirect(requestedChecks, effectiveChecks);
  const skipMessage = "Skipped because the start URL is a domain redirect (use --checks crawl to force a crawl).";

  for (const id of skippedChecks) {
    results.push(skippedResult(id, skipMessage));
  }

  const waves = planCheckWaves(effectiveChecks);

  for (const wave of waves) {
    const waveResults =
      options.parallel && wave.length > 1
        ? await Promise.all(wave.map((id) => executeCheck(context, id)))
        : await wave.reduce<Promise<CheckExecutionResult[]>>(async (accPromise, id) => {
            const acc = await accPromise;
            acc.push(await executeCheck(context, id));
            return acc;
          }, Promise.resolve([]));

    results.push(...waveResults);

    const failedRequired = waveResults.find(
      (result) => result.status === "failure" && result.id === "crawl" && effectiveChecks.includes("analyze")
    );
    if (failedRequired) {
      break;
    }
  }

  return {
    results,
    outputs: context.outputs,
    redirectOnly: redirect.redirectOnly,
  };
}

export { CHECK_DEFINITIONS, getCheckDefinition, listChecks, listImplementedChecks, analyzeRedirect, resolveChecksForRedirect };

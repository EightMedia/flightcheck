import * as nodeDns from "node:dns";
import { issue, type CheckIssue } from "./issues.js";

export type DnsRecords = {
  a: string[];
  aaaa: string[];
  cname: string[];
  mx: Array<{ exchange: string; priority: number }>;
  txt: string[];
  ns: string[];
};

export type DnsMailSignals = {
  spf?: string;
  dmarc?: string;
};

export type DnsCheckResult = {
  hostname: string;
  records: DnsRecords;
  mail: DnsMailSignals;
  issues: CheckIssue[];
};

function parseHostname(input: string): string {
  try {
    const url = input.includes("://") ? new URL(input) : new URL(`https://${input}`);
    return url.hostname;
  } catch {
    return input;
  }
}

async function resolveOptional<T>(resolver: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await resolver();
  } catch {
    return fallback;
  }
}

function flattenTxtRecords(records: string[][]): string[] {
  return records.map((parts) => parts.join(""));
}

function findSpf(txtRecords: string[]): string | undefined {
  return txtRecords.find((record) => record.toLowerCase().startsWith("v=spf1"));
}

function findDmarc(hostname: string, txtRecords: string[]): string | undefined {
  const fromRoot = txtRecords.find((record) => record.toUpperCase().includes("V=DMARC1"));
  if (fromRoot) return fromRoot;
  return undefined;
}

async function resolveDmarc(hostname: string): Promise<string | undefined> {
  try {
    const records = await nodeDns.promises.resolveTxt(`_dmarc.${hostname}`);
    const flat = flattenTxtRecords(records);
    return flat.find((record) => record.toUpperCase().includes("V=DMARC1"));
  } catch {
    return undefined;
  }
}

export async function analyzeDnsRecords(input: string): Promise<DnsCheckResult> {
  const hostname = parseHostname(input);
  const issues: CheckIssue[] = [];

  const [a, aaaa, cname, mx, txt, ns] = await Promise.all([
    resolveOptional(() => nodeDns.promises.resolve4(hostname), [] as string[]),
    resolveOptional(() => nodeDns.promises.resolve6(hostname), [] as string[]),
    resolveOptional(() => nodeDns.promises.resolveCname(hostname), [] as string[]),
    resolveOptional(() => nodeDns.promises.resolveMx(hostname), [] as Array<{ exchange: string; priority: number }>),
    resolveOptional(() => nodeDns.promises.resolveTxt(hostname), [] as string[][]),
    resolveOptional(() => nodeDns.promises.resolveNs(hostname), [] as string[]),
  ]);

  const flatTxt = flattenTxtRecords(txt);
  const spf = findSpf(flatTxt);
  const dmarc = (await resolveDmarc(hostname)) ?? findDmarc(hostname, flatTxt);

  if (!spf) {
    issues.push(issue("missing-spf", "warning", "No SPF TXT record found."));
  }

  if (!dmarc) {
    issues.push(issue("missing-dmarc", "warning", "No DMARC TXT record found."));
  }

  return {
    hostname,
    records: {
      a,
      aaaa,
      cname,
      mx,
      txt: flatTxt,
      ns,
    },
    mail: { spf, dmarc },
    issues,
  };
}

export async function runDnsCheck(startUrl: string): Promise<DnsCheckResult> {
  return analyzeDnsRecords(startUrl);
}

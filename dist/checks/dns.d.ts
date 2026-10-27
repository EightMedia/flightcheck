import { type CheckIssue } from "./issues.js";
export type DnsRecords = {
    a: string[];
    aaaa: string[];
    cname: string[];
    mx: Array<{
        exchange: string;
        priority: number;
    }>;
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
export declare function analyzeDnsRecords(input: string): Promise<DnsCheckResult>;
export declare function runDnsCheck(startUrl: string): Promise<DnsCheckResult>;
//# sourceMappingURL=dns.d.ts.map
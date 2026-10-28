import * as nodeDns from "node:dns";
import { isPlatformPreviewHostname } from "../crawler/urlUtils.js";
import { issue } from "./issues.js";
function parseHostname(input) {
    try {
        const url = input.includes("://") ? new URL(input) : new URL(`https://${input}`);
        return url.hostname;
    }
    catch {
        return input;
    }
}
async function resolveOptional(resolver, fallback) {
    try {
        return await resolver();
    }
    catch {
        return fallback;
    }
}
function flattenTxtRecords(records) {
    return records.map((parts) => parts.join(""));
}
function findSpf(txtRecords) {
    return txtRecords.find((record) => record.toLowerCase().startsWith("v=spf1"));
}
function findDmarc(hostname, txtRecords) {
    const fromRoot = txtRecords.find((record) => record.toUpperCase().includes("V=DMARC1"));
    if (fromRoot)
        return fromRoot;
    return undefined;
}
async function resolveDmarc(hostname) {
    try {
        const records = await nodeDns.promises.resolveTxt(`_dmarc.${hostname}`);
        const flat = flattenTxtRecords(records);
        return flat.find((record) => record.toUpperCase().includes("V=DMARC1"));
    }
    catch {
        return undefined;
    }
}
export async function analyzeDnsRecords(input) {
    const hostname = parseHostname(input);
    const issues = [];
    const [a, aaaa, cname, mx, txt, ns] = await Promise.all([
        resolveOptional(() => nodeDns.promises.resolve4(hostname), []),
        resolveOptional(() => nodeDns.promises.resolve6(hostname), []),
        resolveOptional(() => nodeDns.promises.resolveCname(hostname), []),
        resolveOptional(() => nodeDns.promises.resolveMx(hostname), []),
        resolveOptional(() => nodeDns.promises.resolveTxt(hostname), []),
        resolveOptional(() => nodeDns.promises.resolveNs(hostname), []),
    ]);
    const flatTxt = flattenTxtRecords(txt);
    const spf = findSpf(flatTxt);
    const dmarc = (await resolveDmarc(hostname)) ?? findDmarc(hostname, flatTxt);
    const skipMailAuthIssues = isPlatformPreviewHostname(hostname);
    if (!skipMailAuthIssues && !spf) {
        issues.push(issue("missing-spf", "warning", "No SPF TXT record found.", `Add a TXT record on ${hostname} starting with \`v=spf1\` that lists your mail senders.`));
    }
    if (!skipMailAuthIssues && !dmarc) {
        issues.push(issue("missing-dmarc", "warning", "No DMARC TXT record found.", `Add a TXT record on \`_dmarc.${hostname}\` starting with \`v=DMARC1;\` (for example \`p=none; rua=mailto:dmarc@${hostname}\`).`));
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
export async function runDnsCheck(startUrl) {
    return analyzeDnsRecords(startUrl);
}

import * as cheerio from "cheerio";
function textOrEmpty(value) {
    return (value ?? "").trim();
}
export function buildAnalyzeItemsFromHtml(html, pageUrl) {
    const $ = cheerio.load(html);
    const scriptSrc = [];
    const scripts = [];
    const meta = {};
    $("script[src]").each((_, element) => {
        const src = textOrEmpty($(element).attr("src"));
        if (src)
            scriptSrc.push(src);
    });
    $("script:not([src])").each((_, element) => {
        const content = $(element).html();
        if (content)
            scripts.push(content);
    });
    $("meta").each((_, element) => {
        const name = textOrEmpty($(element).attr("name") || $(element).attr("property")).toLowerCase();
        const content = textOrEmpty($(element).attr("content"));
        if (!name || !content)
            return;
        meta[name] = meta[name] ?? [];
        meta[name].push(content);
    });
    return {
        html,
        text: [html],
        scripts,
        scriptSrc,
        url: pageUrl,
        meta,
        dom: true,
    };
}
export function buildAnalyzeItemsFromHeaders(headers) {
    const normalized = {};
    for (const [key, value] of Object.entries(headers)) {
        normalized[key.toLowerCase()] = [value];
    }
    return { headers: normalized };
}
export function buildAnalyzeItemsFromDns(records) {
    const dns = {
        cname: records.cname,
        ns: records.ns,
        mx: records.mx.map((entry) => entry.exchange),
        txt: records.txt,
    };
    return { dns };
}
export function buildAnalyzeItemsFromRobots(body) {
    return { robots: body };
}

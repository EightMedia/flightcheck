import * as cheerio from "cheerio";
function collectHtmlSignals(html, pageUrl) {
    const $ = cheerio.load(html);
    const scriptSrc = [];
    const inlineScripts = [];
    const linkHrefs = [];
    const meta = {};
    $("script[src]").each((_, element) => {
        const src = ($(element).attr("src") ?? "").trim();
        if (src)
            scriptSrc.push(src);
    });
    $("script:not([src])").each((_, element) => {
        const content = $(element).html();
        if (content?.trim())
            inlineScripts.push(content);
    });
    $("link[href]").each((_, element) => {
        const href = ($(element).attr("href") ?? "").trim();
        if (href)
            linkHrefs.push(href);
    });
    $("meta").each((_, element) => {
        const name = ($(element).attr("name") || $(element).attr("property") || "").trim().toLowerCase();
        const content = ($(element).attr("content") ?? "").trim();
        if (name && content)
            meta[name] = content;
    });
    return { html, pageUrl, scriptSrc, inlineScripts, meta, linkHrefs };
}
function includesAny(haystack, needles) {
    const lower = haystack.toLowerCase();
    for (const needle of needles) {
        if (lower.includes(needle.toLowerCase()))
            return needle;
    }
    return null;
}
function scriptSrcMatch(signals, patterns) {
    for (const src of signals.scriptSrc) {
        const hit = includesAny(src, patterns);
        if (hit)
            return src;
    }
    return null;
}
function htmlMatch(signals, patterns) {
    for (const pattern of patterns) {
        const match = pattern.exec(signals.html);
        if (match)
            return match;
    }
    return null;
}
const HTML_RULES = [
    // Frameworks
    {
        name: "Next.js",
        category: "Framework",
        website: "https://nextjs.org",
        confidence: "high",
        detect: (signals) => {
            if (signals.html.includes("__NEXT_DATA__"))
                return { evidence: "html: `__NEXT_DATA__`" };
            if (signals.html.includes("data-next-head"))
                return { evidence: "html: `data-next-head`" };
            if (signals.html.includes('id="__next"'))
                return { evidence: "html: `#__next` root" };
            const src = scriptSrcMatch(signals, ["/_next/static/"]);
            if (src)
                return { evidence: `script: \`${src}\`` };
            return null;
        },
    },
    {
        name: "Nuxt",
        category: "Framework",
        website: "https://nuxt.com",
        confidence: "high",
        detect: (signals) => {
            if (signals.html.includes("__NUXT__"))
                return { evidence: "html: `__NUXT__`" };
            const src = scriptSrcMatch(signals, ["/_nuxt/"]);
            if (src)
                return { evidence: `script: \`${src}\`` };
            return null;
        },
    },
    {
        name: "Gatsby",
        category: "Framework",
        website: "https://www.gatsbyjs.com",
        confidence: "high",
        detect: (signals) => {
            if (signals.html.includes("___gatsby"))
                return { evidence: "html: `___gatsby`" };
            const src = scriptSrcMatch(signals, ["gatsby"]);
            if (src)
                return { evidence: `script: \`${src}\`` };
            return null;
        },
    },
    {
        name: "Remix",
        category: "Framework",
        website: "https://remix.run",
        confidence: "high",
        detect: (signals) => {
            if (signals.html.includes("__remixContext"))
                return { evidence: "html: `__remixContext`" };
            return null;
        },
    },
    {
        name: "Astro",
        category: "Framework",
        website: "https://astro.build",
        confidence: "high",
        detect: (signals) => {
            if (signals.html.includes("astro-island"))
                return { evidence: "html: `astro-island`" };
            const src = scriptSrcMatch(signals, ["/_astro/"]);
            if (src)
                return { evidence: `script: \`${src}\`` };
            return null;
        },
    },
    {
        name: "Angular",
        category: "Framework",
        website: "https://angular.io",
        confidence: "high",
        detect: (signals) => {
            if (/ng-version\s*=\s*["'][\d.]+["']/i.test(signals.html)) {
                const match = signals.html.match(/ng-version\s*=\s*["']([\d.]+)["']/i);
                return { evidence: "html: `ng-version`", version: match?.[1] };
            }
            if (signals.html.includes("ng-app"))
                return { evidence: "html: `ng-app`" };
            const src = scriptSrcMatch(signals, ["angular.min.js", "angular.js", "@angular/"]);
            if (src)
                return { evidence: `script: \`${src}\`` };
            return null;
        },
    },
    {
        name: "Vue",
        category: "Framework",
        website: "https://vuejs.org",
        confidence: "high",
        detect: (signals) => {
            if (signals.html.includes("data-v-"))
                return { evidence: "html: scoped `data-v-*` attributes" };
            const src = scriptSrcMatch(signals, ["vue.global", "vue.runtime", "/vue@", "vue.min.js"]);
            if (src)
                return { evidence: `script: \`${src}\`` };
            return null;
        },
    },
    {
        name: "SvelteKit",
        category: "Framework",
        website: "https://kit.svelte.dev",
        confidence: "high",
        detect: (signals) => {
            if (signals.html.includes("__sveltekit"))
                return { evidence: "html: `__sveltekit`" };
            return null;
        },
    },
    // CMS
    {
        name: "WordPress",
        category: "CMS",
        website: "https://wordpress.org",
        confidence: "high",
        detect: (signals) => {
            const generator = signals.meta.generator ?? "";
            if (/wordpress/i.test(generator)) {
                const version = generator.match(/WordPress\s+([\d.]+)/i)?.[1];
                return { evidence: `meta generator: \`${generator}\``, version };
            }
            if (includesAny(signals.html, ["/wp-content/", "/wp-includes/"])) {
                return { evidence: "html: WordPress asset paths (`/wp-content/` or `/wp-includes/`)" };
            }
            return null;
        },
    },
    {
        name: "Sanity",
        category: "CMS",
        website: "https://www.sanity.io",
        confidence: "high",
        detect: (signals) => {
            const hit = includesAny(signals.html, ["cdn.sanity.io", "sanity.io", "sanity-cdn"]) ??
                scriptSrcMatch(signals, ["sanity.io", "@sanity/"]);
            if (hit)
                return { evidence: `Sanity CDN or script: \`${hit}\`` };
            return null;
        },
    },
    {
        name: "Contentful",
        category: "CMS",
        website: "https://www.contentful.com",
        confidence: "high",
        detect: (signals) => {
            const hit = includesAny(signals.html, ["ctfassets.net", "contentful.com"]);
            if (hit)
                return { evidence: `Contentful asset host: \`${hit}\`` };
            return null;
        },
    },
    {
        name: "Storyblok",
        category: "CMS",
        website: "https://www.storyblok.com",
        confidence: "high",
        detect: (signals) => {
            const hit = includesAny(signals.html, ["a.storyblok.com", "storyblok.com"]);
            if (hit)
                return { evidence: `Storyblok CDN: \`${hit}\`` };
            return null;
        },
    },
    {
        name: "Shopify",
        category: "CMS",
        website: "https://www.shopify.com",
        confidence: "high",
        detect: (signals) => {
            if (signals.html.includes("Shopify.theme"))
                return { evidence: "script: `Shopify.theme`" };
            const hit = includesAny(signals.html, ["cdn.shopify.com", "myshopify.com"]);
            if (hit)
                return { evidence: `Shopify CDN: \`${hit}\`` };
            return null;
        },
    },
    {
        name: "Drupal",
        category: "CMS",
        website: "https://www.drupal.org",
        confidence: "high",
        detect: (signals) => {
            const generator = signals.meta.generator ?? "";
            if (/drupal/i.test(generator))
                return { evidence: `meta generator: \`${generator}\`` };
            const src = scriptSrcMatch(signals, ["drupal.js"]);
            if (src)
                return { evidence: `script: \`${src}\`` };
            return null;
        },
    },
    {
        name: "Webflow",
        category: "CMS",
        website: "https://webflow.com",
        confidence: "high",
        detect: (signals) => {
            if (signals.html.includes("data-wf-site"))
                return { evidence: "html: `data-wf-site`" };
            const src = scriptSrcMatch(signals, ["webflow.js", "assets.website-files.com"]);
            if (src)
                return { evidence: `script: \`${src}\`` };
            return null;
        },
    },
    {
        name: "Prismic",
        category: "CMS",
        website: "https://prismic.io",
        confidence: "high",
        detect: (signals) => {
            const hit = includesAny(signals.html, ["prismic.io", "prismiccdn.net"]);
            if (hit)
                return { evidence: `Prismic CDN: \`${hit}\`` };
            return null;
        },
    },
    // Search
    {
        name: "Algolia",
        category: "Search",
        website: "https://www.algolia.com",
        confidence: "high",
        detect: (signals) => {
            const hit = includesAny(signals.html, ["algolia.net", "algolianet.com", "algolia.com"]) ??
                scriptSrcMatch(signals, ["algoliasearch", "instantsearch"]);
            if (hit)
                return { evidence: `Algolia: \`${hit}\`` };
            return null;
        },
    },
    {
        name: "Meilisearch",
        category: "Search",
        website: "https://www.meilisearch.com",
        confidence: "high",
        detect: (signals) => {
            const hit = scriptSrcMatch(signals, ["meilisearch", "@meilisearch/"]);
            if (hit)
                return { evidence: `script: \`${hit}\`` };
            return null;
        },
    },
    {
        name: "Typesense",
        category: "Search",
        website: "https://typesense.org",
        confidence: "high",
        detect: (signals) => {
            const hit = includesAny(signals.html, ["typesense.org", "typesense.net"]);
            if (hit)
                return { evidence: `Typesense: \`${hit}\`` };
            return null;
        },
    },
];
const IMPLIED = {
    "Next.js": [{ name: "Node.js", category: "Platform", confidence: "medium", evidence: "implied by Next.js" }],
    Nuxt: [{ name: "Node.js", category: "Platform", confidence: "medium", evidence: "implied by Nuxt" }],
    Gatsby: [{ name: "Node.js", category: "Platform", confidence: "medium", evidence: "implied by Gatsby" }],
    Remix: [{ name: "Node.js", category: "Platform", confidence: "medium", evidence: "implied by Remix" }],
    Astro: [{ name: "Node.js", category: "Platform", confidence: "medium", evidence: "implied by Astro" }],
    WordPress: [{ name: "PHP", category: "Platform", confidence: "high", evidence: "implied by WordPress" }],
    Drupal: [{ name: "PHP", category: "Platform", confidence: "high", evidence: "implied by Drupal" }],
};
const EXCLUDES = {
    "Next.js": ["React"],
    Nuxt: ["Vue"],
    Gatsby: ["React"],
    Remix: ["React"],
};
const HEADER_RULES = [
    {
        name: "Vercel",
        category: "Hosting",
        website: "https://vercel.com",
        confidence: "high",
        detect: (headers) => (headers["x-vercel-id"] ? { evidence: `header: x-vercel-id` } : null),
    },
    {
        name: "Netlify",
        category: "Hosting",
        website: "https://www.netlify.com",
        confidence: "high",
        detect: (headers) => {
            const server = headers.server ?? "";
            if (/netlify/i.test(server))
                return { evidence: `header: server \`${server}\`` };
            if (headers["x-nf-request-id"])
                return { evidence: "header: x-nf-request-id" };
            return null;
        },
    },
    {
        name: "Cloudflare",
        category: "CDN",
        website: "https://www.cloudflare.com",
        confidence: "high",
        detect: (headers) => {
            if (headers["cf-ray"])
                return { evidence: `header: cf-ray \`${headers["cf-ray"]}\`` };
            const server = headers.server ?? "";
            if (/cloudflare/i.test(server))
                return { evidence: `header: server \`${server}\`` };
            return null;
        },
    },
    {
        name: "AWS CloudFront",
        category: "CDN",
        website: "https://aws.amazon.com/cloudfront/",
        confidence: "high",
        detect: (headers) => (headers["x-amz-cf-id"] ? { evidence: "header: x-amz-cf-id" } : null),
    },
    {
        name: "PHP",
        category: "Platform",
        website: "https://php.net",
        confidence: "high",
        detect: (headers) => {
            const powered = headers["x-powered-by"] ?? "";
            if (/php/i.test(powered)) {
                const version = powered.match(/PHP\/([\d.]+)/i)?.[1];
                return { evidence: `header: x-powered-by \`${powered}\``, version };
            }
            return null;
        },
    },
    {
        name: "Node.js",
        category: "Platform",
        website: "https://nodejs.org",
        confidence: "medium",
        detect: (headers) => {
            const powered = headers["x-powered-by"] ?? "";
            if (/express/i.test(powered))
                return { evidence: `header: x-powered-by \`${powered}\`` };
            return null;
        },
    },
    {
        name: "Ruby on Rails",
        category: "Platform",
        website: "https://rubyonrails.org",
        confidence: "high",
        detect: (headers) => {
            const powered = headers["x-powered-by"] ?? "";
            if (/phusion passenger|rails/i.test(powered)) {
                return { evidence: `header: x-powered-by \`${powered}\`` };
            }
            return null;
        },
    },
    {
        name: "ASP.NET",
        category: "Platform",
        website: "https://dotnet.microsoft.com/apps/aspnet",
        confidence: "high",
        detect: (headers) => {
            const powered = headers["x-powered-by"] ?? "";
            if (/asp\.net/i.test(powered))
                return { evidence: `header: x-powered-by \`${powered}\`` };
            if (headers["x-aspnet-version"])
                return { evidence: `header: x-aspnet-version` };
            return null;
        },
    },
];
const DNS_RULES = [
    {
        name: "Vercel",
        category: "Hosting",
        website: "https://vercel.com",
        confidence: "high",
        detect: ({ cname }) => {
            const hit = cname.find((value) => /vercel\.app/i.test(value));
            return hit ? { evidence: `dns cname: \`${hit}\`` } : null;
        },
    },
    {
        name: "Netlify",
        category: "Hosting",
        website: "https://www.netlify.com",
        confidence: "high",
        detect: ({ cname }) => {
            const hit = cname.find((value) => /\.netlify\.(app|com)/i.test(value));
            return hit ? { evidence: `dns cname: \`${hit}\`` } : null;
        },
    },
    {
        name: "Cloudflare",
        category: "CDN",
        website: "https://www.cloudflare.com",
        confidence: "medium",
        detect: ({ ns }) => {
            const hit = ns.find((value) => /cloudflare\.com/i.test(value));
            return hit ? { evidence: `dns ns: \`${hit}\`` } : null;
        },
    },
];
function normalizeHeaders(headers) {
    return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
}
function applyImpliesAndExcludes(detections) {
    const byName = new Map(detections.map((detection) => [detection.name, detection]));
    for (const detection of [...detections]) {
        for (const implied of IMPLIED[detection.name] ?? []) {
            if (byName.has(implied.name))
                continue;
            const entry = {
                name: implied.name,
                categories: [implied.category],
                confidence: implied.confidence,
                evidence: [implied.evidence],
                detector: "flightcheck-v1",
            };
            byName.set(implied.name, entry);
            detections.push(entry);
        }
    }
    const excluded = new Set();
    for (const detection of detections) {
        for (const name of EXCLUDES[detection.name] ?? []) {
            excluded.add(name);
        }
    }
    return detections.filter((detection) => !excluded.has(detection.name));
}
function toDetection(name, category, confidence, match, website) {
    return {
        name,
        categories: [category],
        confidence,
        evidence: [match.evidence],
        website,
        version: match.version,
        detector: "flightcheck-v1",
    };
}
export function detectStackFromHtml(html, pageUrl) {
    if (!html.trim())
        return [];
    const signals = collectHtmlSignals(html, pageUrl);
    const detections = [];
    for (const rule of HTML_RULES) {
        const match = rule.detect(signals);
        if (!match)
            continue;
        detections.push(toDetection(rule.name, rule.category, rule.confidence, match, rule.website));
    }
    // Platform signals from HTML (only when not already implied)
    const railsMeta = htmlMatch(signals, [/name=["']csrf-token["']/i, /data-turbo/i]);
    if (railsMeta) {
        detections.push({
            name: "Ruby on Rails",
            categories: ["Platform"],
            confidence: "high",
            evidence: [`html: \`${railsMeta[0]}\``],
            website: "https://rubyonrails.org",
            detector: "flightcheck-v1",
        });
    }
    const djangoToken = htmlMatch(signals, [/name=["']csrfmiddlewaretoken["']/i]);
    if (djangoToken) {
        detections.push({
            name: "Django",
            categories: ["Platform"],
            confidence: "high",
            evidence: [`html: \`${djangoToken[0]}\``],
            website: "https://www.djangoproject.com",
            detector: "flightcheck-v1",
        });
    }
    const aspViewState = signals.html.includes("__VIEWSTATE");
    if (aspViewState) {
        detections.push({
            name: "ASP.NET",
            categories: ["Platform"],
            confidence: "high",
            evidence: ["html: `__VIEWSTATE`"],
            website: "https://dotnet.microsoft.com/apps/aspnet",
            detector: "flightcheck-v1",
        });
    }
    const phpPath = scriptSrcMatch(signals, [".php"]) ??
        (signals.linkHrefs.find((href) => /\.php(\?|$)/i.test(href)) ?? null);
    if (phpPath && !detections.some((item) => item.name === "PHP")) {
        detections.push({
            name: "PHP",
            categories: ["Platform"],
            confidence: "medium",
            evidence: [`asset: \`${phpPath}\``],
            website: "https://php.net",
            detector: "flightcheck-v1",
        });
    }
    return applyImpliesAndExcludes(detections);
}
export function detectStackFromHeaders(headers) {
    const normalized = normalizeHeaders(headers);
    const detections = [];
    for (const rule of HEADER_RULES) {
        const match = rule.detect(normalized);
        if (!match)
            continue;
        detections.push(toDetection(rule.name, rule.category, rule.confidence, match, rule.website));
    }
    return applyImpliesAndExcludes(detections);
}
export function detectStackFromDns(records) {
    const normalized = {
        cname: records.cname,
        ns: records.ns,
        mx: records.mx.map((entry) => entry.exchange),
        txt: records.txt,
    };
    const detections = [];
    for (const rule of DNS_RULES) {
        const match = rule.detect(normalized);
        if (!match)
            continue;
        detections.push(toDetection(rule.name, rule.category, rule.confidence, match, rule.website));
    }
    return applyImpliesAndExcludes(detections);
}
export function detectStackFromRobots(_body) {
    return [];
}
export const CURATED_STACK_NAMES = new Set([
    ...HTML_RULES.map((rule) => rule.name),
    ...HEADER_RULES.map((rule) => rule.name),
    ...DNS_RULES.map((rule) => rule.name),
    "Node.js",
    "PHP",
    "Ruby on Rails",
    "Django",
    "ASP.NET",
]);
export function isCuratedStackName(name) {
    return CURATED_STACK_NAMES.has(name);
}

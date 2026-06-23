# Flightcheck Analyze Script

Deze script leest een crawl JSON-bestand en maakt een Markdown TODO-rapport met ontbrekende attributen.

De hoofd-CLI (`flightcheck`) genereert dit rapport standaard na elke crawl. Gebruik dit
standalone script alleen als je een bestaand JSON-bestand opnieuw wilt analyseren zonder
opnieuw te crawlen.

## Doel

- Actiegerichte TODO-lijsten maken voor developers of AI agents.
- Issues groeperen op waar ze gefixt moeten worden: site-wide, template, of per pagina.
- Duidelijk maken hoe breed een issue voorkomt over alle gescande pagina's.

## Gebruik

```bash
pnpm run analyze -- ./flightcheck/20260618.1413-eight.nl-raw.json
```

Alleen fouten en missende velden opnemen:

```bash
pnpm run analyze -- ./flightcheck/20260618.1413-eight.nl-raw.json --errors-only
```

Zonder `--output` wordt het Markdown-bestand afgeleid van de input: `-raw.json` wordt
`-report.md`. Dezelfde basename krijgt ook `-fix-manifest.json` en `-agent-jobs/` voor
agent-orchestratie (automatisch tijdens analyze).

## Output-structuur

Het rapport is opgebouwd voor AI agents en developers. Werk het van boven naar beneden af.

Het rapport opent met een titelblok: een `# Flightcheck TODO Report` heading, gevolgd door
een `Generated:`-regel (ISO-timestamp) en een `Input:`-regel met het pad naar het
geanalyseerde JSON-bestand.

## Summary

Korte telling: hoeveel pagina's gescand, hoeveel pagina's issues hebben, site-wide fixes,
welke templates fixes nodig hebben, en een **Issues summary** per categorie.

Voorbeeld:

```markdown
- Pages analyzed: 24
- Pages with issues: 13
- Site-wide fixes: 3
- Templates that need fixes: `work`, `blog`
- Pages with page-specific fixes: 5

### Issues summary

- **Infra:** 4 issue(s) — DNS (1 issue(s)), security headers (2 issue(s)), robots.txt (1 issue(s))
- **SEO:** 42 issue(s) on 18 page(s)
- **A11y:** 8 issue(s) on 6 page(s) — image alt + static hints
- **Best practices:** 3 issue(s) on 2 page(s) — landmarks, robots, template meta
- **Security:** 2 finding(s) on 1 page(s)
- **Performance:** not checked
```

Categorieën:

| Categorie | Bron | Voorbeelden |
| --- | --- | --- |
| **Infra** | Tier 1 checks | Redirect, DNS, security headers, robots.txt, sitemap |
| **SEO** | Crawl metadata | Ontbrekende title, meta, OG, Twitter, canonical, favicon |
| **A11y** | Crawl groups `images` + `a11y-static` | Image alt, heading hierarchy, form labels, lang, tabindex |
| **Best practices** | Crawl warnings | Main landmark, noindex/nofollow, template meta tag |
| **Security** | Crawl secrets scan | Alleen getoond wanneer secrets gevonden |
| **Performance** | `lighthouse` / `performance` check (planned) | `not checked` tot Tier 3 actief is |

## How to use this report

Stappenplan om iteratief te verbeteren. Staat direct onder de summary zodat je de fix-volgorde
kent voordat je de todo-secties doorloopt.

## Issue coverage

Referentietabel: hoe vaak elk issue voorkomt en of het site-wide, template-scoped of
page-specific is. Staat bovenaan als overzicht voordat je aan de fixes begint.

Voorbeeld:

```markdown
- `colorScheme`: 20/20 pages (site-wide)
- `h1`: 1/20 pages (page-specific)
```

## 🔑 Security

Secrets/API-keys per URL (severity `critical` eerst). Bij gemaskeerde waarden staat een hint
om opnieuw te crawlen met `--reveal-secrets`.

## DNS

Overzicht van A/MX/NS-records, SPF/DMARC-signalen en actionable todos voor ontbrekende mail-security
records.

## Stack

Wordt als `## Stack` heading binnen het infra-blok geplaatst, direct na de DNS-sectie en vóór
security headers en robots.txt. Informatieve sectie met gedetecteerde hosting, framework, CMS,
backend-services en tracking-scripts. Geaggregeerd uit de crawl-records via
`aggregateStackFromRecords(records)` (of een meegegeven `options.stackProfile`) — niet uit de
Tier 1 security-headers- of DNS-resultaten. Zie [stack.md](./stack.md).

## Security headers

Resultaat van de `security-headers` check: ontbrekende HSTS, CSP, clickjacking-bescherming, enz.

## Robots.txt & sitemap

Resultaat van de `robots-txt` en `sitemap` checks (overgeslagen in redirect-only mode).

Sitemap-vergelijking vereist een exacte match tussen sitemap- en crawl-URL's, inclusief hostname
(apex vs www). Elke afwijking krijgt severity `critical`, met tips over de waarschijnlijke oorzaak
(bijvoorbeeld verkeerde hostname in de sitemap of een falende sitemap-build/cron job).

## Domain redirect

Wanneer de start-URL een HTTP-redirect teruggeeft, schakelt flightcheck over op
redirect-only mode. Het rapport toont statuscode, `Location`, target-bereikbaarheid en
redirect-issues. Daarnaast wordt de alternate host (apex ↔ www) gecontroleerd: de
niet-canonical host moet permanent doorverwijzen naar de canonical host uit de start-URL
(of het redirect-doel). Er wordt niet gecrawld.

## Fix site-wide (all pages)

Issues die op **elke** gescande pagina voorkomen. Fix één keer in root layout, shared head
partial of global SEO config.

Voorbeeld:

```markdown
- [ ] Add color-scheme meta tag to site layout head
- [ ] Add Open Graph meta tags to site layout head: og:url, og:site_name
- [ ] Add Twitter meta tags to site layout head: twitter:card, twitter:title, twitter:description, twitter:image
```

## Fix in templates

Alleen als `<meta name="template">` tags gevonden zijn. Issues die op **alle** pagina's met
dezelfde template voorkomen, maar niet op de hele site. Fix in het template-bestand.

Voorbeeld:

```markdown
### Template: `work` (15 page(s))

- [ ] Add color-scheme meta tag to template head
- [ ] Add Twitter meta tags to template head: twitter:card, twitter:title, twitter:description, twitter:image
```

## Fix per page

Resterende issues per URL — meestal page-specific content. Site-wide en template-fixes worden
hier niet herhaald. Bevat ook Tier 1 crawl-issues zoals ontbrekende image alt-teksten en
statische a11y-hints wanneer de `images` of `a11y-static` crawl groups actief zijn.
Image-alt issues tonen een klikbare markdown-link `[bestandsnaam](url)` wanneer de URL uit `src`,
`srcset`, `<picture>` of Next.js `/_next/image?url=…` te halen is.

## Checks

### Missende velden

Ontbrekende SEO/metadata-velden worden als actionable todo's gerapporteerd. `og.*`- en
`twitter.*`-velden worden gebundeld.

### Robots meta

Een ontbrekende robots meta tag is geen missend veld. Alleen expliciete `noindex`/`nofollow`
(of `none`) geven een todo:

- Site-wide: `Remove noindex from shared robots meta tag in site layout`
- Per page: `Remove noindex from page robots meta tag`

### Template meta

Een ontbrekende `<meta name="template">` tag is geen missend SEO-veld, maar wel een warning.
Flightcheck gebruikt deze tag om issues per template te groeperen in het rapport.

- Site-wide: `Add template meta tag to site layout head — helps flightcheck give better tailored reports`
- Per page: `Add template meta tag to page head — helps flightcheck give better tailored reports`

### Main landmark

Elke pagina moet precies één `<main>` bevatten. Issues worden site-wide, template-wide of
per pagina gerapporteerd.

### Tier 1 checks in analyze

Wanneer je meerdere checks via `runChecks` draait, geeft analyze automatisch Tier 1-output
door uit eerdere waves:

```bash
pnpm run flightcheck -- https://example.com --checks crawl,security-headers,dns,robots-txt,sitemap,analyze --parallel
```

Programmatisch:

```typescript
await runAnalyzeCheck({
  records: crawl.records,
  tier1: {
    securityHeaders,
    dns,
    robotsTxt,
    sitemap,
  },
});
```

## Notes

- Script valideert input tegen het verwachte flightcheck report-schema.
- Bij schemafouten stopt de script met een duidelijke foutmelding.

## AI agents

Voor geautomatiseerde fixes via agents: zie [agent-fixes.md](./agent-fixes.md) (fix manifest,
`*-agent-jobs/` prompts, work packages, PR-conventies, en `prompts/fix/`).

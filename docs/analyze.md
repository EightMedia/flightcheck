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
`-report.md`.

## Output-structuur

Het rapport is opgebouwd voor AI agents en developers. Werk het van boven naar beneden af.

### Summary

Korte telling: hoeveel site-wide fixes, template-fixes en page-specific fixes er zijn. Wanneer Tier 1
checks zijn meegedraaid, bevat de summary ook infra-tellingen (DNS, security headers, robots.txt)
en crawl-gebaseerde image/a11y issues.

### 🔑 Security

Secrets/API-keys per URL (severity `critical` eerst). Bij gemaskeerde waarden staat een hint
om opnieuw te crawlen met `--reveal-secrets`.

### DNS

Overzicht van A/MX/NS-records, SPF/DMARC-signalen en actionable todos voor ontbrekende mail-security
records.

### Security headers

Resultaat van de `security-headers` check: ontbrekende HSTS, CSP, clickjacking-bescherming, enz.

### Robots.txt & sitemap

Resultaat van de `robots-txt` en `sitemap` checks (overgeslagen in redirect-only mode).

### Domain redirect

Wanneer de start-URL een HTTP-redirect teruggeeft, schakelt flightcheck over op
redirect-only mode. Het rapport toont statuscode, `Location`, target-bereikbaarheid en
redirect-issues. Daarnaast wordt de alternate host (apex ↔ www) gecontroleerd: de
niet-canonical host moet permanent doorverwijzen naar de canonical host uit de start-URL
(of het redirect-doel). Er wordt niet gecrawld.

### Fix site-wide (all pages)

Issues die op **elke** gescande pagina voorkomen. Fix één keer in root layout, shared head
partial of global SEO config.

Voorbeeld:

```markdown
- [ ] Add color-scheme meta tag to site layout head
- [ ] Add Open Graph meta tags to site layout head: og:url, og:site_name
- [ ] Add Twitter meta tags to site layout head: twitter:card, twitter:title, twitter:description, twitter:image
```

### Fix in templates

Alleen als `<meta name="template">` tags gevonden zijn. Issues die op **alle** pagina's met
dezelfde template voorkomen, maar niet op de hele site. Fix in het template-bestand.

Voorbeeld:

```markdown
### Template: `work` (15 page(s))

- [ ] Add color-scheme meta tag to template head
- [ ] Add Twitter meta tags to template head: twitter:card, twitter:title, twitter:description, twitter:image
```

### Fix per page

Resterende issues per URL — meestal page-specific content. Site-wide en template-fixes worden
hier niet herhaald. Bevat ook Tier 1 crawl-issues zoals ontbrekende image alt-teksten en
statische a11y-hints wanneer de `images` of `a11y-static` crawl groups actief zijn.

### Issue coverage

Referentietabel: hoe vaak elk issue voorkomt en of het site-wide, template-scoped of
page-specific is.

Voorbeeld:

```markdown
- `colorScheme`: 20/20 pages (site-wide)
- `h1`: 1/20 pages (page-specific)
```

### How to use this report

Stappenplan om iteratief te verbeteren.

## Checks

### Missende velden

Ontbrekende SEO/metadata-velden worden als actionable todo's gerapporteerd. `og.*`- en
`twitter.*`-velden worden gebundeld.

### Robots meta

Een ontbrekende robots meta tag is geen missend veld. Alleen expliciete `noindex`/`nofollow`
(of `none`) geven een todo:

- Site-wide: `Remove noindex from shared robots meta tag in site layout`
- Per page: `Remove noindex from page robots meta tag`

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

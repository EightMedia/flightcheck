# Flightcheck Crawler

Deze crawler verzamelt per URL verificatie-data voor SEO, metadata, tracking en iconen.

## Doel

- Crawlen vanaf een start-URL; sitemap-URL's worden standaard als extra seeds toegevoegd zodat alle pagina's uit de sitemap worden bezocht.
- Schrijven van incrementele JSON output na elke verwerkte URL.
- Deduplicatie op URL zonder query/hash.
- Excludes op URL en pathname.
- Veilige throttling via concurrency, delay en burst delay.

## CLI gebruik

```bash
pnpm run flightcheck -- https://example.com
```

Standaard schrijft flightcheck zowel JSON als een Markdown TODO-rapport in `./flightcheck/`, met
bestandsnamen op basis van timestamp en hostname, bijvoorbeeld:

- `./flightcheck/20260618.1413-eight.nl-raw.json`
- `./flightcheck/20260618.1413-eight.nl-report.md`

De analyze-stap schrijft daarnaast een fix-manifest en een map met agent-jobs naast
het rapport:

- `./flightcheck/20260618.1413-eight.nl-fix-manifest.json`
- `./flightcheck/20260618.1413-eight.nl-agent-jobs/`

Met `--json-only` sla je het Markdown-rapport over.

Belangrijkste flags:

- `--output <file>` default `{timestamp}-{hostname}-raw.json` in `./flightcheck/`
- `--report <file>` default `{timestamp}-{hostname}-report.md` in `./flightcheck/`
- `--json-only` alleen JSON schrijven, geen Markdown-rapport; bij `--json-only` vallen de default-checks terug op alleen `crawl`
- `--errors-only` neem alleen records met errors of ontbrekende attributen op in het rapport
- `--checks <ids>` comma-separated checks; default: all implemented checks (`crawl`, `security-headers`, `dns`, `robots-txt`, `sitemap`, `analyze`)
- `--parallel` run independent checks in the same wave concurrently
- `--max-pages <n>`
- `--delay-ms <n>`
- `--timeout-ms <n>`
- `--concurrency <n>`
- `--burst-delay-ms <n>`
- `--sitemap-start` (legacy) beperkt de initiële seeds tot sitemap-URL's plus de start-URL; standaard worden sitemap-URL's al aan de crawl-queue toegevoegd
- `--sitemap-url <url>`
- `--exclude <pattern1,pattern2>` (herhaalbaar)
- `--respect-robots-txt`
- `--quiet` (onderdrukt Crawlee info/statistics logs; alleen warnings en errors)
- `--only <groups>` draai alleen deze check-groepen (komma-gescheiden)
- `--skip <groups>` sla deze check-groepen over (komma-gescheiden)
- `--reveal-secrets` toon volledige secret-waarden in plaats van gemaskeerde
- `--repo <path>` pad naar de site-repo voor agent-prompt overrides (`.flightcheck/prompts/`)

Voorbeelden:

```bash
pnpm run flightcheck -- https://example.com --max-pages 200 --concurrency 5 --delay-ms 100
pnpm run flightcheck -- https://example.com --sitemap-start
pnpm run flightcheck -- https://example.com --exclude "/search,/preview"
pnpm run flightcheck -- https://example.com --respect-robots-txt
pnpm run flightcheck -- https://example.com --quiet
pnpm run flightcheck -- https://example.com --only security
pnpm run flightcheck -- https://example.com --skip tracking,social
pnpm run flightcheck -- https://example.com --only security --reveal-secrets
```

## Check-groepen

De extractie is opgedeeld in benoemde groepen. Standaard draaien alle groepen; met
`--only` draai je er één of enkele, met `--skip` sluit je groepen uit. `--only` en
`--skip` kunnen niet samen worden gebruikt.

- `meta` — title, h1, description, robots, template, metaTitle, charset, language,
  viewport, doctype, canonical, color-scheme, theme-color, main landmark count.
- `icons` — favicon en icons.
- `social` — Open Graph en Twitter metadata.
- `tracking` — GTM, GA4, UA, Matomo, Facebook Pixel, Plausible.
- `stack` — technology fingerprints via curated rules (see [stack.md](./stack.md)).
- `security` — scan op gelekte API-keys en secrets (zie hieronder).
- `images` — extraheert image-alt problemen naar `images.issues` (missing-alt,
  empty-alt, generic-alt).
- `a11y-static` — statische toegankelijkheidschecks naar `a11yStatic.issues`
  (heading-skip, multiple-h1, missing-lang, unlabeled-input, positive-tabindex).

### Sitemap parsing

`sitemap.xml` can be a **sitemap index** (`<sitemapindex>`) that points to child sitemap files
via nested `<loc>` entries, or a **urlset** with page URLs. The crawler follows sitemap
index files recursively and treats apex and `www` hostnames as the same site (so
`https://eight.nl/sitemap.xml` can discover URLs on `https://www.eight.nl/`).

De `security`-groep scant zowel de pagina-HTML als de gelinkte same-origin
JavaScript-bestanden (`<script src>`) op gelekte API-keys en secrets. Gedeelde
bundles worden per URL gecached en dus maar één keer opgehaald. Bevindingen krijgen
een severity:

- `critical` — hoort nooit in client-code (AWS-keys, Stripe secret keys, GitHub
  tokens, private-key blocks, generieke `secret`/`password` toewijzingen).
- `review` — normaal in client-code maar hoort domein-/referrer-beperkt te zijn
  (Google API-keys, Stripe publishable keys, generieke `apiKey`/`token`).

De providers/patterns zijn: google-api-key (`google`), aws-access-key-id (`aws`),
stripe-secret-key en stripe-publishable-key (`stripe`), github-token (`github`),
private-key, generic-secret en generic-api-key (`generic`).

Secret-waarden worden standaard gemaskeerd (`AIzaSy…BC0Y`). De samenvatting toont dan
een hint om opnieuw te draaien met `--reveal-secrets` voor de volledige waarden.

Wanneer een groep wordt overgeslagen, blijven de bijbehorende velden leeg; de
output-structuur verandert nooit.

## Output schema

Elke record bevat:

- URL en status
- H1/title/meta velden, inclusief `template` (uit `meta[name="template"]`) en `metaTitle`
- `mainCount` (aantal `<main>`-elementen, `null` wanneer meta-groep overgeslagen is)
- canonical/favicon/icons
- OG en Twitter metadata
- tracking detectie (GTM, GA4, UA, Matomo, Facebook Pixel, Plausible)
- `stack.detections` — technology fingerprints per pagina (geaggregeerd in analyze)
- `security` met `secrets` (gevonden keys/secrets) en `scannedAssets` (aantal
  gescande JS-bestanden)
- `images.issues` — image-alt problemen (alleen wanneer de `images`-groep draait)
- `a11yStatic.issues` — statische a11y-bevindingen (alleen wanneer de `a11y-static`-groep draait)
- optionele `note` en `error`

Tekstvelden worden altijd gevuld met een string, dus geen `undefined` of `null`.

Elke `secrets`-bevinding bevat `type`, `provider`, `severity` (`critical` of
`review`), `masked` (gemaskeerde of — met `--reveal-secrets` — volledige waarde) en
`source` (`html` of de URL van het JS-bestand). De afsluitende samenvatting bevat
`secretsFound` (totaal aantal bevindingen) en, bij gemaskeerde output met
bevindingen, een `hint`.

## Architectuur

De CLI draait via de checks-laag (`runChecks` in `src/checks/runner.ts`), die de
crawler aanstuurt; `src/cli.ts` roept dus niet langer `runCrawler` rechtstreeks aan.
De checks-laag plant de checks in waves en levert de crawl- en analyze-output.

- Checks-laag: `src/checks/runner.ts`, `src/checks/crawl.ts`, `src/checks/types.ts`
- Crawl laag: `src/crawler/runCrawler.ts`
- Extract laag: `src/crawler/extractors.ts`, `src/crawler/tier1Extractors.ts`,
  `src/crawler/tracking.ts`, `src/crawler/secrets.ts` en `src/crawler/stack.ts`
- Report laag: `src/crawler/reporter.ts`

Daarnaast:

- URL normalisatie en excludes: `src/crawler/urlUtils.ts`
- Sitemap parsing: `src/crawler/sitemap.ts`
- CLI parsing: `src/cli.ts`

## Gedrag

- Alleen interne links worden gecrawld. Links worden zelf ontdekt via `extractInternalLinks` en toegevoegd aan de queue; er wordt bewust geen `enqueueLinks` van Crawlee gebruikt.
- Sitemap-URL's worden standaard aan de crawl-queue toegevoegd zodat pagina's uit `sitemap.xml` ook worden bezocht, ook wanneer ze niet via interne links bereikbaar zijn.
- `--max-pages` is de harde stop (`maxRequestsPerCrawl`). De crawl stopt zodra dit aantal is verwerkt, ook al zijn er nog niet-bezochte links. Verhoog `--max-pages` om de hele site te crawlen.
- Query parameters en hashes tellen niet mee voor URL-identiteit.
- Non-HTML responses worden gerapporteerd met `note`.
- Links naar bestanden met een bekende non-HTML extensie (zoals `.pdf`, `.zip`, afbeeldingen, video, fonts) worden niet aan de queue toegevoegd, zodat Crawlee geen onnodige retries en errors genereert.
- Met `--respect-robots-txt` worden URLs overgeslagen die door `robots.txt` zijn uitgesloten.
- Na elke URL wordt atomisch geschreven naar outputbestand.
- Bij `SIGINT` stopt de crawl gecontroleerd met behoud van partial output.

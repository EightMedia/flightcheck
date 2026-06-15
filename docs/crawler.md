# Flightcheck Crawler

Deze crawler verzamelt per URL verificatie-data voor SEO, metadata, tracking en iconen.

## Doel

- Crawlen vanaf een start-URL of sitemap-seeds.
- Schrijven van incrementele JSON output na elke verwerkte URL.
- Deduplicatie op URL zonder query/hash.
- Excludes op URL en pathname.
- Veilige throttling via concurrency, delay en burst delay.

## CLI gebruik

```bash
pnpm run crawl -- https://example.com
```

Belangrijkste flags:

- `--output <file>` default `./h1-report.json`
- `--max-pages <n>`
- `--delay-ms <n>`
- `--timeout-ms <n>`
- `--concurrency <n>`
- `--burst-delay-ms <n>`
- `--sitemap-start`
- `--sitemap-url <url>`
- `--exclude <pattern1,pattern2>` (herhaalbaar)
- `--respect-robots-txt`
- `--quiet` (onderdrukt Crawlee info/statistics logs; alleen warnings en errors)
- `--only <groups>` draai alleen deze check-groepen (komma-gescheiden)
- `--skip <groups>` sla deze check-groepen over (komma-gescheiden)
- `--reveal-secrets` toon volledige secret-waarden in plaats van gemaskeerde

Voorbeelden:

```bash
pnpm run crawl -- https://example.com --max-pages 200 --concurrency 5 --delay-ms 100
pnpm run crawl -- https://example.com --sitemap-start
pnpm run crawl -- https://example.com --exclude "/search,/preview"
pnpm run crawl -- https://example.com --respect-robots-txt
pnpm run crawl -- https://example.com --quiet
pnpm run crawl -- https://example.com --only security
pnpm run crawl -- https://example.com --skip tracking,social
pnpm run crawl -- https://example.com --only security --reveal-secrets
```

## Check-groepen

De extractie is opgedeeld in benoemde groepen. Standaard draaien alle groepen; met
`--only` draai je er één of enkele, met `--skip` sluit je groepen uit. `--only` en
`--skip` kunnen niet samen worden gebruikt.

- `meta` — title, h1, description, robots, charset, language, viewport, doctype,
  canonical, color-scheme, theme-color.
- `icons` — favicon en icons.
- `social` — Open Graph en Twitter metadata.
- `tracking` — GTM, GA4, UA, Matomo, Facebook Pixel, Plausible.
- `security` — scan op gelekte API-keys en secrets (zie hieronder).

### Security-scan

De `security`-groep scant zowel de pagina-HTML als de gelinkte same-origin
JavaScript-bestanden (`<script src>`) op gelekte API-keys en secrets. Gedeelde
bundles worden per URL gecached en dus maar één keer opgehaald. Bevindingen krijgen
een severity:

- `critical` — hoort nooit in client-code (AWS-keys, Stripe secret keys, GitHub
  tokens, private-key blocks, generieke `secret`/`password` toewijzingen).
- `review` — normaal in client-code maar hoort domein-/referrer-beperkt te zijn
  (Google API-keys, Firebase config, Stripe publishable keys, generieke
  `apiKey`/`token`).

Secret-waarden worden standaard gemaskeerd (`AIzaSy…BC0Y`). De samenvatting toont dan
een hint om opnieuw te draaien met `--reveal-secrets` voor de volledige waarden.

Wanneer een groep wordt overgeslagen, blijven de bijbehorende velden leeg; de
output-structuur verandert nooit.

## Output schema

Elke record bevat:

- URL en status
- H1/title/meta velden
- canonical/favicon/icons
- OG en Twitter metadata
- tracking detectie (GTM, GA4, UA, Matomo, Facebook Pixel, Plausible)
- `security` met `secrets` (gevonden keys/secrets) en `scannedAssets` (aantal
  gescande JS-bestanden)
- optionele `note` en `error`

Tekstvelden worden altijd gevuld met een string, dus geen `undefined` of `null`.

Elke `secrets`-bevinding bevat `type`, `provider`, `severity` (`critical` of
`review`), `masked` (gemaskeerde of — met `--reveal-secrets` — volledige waarde) en
`source` (`html` of de URL van het JS-bestand). De afsluitende samenvatting bevat
`secretsFound` (totaal aantal bevindingen) en, bij gemaskeerde output met
bevindingen, een `hint`.

## Architectuur

De code is opgesplitst in drie lagen:

- Crawl laag: `src/crawler/runCrawler.ts`
- Extract laag: `src/crawler/extractors.ts` en `src/crawler/tracking.ts`
- Report laag: `src/crawler/reporter.ts`

Daarnaast:

- URL normalisatie en excludes: `src/crawler/urlUtils.ts`
- Sitemap parsing: `src/crawler/sitemap.ts`
- CLI parsing: `src/cli.ts`

## Gedrag

- Alleen interne links worden gecrawld. Links worden zelf ontdekt via `extractInternalLinks` en toegevoegd aan de queue; er wordt bewust geen `enqueueLinks` van Crawlee gebruikt.
- `--max-pages` is de harde stop (`maxRequestsPerCrawl`). De crawl stopt zodra dit aantal is verwerkt, ook al zijn er nog niet-bezochte links. Verhoog `--max-pages` om de hele site te crawlen.
- Query parameters en hashes tellen niet mee voor URL-identiteit.
- Non-HTML responses worden gerapporteerd met `note`.
- Links naar bestanden met een bekende non-HTML extensie (zoals `.pdf`, `.zip`, afbeeldingen, video, fonts) worden niet aan de queue toegevoegd, zodat Crawlee geen onnodige retries en errors genereert.
- Met `--respect-robots-txt` worden URLs overgeslagen die door `robots.txt` zijn uitgesloten.
- Na elke URL wordt atomisch geschreven naar outputbestand.
- Bij `SIGINT` stopt de crawl gecontroleerd met behoud van partial output.

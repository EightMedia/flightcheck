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

Voorbeelden:

```bash
pnpm run crawl -- https://example.com --max-pages 200 --concurrency 5 --delay-ms 100
pnpm run crawl -- https://example.com --sitemap-start
pnpm run crawl -- https://example.com --exclude "/search,/preview"
pnpm run crawl -- https://example.com --respect-robots-txt
```

## Output schema

Elke record bevat:

- URL en status
- H1/title/meta velden
- canonical/favicon/icons
- OG en Twitter metadata
- tracking detectie (GTM, GA4, UA, Matomo, Facebook Pixel, Plausible)
- optionele `note` en `error`

Tekstvelden worden altijd gevuld met een string, dus geen `undefined` of `null`.

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

- Alleen interne links worden gecrawld.
- Query parameters en hashes tellen niet mee voor URL-identiteit.
- Non-HTML responses worden gerapporteerd met `note`.
- Met `--respect-robots-txt` worden URLs overgeslagen die door `robots.txt` zijn uitgesloten.
- Na elke URL wordt atomisch geschreven naar outputbestand.
- Bij `SIGINT` stopt de crawl gecontroleerd met behoud van partial output.

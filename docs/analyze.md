# Flightcheck Analyze Script

Deze script leest een crawl JSON-bestand en maakt een Markdown TODO-rapport met ontbrekende attributen.

## Doel

- Ontbrekende velden per pagina zichtbaar maken.
- Prioriteiten tonen op basis van frequentie van missende velden.
- Een direct bruikbare checklist geven voor developers of AI agents.

## Gebruik

```bash
pnpm run analyze -- ./report.json --output ./todo-report.md
```

Alleen fouten en missende velden opnemen:

```bash
pnpm run analyze -- ./report.json --output ./todo-report.md --errors-only
```

## Output

De output is Markdown met:

- `🔑 Security`: als er secrets/API-keys zijn gevonden, bovenaan een sectie per URL
  met de bevindingen (severity `critical` eerst), inclusief provider, gemaskeerde
  waarde en bron. Bij gemaskeerde waarden staat er een hint om de crawl opnieuw te
  draaien met `--reveal-secrets`.
- `Important warnings`: geaggregeerde lijst van belangrijke waarschuwingen (zie hieronder).
- `Priority overview`: geaggregeerde lijst van missende velden.
- `TODOs by template`: TODO's gebundeld per template (alleen als er template-meta tags gevonden zijn, zie hieronder).
- `Page-level TODO list`: per URL een checklist-item met ontbrekende attributen en waarschuwingen.
- `Suggested workflow`: korte stappen om iteratief te verbeteren.

Met `--errors-only` blijven pagina's met security-bevindingen in het rapport staan,
ook als ze verder geen ontbrekende velden hebben.

## Warnings

Naast missende velden controleert de script op veelvoorkomende fouten die als waarschuwing worden gemarkeerd:

- `noindex`: de pagina heeft een `<meta name="robots">` met `noindex` (of `none`). Zoekmachines wordt verteld de pagina niet te indexeren. Dit is meestal een fout op live pagina's.
- `nofollow`: de pagina heeft een `<meta name="robots">` met `nofollow` (of `none`). Zoekmachines wordt verteld de links op de pagina niet te volgen.

Waarschuwingen worden zowel geaggregeerd (`Important warnings`) als per pagina (`Page-level TODO list`) getoond. Met `--errors-only` blijven pagina's met alleen een waarschuwing ook zichtbaar.

## TODOs by template

Veel van onze sites zetten een `<meta name="template">` tag met de templatenaam als waarde (bijv. `product`, `home`). De crawler leest deze waarde uit in het veld `template`.

Als er minimaal één pagina met een template gevonden is, voegt de script een `TODOs by template`-sectie toe. Daarin worden de TODO's gebundeld per template:

- Pagina's worden gegroepeerd op templatenaam (gesorteerd op aantal pagina's, aflopend).
- Per template worden de waarschuwingen en missende velden geaggregeerd, met de notatie `count/totaal page(s)`.
- Pagina's zonder template komen in de groep `(no template)`.

Zo kun je een probleem dat in een template zit één keer oplossen voor alle pagina's die dat template gebruiken. Het veld `template` wordt ook per pagina in de `Page-level TODO list` getoond.

## Notes

- Script valideert input tegen het verwachte flightcheck report-schema.
- Bij schemafouten stopt de script met een duidelijke foutmelding.

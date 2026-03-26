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

- `Priority overview`: geaggregeerde lijst van missende velden.
- `Page-level TODO list`: per URL een checklist-item met ontbrekende attributen.
- `Suggested workflow`: korte stappen om iteratief te verbeteren.

## Notes

- Script valideert input tegen het verwachte flightcheck report-schema.
- Bij schemafouten stopt de script met een duidelijke foutmelding.

# Upisnica parser fixtures

Each `*.json` file is one form: the recognised text lines going in, and the fields the parser must produce.
The TypeScript parser (`packages/shared/src/upisnica/parser.ts`) and the Swift parser in the iOS app must both pass every file.

```
{
  "description": "what this case is for",
  "lines": [{ "text": "Ime i prezime", "x": 40, "y": 100, "width": 72.8, "height": 12, "confidence": 0.95 }],
  "expected": { "name": "…", "email": "…", …, "needsReview": ["phone"] }
}
```

- Coordinates have their origin at the top-left of the page, in any consistent unit (these use PDF points on A4).
- `confidence` is 0–1 and may be left out, which means 1 (a PDF text layer).
- `expected` holds every output field except `confidence` and `regions`. `needsReview` is in form order.

**These cases were written by hand** from the layout of the digital upisnica in the design system. They cover printed text only.
Handwriting is not read in v1, and neither is the signature (`signaturePresent` is always `false`).
When real filled-in forms are available, add their line dumps here and tune the parser against them.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseUpisnica, REVIEW_BELOW_CONFIDENCE, SCAN_FIELDS, type ScanLine } from '@prana/shared';
import { describe, expect, it } from 'vitest';

interface Fixture {
  description: string;
  lines: ScanLine[];
  expected: Record<string, unknown>;
}

const files = readdirSync(import.meta.dirname).filter((f) => f.endsWith('.json')).sort();

describe('upisnica fixtures', () => {
  it('has cases to run', () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  for (const file of files) {
    const fixture = JSON.parse(readFileSync(join(import.meta.dirname, file), 'utf8')) as Fixture;

    it(`${file}: ${fixture.description}`, () => {
      const { confidence, regions, ...fields } = parseUpisnica(fixture.lines);
      expect(fields).toEqual(fixture.expected);

      // Every field has a confidence, and a low one is always flagged.
      expect(Object.keys(confidence).sort()).toEqual([...SCAN_FIELDS].sort());
      for (const field of SCAN_FIELDS) {
        expect(confidence[field]).toBeGreaterThanOrEqual(0);
        expect(confidence[field]).toBeLessThanOrEqual(1);
        const optional = field === 'healthText' || field === 'news' || field === 'place' || field === 'date';
        if (confidence[field] < REVIEW_BELOW_CONFIDENCE && !optional) expect(fields.needsReview, field).toContain(field);
      }
      // Regions point at something on the page, for the review outlines.
      for (const region of Object.values(regions)) {
        expect(region.width).toBeGreaterThan(0);
        expect(region.height).toBeGreaterThan(0);
      }
    });
  }
});

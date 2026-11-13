import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('firestore.rules', () => {
  it('lets in every owner the preview lets in', () => {
    const preview = read('../../.env.preview').match(/^VITE_OWNER_HASHES=(.*)$/m)?.[1] ?? '';
    const owners = preview.split(',').map((h) => h.trim()).filter(Boolean);
    const rules = read('../../../../firestore.rules');
    const listed = [...rules.matchAll(/'([0-9a-f]{64})'/g)].map((m) => m[1]);
    expect(owners.length).toBeGreaterThan(0);
    for (const hash of owners) expect(listed, `owner ${hash.slice(0, 8)}… is missing from firestore.rules`).toContain(hash);
  });
});

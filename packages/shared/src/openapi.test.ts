import { describe, expect, it } from 'vitest';
import { buildOpenApi, routes } from './openapi';

describe('OpenAPI document', () => {
  const doc = buildOpenApi();
  const text = JSON.stringify(doc);

  it('describes every route', () => {
    for (const route of routes) {
      expect(doc.paths[route.path]?.[route.method], `${route.method} ${route.path}`).toBeDefined();
    }
  });
  it('names the shared types and leaves no dangling references', () => {
    expect(Object.keys(doc.components.schemas)).toEqual(expect.arrayContaining(['Member', 'MemberSummary', 'SessionView', 'Payment', 'Document', 'Error']));
    expect(text).not.toContain('#/$defs/');
    for (const match of text.matchAll(/#\/components\/schemas\/(\w+)/g)) {
      expect(doc.components.schemas[match[1] ?? ''], match[1]).toBeDefined();
    }
  });
  it('never exposes server-only columns', () => {
    expect(text).not.toContain('r2_key');
    expect(text).not.toContain('firebase_uid');
    expect(text).not.toContain('changed_at');
  });
});

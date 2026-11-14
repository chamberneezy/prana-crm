import { describe, expect, it } from 'vitest';
import { AREAS, canEdit, canView, hasFullAccess } from './access';

describe('access', () => {
  it('lets owners do everything', () => {
    for (const area of AREAS) expect(canEdit('owner', area)).toBe(true);
    expect(hasFullAccess('owner')).toBe(true);
  });
  it('shows teachers nothing yet, and never lets them change anything', () => {
    for (const area of AREAS) {
      expect(canView('teacher', area)).toBe(false);
      expect(canEdit('teacher', area)).toBe(false);
    }
    expect(hasFullAccess('teacher')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { joinName, splitFullName } from './text';

describe('names', () => {
  it('splits at the first space', () => {
    expect(splitFullName('Ana Horvat')).toEqual({ first_name: 'Ana', last_name: 'Horvat' });
    expect(splitFullName('  Ivan   Kovač Babić ')).toEqual({ first_name: 'Ivan', last_name: 'Kovač Babić' });
    expect(splitFullName('Madonna')).toEqual({ first_name: 'Madonna', last_name: '' });
  });
  it('joins first and last', () => {
    expect(joinName(' Ana ', 'Horvat')).toBe('Ana Horvat');
    expect(joinName('Madonna', '')).toBe('Madonna');
  });
});

import { describe, expect, it } from 'vitest';
import { newRecordId } from '../src/lib/id';

describe('PocketBase ids', () => {
  it('generates lowercase 15-character record ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => newRecordId()));
    expect(ids.size).toBe(100);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]{15}$/);
  });
});

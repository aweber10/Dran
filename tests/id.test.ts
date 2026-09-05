import { describe, expect, it } from 'vitest';
import { newOperationId, newRecordId } from '../src/lib/id';

describe('PocketBase ids', () => {
  it('generates lowercase 15-character record ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => newRecordId()));
    expect(ids.size).toBe(100);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]{15}$/);
  });

  it('generates UUID-shaped operation ids without randomUUID', () => {
    const id = newOperationId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

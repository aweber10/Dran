import { describe, expect, it } from 'vitest';
import { applyOperations } from '../src/lib/store';
import type { Card, QueuedOperation } from '../src/lib/types';

const base: Card = {
  id: 'card00000000001', title: 'Alt', notes: '', list: 'offen', pos: 'a0',
  assignees: [], due: '', doneAt: '', archived: false
};

const operation = (
  kind: QueuedOperation['kind'],
  cardId: string,
  patch: QueuedOperation['patch'],
  ts: number
): QueuedOperation => ({ opId: `op-${ts}`, kind, cardId, patch, ts });

describe('optimistic card overlays', () => {
  it('preserves a local field over a newer server base while merging unrelated fields', () => {
    const server = { ...base, title: 'Vom Server', assignees: ['member'] };
    const result = applyOperations([server], [operation('update', base.id, { title: 'Lokal' }, 1)]);
    expect(result[0]).toMatchObject({ title: 'Lokal', assignees: ['member'] });
  });

  it('applies queued operations in order', () => {
    const result = applyOperations([base], [
      operation('update', base.id, { list: 'dran' }, 1),
      operation('update', base.id, { title: 'Neu' }, 2),
      operation('delete', base.id, {}, 3)
    ]);
    expect(result).toEqual([]);
  });

  it('renders a client-id create before the server knows it', () => {
    const created = { ...base, id: 'newcard00000001', title: 'Offline' };
    expect(applyOperations([], [operation('create', created.id, created, 1)])).toEqual([created]);
  });
});

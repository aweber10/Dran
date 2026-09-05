import { describe, expect, it } from 'vitest';
import { compareCards, positionAtTop, positionForDrop } from '../src/lib/pos';
import type { Card } from '../src/lib/types';

const card = (id: string, pos: string, list: Card['list'] = 'offen'): Card => ({
  id, pos, list, title: id, notes: '', assignees: [], due: '', doneAt: '', archived: false
});

describe('fractional positions', () => {
  it('creates a key before the first card', () => {
    const next = positionAtTop([card('one', 'a0')], 'offen');
    expect(next < 'a0').toBe(true);
  });

  it('creates a key at and between drop targets', () => {
    const cards = [card('one', 'a0'), card('two', 'a1'), card('three', 'a2')];
    const beforeTwo = positionForDrop(cards, 'offen', 'three', 'two', false);
    expect(beforeTwo > 'a0' && beforeTwo < 'a1').toBe(true);
    const end = positionForDrop(cards, 'offen', 'one', null, true);
    expect(end > 'a2').toBe(true);
  });

  it('uses the id as deterministic tie breaker', () => {
    expect([card('b', 'a0'), card('a', 'a0')].sort(compareCards).map((item) => item.id)).toEqual(['a', 'b']);
  });
});

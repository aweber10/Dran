import { generateKeyBetween } from 'fractional-indexing';
import type { Card, ListKey } from './types';

export function compareCards(a: Card, b: Card): number {
  return a.pos.localeCompare(b.pos) || a.id.localeCompare(b.id);
}

export function positionAtTop(cards: Card[], list: ListKey): string {
  const first = cards.filter((card) => card.list === list).sort(compareCards)[0];
  return generateKeyBetween(null, first?.pos ?? null);
}

export function positionForDrop(
  cards: Card[],
  list: ListKey,
  movingId: string,
  targetId: string | null,
  after = false
): string {
  const ordered = cards
    .filter((card) => card.list === list && card.id !== movingId)
    .sort(compareCards);
  if (!targetId) return generateKeyBetween(ordered.at(-1)?.pos ?? null, null);

  const index = ordered.findIndex((card) => card.id === targetId);
  if (index < 0) return generateKeyBetween(ordered.at(-1)?.pos ?? null, null);
  const insertion = after ? index + 1 : index;
  return generateKeyBetween(ordered[insertion - 1]?.pos ?? null, ordered[insertion]?.pos ?? null);
}

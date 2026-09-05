export const LISTS = ['offen', 'dran', 'fertig'] as const;
export type ListKey = (typeof LISTS)[number];

export const LIST_LABELS: Record<ListKey, string> = {
  offen: 'Offen',
  dran: 'Dran',
  fertig: 'Fertig'
};

export const COLOR_KEYS = ['teal', 'brown', 'green', 'purple', 'rose', 'ochre', 'blue', 'red'] as const;
export type MemberColor = (typeof COLOR_KEYS)[number];

export interface Member {
  id: string;
  name: string;
  color: MemberColor;
  emoji: string;
  user?: string;
  active: boolean;
  created?: string;
  updated?: string;
}

export interface Card {
  id: string;
  title: string;
  notes: string;
  list: ListKey;
  pos: string;
  assignees: string[];
  due: string;
  doneAt: string;
  archived: boolean;
  created?: string;
  updated?: string;
}

export type CardPatch = Partial<Omit<Card, 'id' | 'created' | 'updated'>>;

export interface QueuedOperation {
  opId: string;
  kind: 'create' | 'update' | 'delete';
  cardId: string;
  patch: CardPatch;
  ts: number;
}

export interface ToastMessage {
  id: number;
  text: string;
  undoMove?: { cardId: string; list: ListKey; pos: string };
}

export interface BoardState {
  cards: Card[];
  members: Member[];
  pending: number;
  loading: boolean;
  online: boolean;
  connected: boolean;
  readOnly: boolean;
  selectedList: ListKey;
  filterMemberId: string | null;
  showOlderDone: boolean;
  selectedCardId: string | null;
  toast: ToastMessage | null;
}

import { get, writable } from 'svelte/store';
import { ClientResponseError } from 'pocketbase';
import { pb, isAuthenticated } from './pb';
import {
  deleteCard as deleteCachedCard,
  deleteMember as deleteCachedMember,
  deleteOperation,
  loadCache,
  putCard,
  putMember,
  putOperation,
  replaceCards,
  replaceMembers
} from './db';
import { newOperationId, newRecordId } from './id';
import { compareCards, positionAtTop, positionForDrop } from './pos';
import { isRecentDone, toPocketBaseDate } from './date';
import type { BoardState, Card, CardPatch, ListKey, Member, QueuedOperation } from './types';

const initialState: BoardState = {
  cards: [],
  members: [],
  pending: 0,
  loading: true,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  connected: false,
  readOnly: false,
  selectedList: 'offen',
  filterMemberId: null,
  showOlderDone: false,
  selectedCardId: null,
  toast: null
};

function normalizeCard(raw: Record<string, unknown>): Card {
  return {
    id: String(raw.id),
    title: String(raw.title ?? ''),
    notes: String(raw.notes ?? ''),
    list: (raw.list as ListKey) ?? 'offen',
    pos: String(raw.pos ?? ''),
    assignees: Array.isArray(raw.assignees) ? raw.assignees.map(String) : [],
    due: String(raw.due ?? ''),
    doneAt: String(raw.doneAt ?? ''),
    archived: Boolean(raw.archived),
    created: String(raw.created ?? ''),
    updated: String(raw.updated ?? '')
  };
}

function normalizeMember(raw: Record<string, unknown>): Member {
  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    color: MemberColorGuard(raw.color),
    emoji: String(raw.emoji ?? ''),
    user: raw.user ? String(raw.user) : undefined,
    active: Boolean(raw.active),
    created: String(raw.created ?? ''),
    updated: String(raw.updated ?? '')
  };
}

function MemberColorGuard(value: unknown): Member['color'] {
  const allowed: Member['color'][] = ['teal', 'brown', 'green', 'purple', 'rose', 'ochre', 'blue', 'red'];
  return allowed.includes(value as Member['color']) ? (value as Member['color']) : 'teal';
}

function isNetworkFailure(error: unknown): boolean {
  if (!(error instanceof ClientResponseError)) return true;
  return error.status === 0 || error.status >= 500;
}

function isAuthenticationFailure(error: unknown): boolean {
  return error instanceof ClientResponseError && error.status === 401;
}

export function applyOperations(baseCards: Iterable<Card>, operations: QueuedOperation[]): Card[] {
  const cards = new Map(Array.from(baseCards, (card) => [card.id, card]));
  for (const operation of operations) {
    if (operation.kind === 'create') {
      cards.set(operation.cardId, { id: operation.cardId, ...operation.patch } as Card);
    } else if (operation.kind === 'update') {
      const existing = cards.get(operation.cardId);
      if (existing) cards.set(operation.cardId, { ...existing, ...operation.patch });
    } else {
      cards.delete(operation.cardId);
    }
  }
  return [...cards.values()].filter((card) => !card.archived).sort(compareCards);
}

export class BoardStore {
  readonly state = writable<BoardState>(initialState);
  private baseCards = new Map<string, Card>();
  private members = new Map<string, Member>();
  private operations: QueuedOperation[] = [];
  private draining = false;
  private connecting = false;
  private toastId = 0;
  private toastTimer: number | undefined;
  private initialized = false;

  subscribe = this.state.subscribe;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    const cache = await loadCache();
    cache.cards.forEach((card) => this.baseCards.set(card.id, card));
    cache.members.forEach((member) => this.members.set(member.id, member));
    this.operations = cache.operations;
    this.patchState({ loading: false, readOnly: !isAuthenticated() && cache.cards.length > 0 && !navigator.onLine });
    this.publish();

    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    if (isAuthenticated()) await this.connect();
  }

  destroy(): void {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    void pb.collection('cards').unsubscribe();
    void pb.collection('members').unsubscribe();
    this.initialized = false;
  }

  async connect(): Promise<void> {
    if (!isAuthenticated() || this.connecting) return;
    this.connecting = true;
    let ready = false;
    this.patchState({ loading: this.baseCards.size === 0, readOnly: false });
    try {
      const [cardsPage, members] = await Promise.all([
        pb.collection('cards').getList(1, 500, { filter: 'archived = false', sort: 'pos,id', expand: 'assignees' }),
        pb.collection('members').getFullList({ sort: 'name' })
      ]);
      const cards = cardsPage.items.map((record) => normalizeCard(record));
      const normalizedMembers = members.map((record) => normalizeMember(record));
      this.baseCards = new Map(cards.map((card) => [card.id, card]));
      this.members = new Map(normalizedMembers.map((member) => [member.id, member]));
      await Promise.all([replaceCards(cards), replaceMembers(normalizedMembers)]);
      this.patchState({ online: true, connected: true, loading: false, readOnly: false });
      this.publish();
      await this.subscribeRealtime();
      ready = true;
    } catch (error) {
      if (isAuthenticationFailure(error)) pb.authStore.clear();
      this.patchState({ online: navigator.onLine, connected: false, loading: false, readOnly: !isAuthenticated() });
      if (!isNetworkFailure(error)) this.showToast('Board konnte nicht geladen werden.');
    } finally {
      this.connecting = false;
    }
    if (ready) void this.drain();
  }

  async afterLogin(): Promise<void> {
    await this.connect();
  }

  createCard(title: string): void {
    if (get(this.state).readOnly) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    const state = get(this.state);
    const card: Card = {
      id: newRecordId(),
      title: cleanTitle,
      notes: '',
      list: 'offen',
      pos: positionAtTop(state.cards, 'offen'),
      assignees: [],
      due: '',
      doneAt: '',
      archived: false
    };
    void this.enqueue('create', card.id, card);
  }

  updateCard(id: string, patch: CardPatch): void {
    if (get(this.state).readOnly || !get(this.state).cards.some((card) => card.id === id)) return;
    void this.enqueue('update', id, this.normalizePatch(patch));
  }

  moveCard(id: string, list: ListKey, position?: string, withUndo = true): void {
    const state = get(this.state);
    const card = state.cards.find((candidate) => candidate.id === id);
    if (!card || state.readOnly || (card.list === list && position === undefined)) return;
    const previous = { cardId: card.id, list: card.list, pos: card.pos };
    const patch: CardPatch = {
      list,
      pos: position ?? positionAtTop(state.cards, list),
      doneAt: list === 'fertig' ? card.doneAt || new Date().toISOString() : ''
    };
    void this.enqueue('update', id, patch);
    this.patchState({ selectedList: list });
    if (withUndo) this.showToast(`„${this.short(card.title)}“ → ${this.label(list)}`, previous);
  }

  dropCard(id: string, list: ListKey, targetId: string | null, after: boolean): void {
    const state = get(this.state);
    const position = positionForDrop(state.cards, list, id, targetId, after);
    this.moveCard(id, list, position);
  }

  deleteCard(id: string): void {
    if (get(this.state).readOnly) return;
    const title = get(this.state).cards.find((card) => card.id === id)?.title ?? 'Karte';
    void this.enqueue('delete', id, {});
    this.patchState({ selectedCardId: null });
    this.showToast(`„${this.short(title)}“ gelöscht`);
  }

  undoMove(): void {
    const undo = get(this.state).toast?.undoMove;
    if (!undo) return;
    this.moveCard(undo.cardId, undo.list, undo.pos, false);
    this.clearToast();
  }

  selectList(list: ListKey): void {
    this.patchState({ selectedList: list });
  }

  toggleFilter(memberId: string): void {
    const current = get(this.state).filterMemberId;
    this.patchState({ filterMemberId: current === memberId ? null : memberId });
  }

  clearFilter(): void {
    this.patchState({ filterMemberId: null });
  }

  toggleOlderDone(): void {
    this.patchState({ showOlderDone: !get(this.state).showOlderDone });
  }

  openCard(id: string): void {
    this.patchState({ selectedCardId: id });
  }

  closeCard(): void {
    this.patchState({ selectedCardId: null });
  }

  visibleCards(state = get(this.state), list = state.selectedList): Card[] {
    return state.cards
      .filter((card) => card.list === list)
      .filter((card) => !state.filterMemberId || card.assignees.includes(state.filterMemberId))
      .filter((card) => list !== 'fertig' || state.showOlderDone || isRecentDone(card.doneAt))
      .sort(compareCards);
  }

  olderDoneCount(state = get(this.state)): number {
    return state.cards
      .filter((card) => card.list === 'fertig' && !isRecentDone(card.doneAt))
      .filter((card) => !state.filterMemberId || card.assignees.includes(state.filterMemberId)).length;
  }

  private handleOnline = (): void => {
    this.patchState({ online: true, readOnly: false });
    void this.connect();
  };

  private handleOffline = (): void => {
    this.patchState({ online: false, connected: false, readOnly: !isAuthenticated() });
  };

  private async subscribeRealtime(): Promise<void> {
    await Promise.all([pb.collection('cards').unsubscribe(), pb.collection('members').unsubscribe()]);
    await pb.collection('cards').subscribe('*', async (event) => {
      const id = event.record.id;
      if (event.action === 'delete' || event.record.archived) {
        this.baseCards.delete(id);
        await deleteCachedCard(id);
      } else {
        const card = normalizeCard(event.record);
        this.baseCards.set(card.id, card);
        await putCard(card);
      }
      this.publish();
    }, { expand: 'assignees' });
    await pb.collection('members').subscribe('*', async (event) => {
      const id = event.record.id;
      if (event.action === 'delete') {
        this.members.delete(id);
        await deleteCachedMember(id);
      } else {
        const member = normalizeMember(event.record);
        this.members.set(member.id, member);
        await putMember(member);
      }
      this.publish();
    });
  }

  private normalizePatch(patch: CardPatch): CardPatch {
    const result = { ...patch };
    if (typeof result.title === 'string') result.title = result.title.trim();
    if (typeof result.due === 'string') result.due = toPocketBaseDate(result.due);
    return result;
  }

  private async enqueue(kind: QueuedOperation['kind'], cardId: string, patch: CardPatch): Promise<void> {
    const operation: QueuedOperation = { opId: newOperationId(), kind, cardId, patch, ts: Date.now() };
    await putOperation(operation);
    this.operations.push(operation);
    this.publish();
    if (isAuthenticated() && navigator.onLine && !this.connecting) void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.draining || !isAuthenticated() || !navigator.onLine) return;
    this.draining = true;
    try {
      while (this.operations.length && navigator.onLine && isAuthenticated()) {
        const operation = this.operations[0];
        try {
          if (operation.kind === 'delete') {
            await pb.collection('cards').delete(operation.cardId);
            this.baseCards.delete(operation.cardId);
            await deleteCachedCard(operation.cardId);
          } else {
            const payload = operation.kind === 'create'
              ? { ...operation.patch, id: operation.cardId }
              : operation.patch;
            const record = operation.kind === 'create'
              ? await pb.collection('cards').create(payload, { expand: 'assignees' })
              : await pb.collection('cards').update(operation.cardId, payload, { expand: 'assignees' });
            const card = normalizeCard(record);
            this.baseCards.set(card.id, card);
            await putCard(card);
          }
          await this.finishOperation(operation.opId);
        } catch (error) {
          if (isAuthenticationFailure(error)) {
            pb.authStore.clear();
            this.patchState({ connected: false, readOnly: true });
            this.showToast('Sitzung abgelaufen. Bitte erneut anmelden.');
            break;
          }
          if (operation.kind === 'create' && error instanceof ClientResponseError && error.status === 400) {
            try {
              const existing = normalizeCard(await pb.collection('cards').getOne(operation.cardId));
              this.baseCards.set(existing.id, existing);
              await putCard(existing);
              await this.finishOperation(operation.opId);
              continue;
            } catch {
              // The original validation error is handled below.
            }
          }
          if (isNetworkFailure(error)) {
            this.patchState({ connected: false, online: navigator.onLine });
            break;
          }
          const status = error instanceof ClientResponseError ? error.status : 0;
          await this.finishOperation(operation.opId);
          this.showToast(status === 404 ? 'Karte wurde bereits auf einem anderen Gerät gelöscht.' : 'Änderung wurde vom Server abgelehnt.');
        }
      }
    } finally {
      this.draining = false;
      this.publish();
    }
  }

  private async finishOperation(opId: string): Promise<void> {
    this.operations = this.operations.filter((operation) => operation.opId !== opId);
    await deleteOperation(opId);
    this.publish();
  }

  private publish(): void {
    this.state.update((state) => ({
      ...state,
      cards: applyOperations(this.baseCards.values(), this.operations),
      members: [...this.members.values()].sort((a, b) => a.name.localeCompare(b.name, 'de')),
      pending: this.operations.length
    }));
  }

  private patchState(patch: Partial<BoardState>): void {
    this.state.update((state) => ({ ...state, ...patch }));
  }

  private showToast(text: string, undoMove?: { cardId: string; list: ListKey; pos: string }): void {
    window.clearTimeout(this.toastTimer);
    this.patchState({ toast: { id: ++this.toastId, text, undoMove } });
    this.toastTimer = window.setTimeout(() => this.clearToast(), 4000);
  }

  private clearToast(): void {
    this.patchState({ toast: null });
  }

  private short(title: string): string {
    return title.length > 28 ? `${title.slice(0, 27).trimEnd()}…` : title;
  }

  private label(list: ListKey): string {
    return { offen: 'Offen', dran: 'Dran', fertig: 'Fertig' }[list];
  }
}

export const boardStore = new BoardStore();

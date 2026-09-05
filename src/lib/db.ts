import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Card, Member, QueuedOperation } from './types';

interface DranDb extends DBSchema {
  cards: { key: string; value: Card };
  members: { key: string; value: Member };
  operations: { key: string; value: QueuedOperation; indexes: { byTs: number } };
}

let database: Promise<IDBPDatabase<DranDb>> | undefined;

function db(): Promise<IDBPDatabase<DranDb>> {
  database ??= openDB<DranDb>('dran', 1, {
    upgrade(instance) {
      instance.createObjectStore('cards', { keyPath: 'id' });
      instance.createObjectStore('members', { keyPath: 'id' });
      const operations = instance.createObjectStore('operations', { keyPath: 'opId' });
      operations.createIndex('byTs', 'ts');
    }
  });
  return database;
}

export async function loadCache(): Promise<{ cards: Card[]; members: Member[]; operations: QueuedOperation[] }> {
  const instance = await db();
  const [cards, members, operations] = await Promise.all([
    instance.getAll('cards'),
    instance.getAll('members'),
    instance.getAllFromIndex('operations', 'byTs')
  ]);
  return { cards, members, operations };
}

export async function replaceCards(cards: Card[]): Promise<void> {
  const instance = await db();
  const transaction = instance.transaction('cards', 'readwrite');
  await transaction.store.clear();
  await Promise.all(cards.map((card) => transaction.store.put(card)));
  await transaction.done;
}

export async function putCard(card: Card): Promise<void> {
  await (await db()).put('cards', card);
}

export async function deleteCard(id: string): Promise<void> {
  await (await db()).delete('cards', id);
}

export async function replaceMembers(members: Member[]): Promise<void> {
  const instance = await db();
  const transaction = instance.transaction('members', 'readwrite');
  await transaction.store.clear();
  await Promise.all(members.map((member) => transaction.store.put(member)));
  await transaction.done;
}

export async function putMember(member: Member): Promise<void> {
  await (await db()).put('members', member);
}

export async function deleteMember(id: string): Promise<void> {
  await (await db()).delete('members', id);
}

export async function putOperation(operation: QueuedOperation): Promise<void> {
  await (await db()).put('operations', operation);
}

export async function deleteOperation(id: string): Promise<void> {
  await (await db()).delete('operations', id);
}

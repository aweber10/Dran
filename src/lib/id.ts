const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function newRecordId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(15));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}

export function newOperationId(): string {
  return crypto.randomUUID();
}

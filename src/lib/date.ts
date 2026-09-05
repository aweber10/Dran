const DAY_MS = 86_400_000;

export function dateOnly(value: string): string {
  return value ? value.slice(0, 10) : '';
}

export function toPocketBaseDate(value: string): string {
  return value ? `${value.slice(0, 10)} 00:00:00.000Z` : '';
}

export function formatDue(value: string, today = new Date()): string {
  const iso = dateOnly(value);
  if (!iso) return '';
  const local = new Date(`${iso}T00:00:00`);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((local.getTime() - base.getTime()) / DAY_MS);
  if (days === 0) return 'heute';
  if (days === 1) return 'morgen';
  if (days === -1) return 'gestern';
  return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' }).format(local);
}

export function dueIsUrgent(value: string, today = new Date()): boolean {
  const iso = dateOnly(value);
  if (!iso) return false;
  const todayIso = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
  return iso <= todayIso;
}

export function isRecentDone(doneAt: string, now = Date.now()): boolean {
  if (!doneAt) return false;
  return new Date(doneAt).getTime() >= now - 14 * DAY_MS;
}

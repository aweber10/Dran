import PocketBase from 'pocketbase';

const configuredUrl = import.meta.env.VITE_POCKETBASE_URL as string | undefined;
export const pb = new PocketBase(configuredUrl || window.location.origin);
pb.autoCancellation(false);

export async function logIn(identity: string, password: string): Promise<void> {
  await pb.collection('users').authWithPassword(identity, password);
}

export function logOut(): void {
  pb.authStore.clear();
}

export function isAuthenticated(): boolean {
  return pb.authStore.isValid;
}

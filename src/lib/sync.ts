/** Messages sur l’envoi des saisies, émis hors de React (cache des mutations) et affichés par SyncStatus. */
type Listener = (msg: string) => void;
const listeners = new Set<Listener>();

export function onSyncMessage(l: Listener) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
export const syncMessage = (msg: string) => listeners.forEach((l) => l(msg));

import { useEffect, useSyncExternalStore } from "react";
import { onlineManager, useMutationState } from "@tanstack/react-query";
import { plural } from "@/lib/format";
import { onSyncMessage } from "@/lib/sync";
import { useToast } from "./Overlay";

const subscribe = (cb: () => void) => onlineManager.subscribe(cb);
const isOnline = () => onlineManager.isOnline();

/** Bandeau hors ligne et nombre de saisies en attente d’envoi. */
export function SyncStatus() {
  const toast = useToast();
  const online = useSyncExternalStore(subscribe, isOnline);
  // Seulement les envois bloqués (hors ligne ou en échec), pas ceux qui partent normalement.
  const waiting = useMutationState({
    filters: { mutationKey: ["entries"], predicate: (m) => m.state.status === "pending" && (m.state.isPaused || m.state.failureCount > 0) },
  }).length;
  useEffect(() => onSyncMessage((msg) => toast(msg)), [toast]);

  if (online && !waiting) return null;
  const n = waiting ? ` ${waiting} ${plural(waiting, "saisie")} en attente.` : "";
  return (
    <div className="note info syncbar" role="status">
      {online
        ? <p>Réseau faible, envoi en cours.{n}</p>
        : <p><b>Hors ligne.</b> Vos saisies sont gardées sur le téléphone et partiront au retour du réseau.{n}</p>}
    </div>
  );
}

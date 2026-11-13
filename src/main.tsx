import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MutationCache, QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { PersistQueryClientProvider, persistQueryClientSave } from "@tanstack/react-query-persist-client";
import { App } from "./app/App";
import { isNetworkError, registerEntryMutations } from "./entries/api";
import { syncMessage } from "./lib/sync";
import { DAY } from "./lib/time";
import { OverlayProvider } from "./ui/Overlay";
import "./styles/app.css";

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (err, _vars, _ctx, mutation) => {
      const key = mutation.options.mutationKey?.[0];
      if (key === "settings") return syncMessage("Modification non enregistrée. Vérifiez la connexion, puis réessayez.");
      if (key !== "entries") return;
      syncMessage(isNetworkError(err)
        ? "Une saisie n’a pas pu être envoyée malgré plusieurs essais. Vérifiez le réseau et refaites-la."
        : "Une saisie a été refusée par le serveur et n’a pas été enregistrée.");
    },
  }),
  defaultOptions: {
    // gcTime long : les données restent sur le téléphone pour un démarrage hors ligne.
    queries: { refetchOnWindowFocus: true, refetchOnReconnect: true, retry: 2, gcTime: 7 * DAY },
    mutations: { retry: 1 },
  },
});
registerEntryMutations(queryClient);

/** Copie du cache sur le téléphone : données consultables et saisies gardées sans réseau. */
const storage = (() => { try { return window.localStorage; } catch { return undefined; } })();
const persister = createSyncStoragePersister({ key: "suivi-bebe:cache", storage });
const persistOptions = {
  persister,
  maxAge: 7 * DAY,
  buster: "1",
  dehydrateOptions: { shouldDehydrateMutation: (m: { state: { status: string } }) => m.state.status === "pending" },
};

/**
 * La copie habituelle attend une seconde après chaque changement. Une saisie en attente d’envoi est copiée
 * tout de suite, et tout est copié quand l’appli passe en arrière-plan : fermer l’appli juste après une
 * saisie hors ligne ne la perd pas. Jamais avant la restauration, pour ne pas écraser la copie existante.
 */
let restored = false;
const immediate = createSyncStoragePersister({ key: "suivi-bebe:cache", storage, throttleTime: 0 });
const saveNow = () => { if (restored) void persistQueryClientSave({ ...persistOptions, queryClient, persister: immediate }); };
queryClient.getMutationCache().subscribe((ev) => {
  if (ev.type === "updated" && ev.mutation.options.mutationKey?.[0] === "entries") saveNow();
});
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveNow(); });
window.addEventListener("pagehide", saveNow);

/** Au démarrage, renvoie les saisies restées en attente lors de la dernière utilisation. */
async function resumePending() {
  restored = true;
  await queryClient.resumePausedMutations();
  const left = queryClient.getMutationCache().getAll().filter((m) => m.state.status === "pending" && !m.state.isPaused);
  await Promise.all(left.map((m) => m.continue().catch(() => undefined)));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      onSuccess={resumePending}
      onError={() => { restored = true; }}
      persistOptions={persistOptions}
    >
      <OverlayProvider>
        <App />
      </OverlayProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
);

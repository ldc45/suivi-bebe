import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MutationCache, QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { App } from "./app/App";
import { isNetworkError, registerEntryMutations } from "./entries/api";
import { syncMessage } from "./lib/sync";
import { DAY } from "./lib/time";
import { OverlayProvider } from "./ui/Overlay";
import "./styles/app.css";

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (err, _vars, _ctx, mutation) => {
      if (mutation.options.mutationKey?.[0] !== "entries") return;
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
const persister = createSyncStoragePersister({
  key: "suivi-bebe:cache",
  storage: (() => { try { return window.localStorage; } catch { return undefined; } })(),
});

/** Au démarrage, renvoie les saisies restées en attente lors de la dernière utilisation. */
async function resumePending() {
  await queryClient.resumePausedMutations();
  const left = queryClient.getMutationCache().getAll().filter((m) => m.state.status === "pending" && !m.state.isPaused);
  await Promise.all(left.map((m) => m.continue().catch(() => undefined)));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      onSuccess={resumePending}
      persistOptions={{
        persister,
        maxAge: 7 * DAY,
        buster: "1",
        dehydrateOptions: { shouldDehydrateMutation: (m) => m.state.status === "pending" },
      }}
    >
      <OverlayProvider>
        <App />
      </OverlayProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
);

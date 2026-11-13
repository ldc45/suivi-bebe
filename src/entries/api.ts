import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { DAY } from "@/lib/time";
import type { Entry, EntryType } from "./types";

/** Fenêtre chargée et partagée par tous les écrans. */
export const WINDOW_DAYS = 180;
const PAGE = 1000;
/** Types chargés sans limite de date : ils sont peu nombreux et leur historique complet compte. */
const ALL_TIME_TYPES: EntryType[] = ["growth", "solid"];

interface EntryRow {
  id: string; baby_id: string; type: EntryType; started_at: string; ended_at: string | null; in_progress: boolean;
  data: Record<string, unknown> | null; note: string | null; medication_id: string | null; created_by: string | null;
}

const toEntry = (r: EntryRow): Entry => ({
  id: r.id, babyId: r.baby_id, type: r.type,
  startedAt: new Date(r.started_at).getTime(),
  endedAt: r.ended_at ? new Date(r.ended_at).getTime() : null,
  inProgress: r.in_progress, data: (r.data ?? {}) as never, note: r.note,
  medicationId: r.medication_id, createdBy: r.created_by,
}) as Entry;

const toRow = (e: Entry) => ({
  id: e.id, baby_id: e.babyId, type: e.type,
  started_at: new Date(e.startedAt).toISOString(),
  ended_at: e.endedAt != null ? new Date(e.endedAt).toISOString() : null,
  in_progress: e.inProgress, data: e.data, note: e.note || null, medication_id: e.medicationId,
});

export const entriesKey = (babyId: string | undefined) => ["entries", babyId] as const;

async function fetchEntries(babyId: string, since: number): Promise<Entry[]> {
  const out: Entry[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("entries").select("*")
      .eq("baby_id", babyId)
      // Pesées et repas solides : tout l’historique (courbe de croissance, première fois d’un aliment).
      .or(`started_at.gte.${new Date(since).toISOString()},type.in.(${ALL_TIME_TYPES.join(",")})`)
      .order("started_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data as EntryRow[]).map(toEntry));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/**
 * Saisies des WINDOW_DAYS derniers jours (plus l’historique complet des pesées et des repas solides),
 * triées de la plus récente à la plus ancienne. Les saisies pas encore envoyées au serveur
 * (hors ligne) sont superposées au résultat, pour qu’un rechargement ne les fasse pas disparaître.
 */
export function useEntries(babyId: string | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: entriesKey(babyId),
    enabled: !!babyId,
    queryFn: async () => withPending(qc, babyId!, await fetchEntries(babyId!, Date.now() - WINDOW_DAYS * DAY)),
    staleTime: 30_000,
  });
}

const sortDesc = (list: Entry[]) => [...list].sort((a, b) => b.startedAt - a.startedAt);

/* ---------- Envoi des saisies, y compris hors ligne ---------- */

const SAVE_KEY = ["entries", "save"] as const;
const REMOVE_KEY = ["entries", "remove"] as const;

/** Échec réseau (pas de réponse du serveur), par opposition à un refus du serveur. */
export function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  const msg = String((err as { message?: string } | null)?.message ?? err ?? "");
  return /fetch|network|load failed|timeout/i.test(msg);
}

/** Saisies en attente d’envoi (ajouts, modifications, suppressions), dans l’ordre où elles ont été faites. */
function pending(qc: QueryClient) {
  return qc.getMutationCache().getAll()
    .filter((m) => m.state.status === "pending" || m.state.isPaused)
    .sort((a, b) => a.state.submittedAt - b.state.submittedAt);
}

function withPending(qc: QueryClient, babyId: string, list: Entry[]): Entry[] {
  let out = list;
  for (const m of pending(qc)) {
    const k = m.options.mutationKey?.[1];
    if (k === "save") { const e = m.state.variables as Entry; if (e.babyId === babyId) out = [...out.filter((x) => x.id !== e.id), e]; }
    if (k === "remove") { const id = m.state.variables as string; out = out.filter((x) => x.id !== id); }
  }
  return out === list ? list : sortDesc(out);
}

/**
 * Fonctions d’envoi enregistrées une fois pour toutes sur le client : une saisie faite hors ligne
 * est gardée sur le téléphone (voir main.tsx) et repart au retour du réseau, même après avoir fermé l’appli.
 * `scope` envoie les saisies une par une, dans l’ordre (une annulation passe après l’ajout qu’elle annule).
 */
export function registerEntryMutations(qc: QueryClient) {
  const common = {
    scope: { id: "entries" },
    // Coupure ou réseau très faible : on réessaie longtemps ; refus du serveur : une seule nouvelle tentative.
    retry: (count: number, err: unknown) => (isNetworkError(err) ? count < 30 : count < 1),
    retryDelay: (count: number) => Math.min(30_000, 1000 * 2 ** count),
    onSettled: () => qc.isMutating({ mutationKey: ["entries"] }) <= 1 && qc.invalidateQueries({ queryKey: ["entries"] }),
  };
  qc.setMutationDefaults(SAVE_KEY, {
    ...common,
    mutationFn: async (e: Entry) => {
      const { error } = await supabase.from("entries").upsert(toRow(e));
      if (error) throw error;
    },
  });
  qc.setMutationDefaults(REMOVE_KEY, {
    ...common,
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("entries").delete().eq("id", id);
      if (error) throw error;
    },
  });
}

/**
 * Création, modification et suppression avec mise à jour optimiste :
 * l’écran change immédiatement, et revient en arrière si le serveur refuse.
 * Sans réseau, la saisie reste affichée et part dès que la connexion revient.
 */
export function useEntryMutations(babyId: string | undefined) {
  const qc = useQueryClient();
  const key = entriesKey(babyId);

  const optimistic = async (apply: (list: Entry[]) => Entry[]) => {
    await qc.cancelQueries({ queryKey: key });
    const prev = qc.getQueryData<Entry[]>(key);
    qc.setQueryData<Entry[]>(key, (list) => sortDesc(apply(list ?? [])));
    return { prev };
  };
  const rollback = (_e: unknown, _v: unknown, ctx?: { prev?: Entry[] }) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); };

  const save = useMutation<void, Error, Entry, { prev?: Entry[] }>({
    mutationKey: SAVE_KEY,
    onMutate: (e) => optimistic((list) => [...list.filter((x) => x.id !== e.id), e]),
    onError: rollback,
  });

  const remove = useMutation<void, Error, string, { prev?: Entry[] }>({
    mutationKey: REMOVE_KEY,
    onMutate: (id) => optimistic((list) => list.filter((x) => x.id !== id)),
    onError: rollback,
  });

  return { save, remove };
}

/** Identifiant généré côté client, pour les mises à jour optimistes et l’annulation. */
export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

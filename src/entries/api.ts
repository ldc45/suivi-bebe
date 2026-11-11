import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { DAY } from "@/lib/time";
import type { Entry, EntryType } from "./types";

/** Fenêtre chargée et partagée par tous les écrans. */
export const WINDOW_DAYS = 180;
const PAGE = 1000;

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
      .gte("started_at", new Date(since).toISOString())
      .order("started_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data as EntryRow[]).map(toEntry));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** Saisies des WINDOW_DAYS derniers jours, triées de la plus récente à la plus ancienne. */
export function useEntries(babyId: string | undefined) {
  return useQuery({
    queryKey: entriesKey(babyId),
    enabled: !!babyId,
    queryFn: () => fetchEntries(babyId!, Date.now() - WINDOW_DAYS * DAY),
    staleTime: 30_000,
  });
}

const sortDesc = (list: Entry[]) => [...list].sort((a, b) => b.startedAt - a.startedAt);

/**
 * Création, modification et suppression avec mise à jour optimiste :
 * l’écran change immédiatement, et revient en arrière si le serveur refuse.
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
  const settle = () => qc.invalidateQueries({ queryKey: key });

  const save = useMutation({
    mutationFn: async (e: Entry) => {
      const { error } = await supabase.from("entries").upsert(toRow(e));
      if (error) throw error;
    },
    onMutate: (e) => optimistic((list) => [...list.filter((x) => x.id !== e.id), e]),
    onError: rollback,
    onSettled: settle,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("entries").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: (id) => optimistic((list) => list.filter((x) => x.id !== id)),
    onError: rollback,
    onSettled: settle,
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

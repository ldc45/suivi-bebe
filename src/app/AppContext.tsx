import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useBabies, useMedications } from "@/babies/api";
import type { Baby, Medication } from "@/babies/types";
import { useEntries } from "@/entries/api";
import type { Entry, EntryOf } from "@/entries/types";
import { isPrepared } from "@/lib/rules";
import { useRealtime } from "@/lib/realtime";
import { todayKey } from "@/lib/time";

interface AppState {
  email: string;
  userId: string;
  householdId: string;
  babies: Baby[];
  baby: Baby | null;
  selectBaby: (id: string) => void;
  /** Jour affiché (AAAA-MM-JJ) ; aujourd’hui par défaut. */
  viewDay: string;
  isToday: boolean;
  setViewDay: (k: string | null) => void;
  /** Saisies, sans les biberons préparés pas encore donnés. */
  entries: Entry[];
  /** Biberons préparés en attente, du plus ancien au plus récent. */
  prepared: EntryOf<"bottle">[];
  entriesLoading: boolean;
  medications: Medication[];
  /** Horloge rafraîchie chaque minute, pour les durées « depuis ». */
  now: number;
}

const Ctx = createContext<AppState | null>(null);
export const useApp = () => useContext(Ctx)!;

const STORAGE_KEY = "suivi-bebe:baby";

export function AppProvider({ email, userId, householdId, children }: { email: string; userId: string; householdId: string; children: ReactNode }) {
  const babiesQ = useBabies(householdId);
  const babies = useMemo(() => babiesQ.data ?? [], [babiesQ.data]);
  const [babyId, setBabyId] = useState<string | null>(() => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } });
  const baby = babies.find((b) => b.id === babyId) ?? babies[0] ?? null;

  const [day, setDay] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 60_000); return () => window.clearInterval(t); }, []);

  const entriesQ = useEntries(baby?.id);
  const medsQ = useMedications(baby?.id);
  useRealtime(householdId, baby?.id);

  // Un biberon préparé n’est pas encore un repas : il est retiré des saisies (totaux, alertes, cadran, listes).
  const all = entriesQ.data;
  const entries = useMemo(() => (all ?? []).filter((e) => !isPrepared(e)), [all]);
  const prepared = useMemo(() => (all ?? []).filter(isPrepared).sort((a, b) => a.startedAt - b.startedAt), [all]);

  const selectBaby = useCallback((id: string) => {
    setBabyId(id); setDay(null);
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* stockage indisponible */ }
  }, []);
  const today = todayKey();
  const viewDay = day && day < today ? day : today;

  const value: AppState = {
    email, userId, householdId, babies, baby, selectBaby,
    viewDay, isToday: viewDay === today, setViewDay: (k) => setDay(k && k < today ? k : null),
    entries, prepared, entriesLoading: entriesQ.isLoading,
    medications: medsQ.data ?? [], now,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

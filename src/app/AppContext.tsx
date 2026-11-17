import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { linkMyAccount, useBabies, useMedications, useMembers } from "@/babies/api";
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
  /** Prénom des membres du foyer, par identifiant de compte. */
  names: Record<string, string>;
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
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t = window.setInterval(tick, 60_000);
    // Le téléphone ralentit les minuteries en arrière-plan : on se remet à l’heure au retour.
    const onShow = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onShow);
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", onShow); };
  }, []);

  const entriesQ = useEntries(baby?.id);
  const membersQ = useMembers(householdId);
  const names = useMemo(() => Object.fromEntries((membersQ.data ?? []).filter((m) => m.userId && m.displayName).map((m) => [m.userId!, m.displayName!])), [membersQ.data]);
  useEffect(() => { void linkMyAccount(); }, [userId]);
  const medsQ = useMedications(baby?.id);
  useRealtime(householdId, baby?.id);

  // Un biberon préparé n’est pas encore un repas : il est retiré des saisies (totaux, alertes, cadran, listes).
  const all = entriesQ.data;
  const entries = useMemo(() => (all ?? []).filter((e) => !isPrepared(e)), [all]);
  // Une saisie faite « maintenant » doit apparaître tout de suite : l’horloge se remet à l’heure à chaque
  // changement des saisies (sinon le cadran la croit dans le futur jusqu’à la minute suivante).
  useEffect(() => { setNow(Date.now()); }, [all]);
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
    medications: medsQ.data ?? [], names, now,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

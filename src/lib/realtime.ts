import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { keys } from "@/babies/api";
import { entriesKey } from "@/entries/api";
import { supabase } from "./supabase";

/**
 * Écoute les changements faits sur l’autre téléphone et invalide les requêtes concernées.
 * TanStack Query recharge alors uniquement les écrans affichés.
 */
export function useRealtime(householdId: string | undefined, babyId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel(`household-${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "entries" }, () => qc.invalidateQueries({ queryKey: entriesKey(babyId) }))
      .on("postgres_changes", { event: "*", schema: "public", table: "babies" }, () => qc.invalidateQueries({ queryKey: keys.babies(householdId) }))
      .on("postgres_changes", { event: "*", schema: "public", table: "medications" }, () => qc.invalidateQueries({ queryKey: keys.medications(babyId) }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc, householdId, babyId]);
}

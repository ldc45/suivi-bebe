import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Baby, BabySettings, Frequency, Medication, Sex } from "./types";

interface BabyRow {
  id: string; household_id: string; name: string; birth_date: string; sex: Sex | null;
  birth_weight_g: number | null; birth_length_mm: number | null; settings: BabySettings | null; created_at: string;
}
interface MedicationRow {
  id: string; baby_id: string; name: string; dose: string | null; frequency: Frequency; time_of_day: string | null; active: boolean;
}

const toBaby = (r: BabyRow): Baby => ({
  id: r.id, householdId: r.household_id, name: r.name, birthDate: r.birth_date, sex: r.sex,
  birthWeightG: r.birth_weight_g, birthLengthMm: r.birth_length_mm, settings: r.settings ?? {}, createdAt: r.created_at,
});
const toMedication = (r: MedicationRow): Medication => ({
  id: r.id, babyId: r.baby_id, name: r.name, dose: r.dose, frequency: r.frequency,
  timeOfDay: r.time_of_day ? r.time_of_day.slice(0, 5) : null, active: r.active,
});

/** Clé des modifications de réglages (profil, traitements) : un échec est signalé par un message (voir main.tsx). */
export const SETTINGS_KEY = ["settings"] as const;

export const keys = {
  household: ["household"] as const,
  babies: (householdId: string | undefined) => ["babies", householdId] as const,
  medications: (babyId: string | undefined) => ["medications", babyId] as const,
};

/** Foyer de la personne connectée (null si son e-mail n’est membre d’aucun foyer). */
export function useHousehold(enabled: boolean) {
  return useQuery({
    queryKey: keys.household,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("household_members").select("household_id").limit(1);
      if (error) throw error;
      return (data?.[0]?.household_id as string | undefined) ?? null;
    },
  });
}

export function useBabies(householdId: string | undefined) {
  return useQuery({
    queryKey: keys.babies(householdId),
    enabled: !!householdId,
    queryFn: async () => {
      const { data, error } = await supabase.from("babies").select("*").eq("household_id", householdId!).order("created_at");
      if (error) throw error;
      return (data as BabyRow[]).map(toBaby);
    },
  });
}

export interface BabyInput {
  name: string; birthDate: string; sex: Sex | null; birthWeightG: number | null; birthLengthMm: number | null;
}

export function useCreateBaby(householdId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (b: BabyInput) => {
      const { data, error } = await supabase.from("babies").insert({
        household_id: householdId, name: b.name, birth_date: b.birthDate, sex: b.sex,
        birth_weight_g: b.birthWeightG, birth_length_mm: b.birthLengthMm,
        settings: { hidden_types: [], show_length: true, who_curves: false, thresholds: {} },
      }).select("*").single();
      if (error) throw error;
      return toBaby(data as BabyRow);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.babies(householdId) }),
  });
}

type BabyPatch = Partial<BabyInput> & { settings?: BabySettings };

export function useUpdateBaby(baby: Baby | null) {
  const qc = useQueryClient();
  const key = keys.babies(baby?.householdId);
  return useMutation({
    mutationKey: SETTINGS_KEY,
    mutationFn: async (p: BabyPatch) => {
      const row: Record<string, unknown> = {};
      if (p.name !== undefined) row.name = p.name;
      if (p.birthDate !== undefined) row.birth_date = p.birthDate;
      if (p.sex !== undefined) row.sex = p.sex;
      if (p.birthWeightG !== undefined) row.birth_weight_g = p.birthWeightG;
      if (p.birthLengthMm !== undefined) row.birth_length_mm = p.birthLengthMm;
      if (p.settings !== undefined) row.settings = p.settings;
      const { error } = await supabase.from("babies").update(row).eq("id", baby!.id);
      if (error) throw error;
    },
    onMutate: async (p) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Baby[]>(key);
      qc.setQueryData<Baby[]>(key, (list) => list?.map((x) => (x.id === baby?.id ? { ...x, ...p, settings: p.settings ?? x.settings } : x)));
      return { prev };
    },
    onError: (_e, _p, ctx) => ctx?.prev && qc.setQueryData(key, ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useMedications(babyId: string | undefined) {
  return useQuery({
    queryKey: keys.medications(babyId),
    enabled: !!babyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("medications").select("*").eq("baby_id", babyId!).order("created_at");
      if (error) throw error;
      return (data as MedicationRow[]).map(toMedication);
    },
  });
}

export function useMedicationMutations(babyId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: keys.medications(babyId) });
  const save = useMutation({
    mutationKey: SETTINGS_KEY,
    mutationFn: async (m: Omit<Medication, "id" | "babyId"> & { id?: string }) => {
      const row = { baby_id: babyId, name: m.name, dose: m.dose, frequency: m.frequency, time_of_day: m.timeOfDay, active: m.active };
      const { error } = m.id
        ? await supabase.from("medications").update(row).eq("id", m.id)
        : await supabase.from("medications").insert(row);
      if (error) throw error;
    },
    onSettled: invalidate,
  });
  const remove = useMutation({
    mutationKey: SETTINGS_KEY,
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("medications").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: invalidate,
  });
  return { save, remove };
}

import type { EntryType } from "@/entries/types";

export type Sex = "f" | "m";

export interface Thresholds {
  fever?: number;
  wetMin?: number;
  /** Intervalle maximum entre deux repas, en heures ; 0 désactive, absent = automatique selon l’âge. */
  gapH?: number;
  dropPct?: number;
  tummyMin?: number;
  mlPerKg?: number;
}

export interface BabySettings {
  hidden_types?: EntryType[];
  show_length?: boolean;
  who_curves?: boolean;
  thresholds?: Thresholds;
}

export interface Baby {
  id: string;
  householdId: string;
  name: string;
  birthDate: string;
  sex: Sex | null;
  birthWeightG: number | null;
  birthLengthMm: number | null;
  settings: BabySettings;
  createdAt: string;
}

export type Frequency = "daily" | "weekly" | "as_needed";

export interface Medication {
  id: string;
  babyId: string;
  name: string;
  dose: string | null;
  frequency: Frequency;
  /** « HH:MM » */
  timeOfDay: string | null;
  active: boolean;
}

/** Accorde un mot au féminin pour une fille (masculin par défaut). */
export const agree = (b: Pick<Baby, "sex"> | null | undefined, word: string) => (b?.sex === "f" ? `${word}e` : word);
/** Sujet d’une phrase : « Elle », « Il », ou le prénom si le sexe n’est pas renseigné. */
export const subject = (b: Pick<Baby, "sex" | "name"> | null | undefined) => (b?.sex === "f" ? "Elle" : b?.sex === "m" ? "Il" : b?.name || "Bébé");

export const SEX_LABEL: Record<Sex, string> = { f: "Fille", m: "Garçon" };
export const FREQ_LABEL: Record<Frequency, string> = { daily: "Tous les jours", weekly: "Une fois par semaine", as_needed: "Si besoin" };

import type { IconName } from "@/ui/icons";
import { ENTRY_META, type Entry, type EntryOf } from "./types";

/** Couches : une couleur et un pictogramme par cas, pour distinguer pipi, caca et les deux d’un coup d’œil. */
export const PEE_COLOR = "#E3C34A";
export const POO_COLOR = "#A8693A";

type DiaperKind = "pee" | "poo" | "both";
const diaperKindOf = (e: EntryOf<"diaper">): DiaperKind => (e.data.pee && e.data.poo ? "both" : e.data.poo ? "poo" : "pee");

/** Apparence d’une saisie : couleur principale, seconde couleur (pipi et caca), pictogramme. */
export interface Look { color: string; color2?: string; icon: IconName }

export function lookOf(e: Entry): Look {
  if (e.type === "diaper") {
    const k = diaperKindOf(e);
    if (k === "pee") return { color: PEE_COLOR, icon: "pee" };
    if (k === "poo") return { color: POO_COLOR, icon: "poo" };
    return { color: POO_COLOR, color2: PEE_COLOR, icon: "diaper" };
  }
  return { color: ENTRY_META[e.type].color, icon: e.type };
}

/** Fond d’une pastille : uni, ou partagé moitié pipi, moitié caca. */
export const lookBackground = (l: Look, mix = 100) => {
  const c = (x: string) => (mix === 100 ? x : `color-mix(in srgb, ${x} ${mix}%, var(--surface))`);
  return l.color2 ? `linear-gradient(90deg, ${c(l.color2)} 50%, ${c(l.color)} 50%)` : c(l.color);
};

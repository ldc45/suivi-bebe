import { dur, hm } from "@/lib/time";
import { num } from "@/lib/format";
import {
  AMOUNT_LABEL, type Entry, METHOD_LABEL, MILK_LABEL, PLACE_LABEL, REACTION_LABEL, STOOL, TEXTURE_LABEL,
} from "./types";

/** Intervalle occupé par une saisie (pour le cadran, la frise et les totaux). */
export function interval(e: Entry, now = Date.now()): [number, number] {
  if (e.type === "sleep" || e.type === "tummy") return [e.startedAt, e.inProgress ? now : e.endedAt ?? e.startedAt];
  if (e.type === "breastfeeding") return [e.startedAt, e.startedAt + (e.data.left_min + e.data.right_min) * 60_000];
  if (e.type === "pumping") return [e.startedAt, e.startedAt + (e.data.duration_min ?? 0) * 60_000];
  return [e.startedAt, e.startedAt];
}

export function diaperKind(e: Extract<Entry, { type: "diaper" }>): string {
  return e.data.pee && e.data.poo ? "Pipi et caca" : e.data.poo ? "Caca" : "Pipi";
}

/** Résumé lisible d’une saisie. */
export function describe(e: Entry, now = Date.now()): string {
  switch (e.type) {
    case "bottle": return `${num(e.data.ml)} ml, ${MILK_LABEL[e.data.milk].toLowerCase()}`;
    case "breastfeeding": {
      const p: string[] = [];
      if (e.data.left_min) p.push(`gauche ${e.data.left_min} min`);
      if (e.data.right_min) p.push(`droite ${e.data.right_min} min`);
      return `${p.join(", ") || "Durée non saisie"} (commencé à ${e.data.first_side === "left" ? "gauche" : "droite"})`;
    }
    case "pumping": return `${num(e.data.left_ml + e.data.right_ml)} ml (G ${num(e.data.left_ml)}, D ${num(e.data.right_ml)})${e.data.duration_min ? `, ${e.data.duration_min} min` : ""}`;
    case "diaper": {
      const p = [diaperKind(e)];
      if (e.data.poo) {
        if (e.data.color) p.push(STOOL[e.data.color].label.toLowerCase());
        if (e.data.texture) p.push(TEXTURE_LABEL[e.data.texture].toLowerCase());
        if (e.data.amount) p.push(AMOUNT_LABEL[e.data.amount].toLowerCase());
      }
      return p.join(", ");
    }
    case "medication": return `${e.data.name}${e.data.dose ? `, ${e.data.dose}` : ""}`;
    case "sleep": {
      const [a, b] = interval(e, now);
      return e.inProgress ? `En cours depuis ${dur(now - a)}` : `${dur(b - a)} (${hm(a)} à ${hm(b)})`;
    }
    case "solid": return `${e.data.food}${e.data.quantity ? `, ${e.data.quantity}` : ""}${e.data.reaction && e.data.reaction !== "none" ? `, réaction ${REACTION_LABEL[e.data.reaction].toLowerCase()}` : ""}`;
    case "temperature": return `${num(e.data.celsius, 1)} °C, ${METHOD_LABEL[e.data.method].toLowerCase()}`;
    case "tummy": {
      const [a, b] = interval(e, now);
      return e.inProgress ? `En cours depuis ${dur(now - a)}` : `${Math.round((b - a) / 60_000)} min`;
    }
    case "growth": {
      const p: string[] = [];
      if (e.data.weight_g) p.push(`${num(e.data.weight_g / 1000, 2)} kg`);
      if (e.data.length_mm) p.push(`${num(e.data.length_mm / 10, 1)} cm`);
      if (e.data.place) p.push(PLACE_LABEL[e.data.place].toLowerCase());
      return p.join(", ") || "Mesure";
    }
  }
}

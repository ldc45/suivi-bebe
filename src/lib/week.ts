/**
 * La semaine en un coup d’œil : tendances (lait, sommeil, couches) et constats écrits en phrases.
 * Fonctions pures, testées dans week.test.ts. `entries` est trié du plus récent au plus ancien.
 */
import { agree, type Baby, subject } from "@/babies/types";
import { interval } from "@/entries/describe";
import type { Entry, EntryOf } from "@/entries/types";
import { num } from "./format";
import { entriesOfDay, expectedWet, sleepOfDay, sumBottles } from "./rules";
import { addDays, dayKey, dur, H, hm, keyToDate, MIN } from "./time";

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const isFeed = (e: Entry) => e.type === "bottle" || e.type === "breastfeeding";

export type Trend = "up" | "down" | "flat";

export interface Series {
  /** Une valeur par jour, du plus ancien au jour affiché. */
  values: number[];
  /** Moyenne des jours précédents qui ont des données (le jour affiché, souvent incomplet, est exclu). */
  average: number;
  /** La veille comparée aux jours d’avant (au moins 3 jours de données), ou null. */
  trend: Trend | null;
}

function series(values: number[]): Series {
  const before = values.slice(0, -1).filter((v) => v > 0);
  const yesterday = values[values.length - 2] ?? 0;
  const earlier = values.slice(0, -2).filter((v) => v > 0);
  let trend: Trend | null = null;
  if (yesterday > 0 && earlier.length >= 3) {
    const r = yesterday / mean(earlier);
    trend = r > 1.1 ? "up" : r < 0.9 ? "down" : "flat";
  }
  return { values, average: mean(before), trend };
}

/** Lait bu (ml) par jour ; nombre de repas si le bébé ne prend pas de biberon. */
export const milkSeries = (entries: Entry[], days: string[]) => series(days.map((k) => sumBottles(entriesOfDay(entries, k))));
export const feedSeries = (entries: Entry[], days: string[]) => series(days.map((k) => entriesOfDay(entries, k).filter(isFeed).length));
/** Sommeil (ms) par jour, de minuit à minuit. */
export const sleepSeries = (entries: Entry[], days: string[], now = Date.now()) => series(days.map((k) => sleepOfDay(entries, k, now).total * H));
/** Couches mouillées par jour. */
export const peeSeries = (entries: Entry[], days: string[]) =>
  series(days.map((k) => entriesOfDay(entries, k).filter((e) => e.type === "diaper" && e.data.pee).length));

/** Plus long sommeil terminé sur la période. */
export function longestSleep(entries: Entry[], from: number, to: number): EntryOf<"sleep"> | null {
  let best: EntryOf<"sleep"> | null = null, len = 0;
  for (const e of entries) {
    if (e.type !== "sleep" || e.inProgress || e.startedAt < from || e.startedAt >= to) continue;
    const [a, b] = interval(e);
    if (b - a > len) { len = b - a; best = e; }
  }
  return best;
}

/** « S’il semble », « Si elle semble », « Si Leï semble ». */
const ifSeems = (b: Baby) => (b.sex === "m" ? "S’il semble" : b.sex === "f" ? "Si elle semble" : `Si ${b.name || "bébé"} semble`);

const period = (h: number) => (h >= 5 && h < 12 ? "le matin" : h >= 12 && h < 18 ? "l’après-midi" : h >= 18 && h < 23 ? "le soir" : "la nuit");

/**
 * « Ce qu’on remarque » : 2 à 4 constats simples sur les derniers jours, du plus utile au moins utile.
 * Ce sont des repères calculés, pas un avis médical.
 */
export function weekInsights(b: Baby, entries: Entry[], now = Date.now()): string[] {
  const out: string[] = [], who = subject(b), today = dayKey(now);

  // 1. Rythme des repas sur 3 jours : écart moyen et quantité moyenne d’un biberon.
  const feeds = entries.filter((e) => isFeed(e) && now - e.startedAt < 3 * 24 * H && e.startedAt <= now).map((e) => e.startedAt).sort((x, y) => x - y);
  const gaps = feeds.slice(1).map((t, i) => t - feeds[i]).filter((g) => g > 20 * MIN && g < 8 * H);
  if (gaps.length >= 5) {
    const bottles = entries.filter((e): e is EntryOf<"bottle"> => e.type === "bottle" && now - e.startedAt < 3 * 24 * H);
    const ml = bottles.length >= 3 ? Math.round(mean(bottles.map((e) => e.data.ml)) / 5) * 5 : 0;
    const every = dur(Math.round(mean(gaps) / (15 * MIN)) * 15 * MIN);
    out.push(ml ? `${who} boit en moyenne ${num(ml)} ml toutes les ${every}.` : `${who} mange en moyenne toutes les ${every}.`);
  }

  // 2. Moins (ou plus) de lait hier que d’habitude. Une baisse de 30 % ou plus est déjà signalée par les alertes.
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const milk = milkSeries(entries, days);
  const yesterday = milk.values[5], usual = mean(milk.values.slice(0, 5).filter((v) => v > 0));
  if (yesterday > 0 && milk.values.slice(0, 5).filter((v) => v > 0).length >= 3) {
    const r = yesterday / usual;
    if (r >= 1.15) out.push(`${who} a bu plus que d’habitude hier : ${num(yesterday)} ml contre ${num(usual, 0)} ml en moyenne.`);
    else if (r <= 0.85 && r > 0.7) out.push(`${who} a bu un peu moins que d’habitude hier : ${num(yesterday)} ml contre ${num(usual, 0)} ml en moyenne.`);
  }

  // 3. Quand a lieu son plus long sommeil (au moins 3 jours terminés).
  const longest = days.slice(0, 6).map((k) => {
    const s = keyToDate(k).getTime();
    return longestSleep(entries, s - 6 * H, s + 18 * H);
  }).filter((e): e is EntryOf<"sleep"> => !!e);
  if (longest.length >= 3) {
    const hour = median(longest.map((e) => new Date(e.startedAt).getHours() + new Date(e.startedAt).getMinutes() / 60));
    const len = mean(longest.map((e) => { const [a, c] = interval(e); return c - a; }));
    out.push(`Son plus long sommeil commence en général vers ${Math.round(hour) % 24} h, ${period(Math.round(hour) % 24)} (${dur(Math.round(len / (5 * MIN)) * 5 * MIN)} en moyenne).`);
  }

  // 4. Selles : écart inhabituel depuis la dernière.
  const poos = entries.filter((e) => e.type === "diaper" && e.data.poo && e.startedAt <= now).map((e) => e.startedAt);
  if (poos.length >= 4) {
    const usualGap = median(poos.slice(0, -1).map((t, i) => t - poos[i + 1]).filter((g) => g < 4 * 24 * H));
    const since = now - poos[0];
    if (usualGap && since > Math.max(24 * H, 1.5 * usualGap)) {
      out.push(`Pas de selle depuis ${dur(Math.round(since / H) * H)}, plus longtemps que d’habitude (environ toutes les ${dur(Math.round(usualGap / H) * H)}). ${ifSeems(b)} ${agree(b, "gêné")} ou si ça dure, parlez-en à votre médecin.`);
    }
  }

  // 5. Couches mouillées hier sous le repère.
  const pee = peeSeries(entries, days).values[5], exp = expectedWet(b, now - 24 * H);
  if (entriesOfDay(entries, days[5]).some((e) => e.type === "diaper") && pee < exp) {
    out.push(`Hier, ${pee} couche${pee > 1 ? "s" : ""} mouillée${pee > 1 ? "s" : ""} seulement (repère : au moins ${exp}). Vérifiez qu’il n’y a pas d’oubli de saisie.`);
  }

  return out.slice(0, 4);
}

/** Heure lisible d’un sommeil : « jeudi, 01:20 ». */
export const sleepWhen = (e: Entry) => `${new Date(e.startedAt).toLocaleDateString("fr-FR", { weekday: "long" })} à ${hm(e.startedAt)}`;

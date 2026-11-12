/**
 * Règles métier : seuils selon l’âge, repères, alertes, statut des journées.
 * Fonctions pures, sans dépendance à React ni à Supabase (testées dans rules.test.ts).
 */
import { agree, type Baby } from "@/babies/types";
import { interval } from "@/entries/describe";
import { ENTRY_ORDER, type Entry, type EntryOf, type EntryType, STOOL } from "@/entries/types";
import { num } from "./format";
import { ago, ageDays, DAY, dayKey, dayRange, H, keyToDate, overlap } from "./time";

export interface ResolvedThresholds {
  fever: number; wetMin: number; gapH: number; gapAuto: boolean; dropPct: number; tummyMin: number; mlPerKg: number;
}

export function autoGap(age: number | null): number {
  if (age == null || age < 30) return 4;
  if (age < 90) return 5;
  return 0;
}

export function thresholds(b: Baby | null): ResolvedThresholds {
  const t = b?.settings.thresholds ?? {};
  const age = ageDays(b?.birthDate);
  const gapSet = typeof t.gapH === "number";
  return {
    fever: t.fever || 38,
    wetMin: t.wetMin || 6,
    gapH: gapSet ? (t.gapH as number) : autoGap(age),
    gapAuto: !gapSet,
    dropPct: t.dropPct || 30,
    tummyMin: t.tummyMin || 30,
    mlPerKg: t.mlPerKg || 150,
  };
}

export const visibleTypes = (b: Baby | null): EntryType[] =>
  ENTRY_ORDER.filter((t) => !(b?.settings.hidden_types ?? []).includes(t));

export interface GrowthPoint { at: number; value: number; birth?: boolean; entry?: EntryOf<"growth"> }

const birthNoon = (b: Baby) => keyToDate(b.birthDate).getTime() + 12 * H;

/** Poids en kg : naissance + pesées, triés par date. */
export function weights(b: Baby, entries: Entry[]): GrowthPoint[] {
  const pts: GrowthPoint[] = [];
  if (b.birthWeightG) pts.push({ at: birthNoon(b), value: b.birthWeightG / 1000, birth: true });
  for (const e of entries) if (e.type === "growth" && e.data.weight_g) pts.push({ at: e.startedAt, value: e.data.weight_g / 1000, entry: e });
  return pts.sort((x, y) => x.at - y.at);
}

/** Tailles en cm : naissance + mesures. */
export function lengths(b: Baby, entries: Entry[]): GrowthPoint[] {
  const pts: GrowthPoint[] = [];
  if (b.birthLengthMm) pts.push({ at: birthNoon(b), value: b.birthLengthMm / 10, birth: true });
  for (const e of entries) if (e.type === "growth" && e.data.length_mm) pts.push({ at: e.startedAt, value: e.data.length_mm / 10, entry: e });
  return pts.sort((x, y) => x.at - y.at);
}

/** Repère quotidien de lait en ml, à partir de 7 jours et d’un poids connu. */
export function milkTarget(b: Baby, entries: Entry[]): { ml: number; kg: number } | null {
  const w = weights(b, entries), age = ageDays(b.birthDate);
  if (!w.length || age == null || age < 7) return null;
  const kg = w[w.length - 1].value;
  return { ml: Math.round((kg * thresholds(b).mlPerKg) / 10) * 10, kg };
}

/** Nombre de couches mouillées attendu sur 24 h. */
export function expectedWet(b: Baby, at = Date.now()): number {
  const age = ageDays(b.birthDate, at);
  return age != null && age < 5 ? Math.max(1, age + 1) : thresholds(b).wetMin;
}

/**
 * Index des saisies par jour, calculé une seule fois par liste : le journal et les graphiques
 * demandent des centaines de jours, et refiltrer toute la liste à chaque fois ralentissait les téléphones.
 */
const dayIndex = new WeakMap<Entry[], Map<string, Entry[]>>();
const EMPTY: Entry[] = [];

/** Saisies commencées le jour k, dans l’ordre de la liste (ne pas modifier le tableau renvoyé). */
export function entriesOfDay(entries: Entry[], k: string): Entry[] {
  let idx = dayIndex.get(entries);
  if (!idx) {
    idx = new Map();
    for (const x of entries) {
      const d = dayKey(x.startedAt), list = idx.get(d);
      if (list) list.push(x); else idx.set(d, [x]);
    }
    dayIndex.set(entries, idx);
  }
  return idx.get(k) ?? EMPTY;
}
export const sumBottles = (list: Entry[]) => list.reduce((a, e) => a + (e.type === "bottle" ? e.data.ml : 0), 0);

/** Temps d’une activité à durée (sommeil, tummy time) dans une plage. */
export function timeIn(entries: Entry[], type: "sleep" | "tummy", from: number, to: number, now = Date.now()): number {
  return entries.reduce((a, e) => {
    if (e.type !== type) return a;
    const [x, y] = interval(e, now);
    return a + overlap(x, y, from, Math.min(to, now));
  }, 0);
}

/** Sommeil d’un jour en heures : total et part de nuit (20 h à 8 h). */
export function sleepOfDay(entries: Entry[], k: string, now = Date.now()) {
  const [s, e] = dayRange(k);
  const total = timeIn(entries, "sleep", s, e, now);
  const night = timeIn(entries, "sleep", s, s + 8 * H, now) + timeIn(entries, "sleep", s + 20 * H, e, now);
  return { total: total / H, night: night / H, day: (total - night) / H };
}

/**
 * Heure estimée du prochain repas : dernier repas + écart moyen entre les repas des dernières 24 heures.
 * Les écarts de plus de 8 h (oubli de saisie probable) sont ignorés ; l’écart retenu est borné entre 1 h 30 et 5 h.
 * Sans assez de données (moins de deux écarts), on retient 3 h. `entries` est trié du plus récent au plus ancien.
 */
export function nextFeed(entries: Entry[], now = Date.now()): { at: number; gap: number; last: Entry } | null {
  const feeds = entries.filter((e) => (e.type === "bottle" || e.type === "breastfeeding") && e.startedAt <= now);
  if (!feeds.length) return null;
  const recent = feeds.filter((e) => now - e.startedAt < 24 * H).map((e) => e.startedAt).sort((a, b) => a - b);
  const gaps = recent.slice(1).map((t, i) => t - recent[i]).filter((g) => g > 20 * 60_000 && g < 8 * H);
  const avg = gaps.length >= 2 ? gaps.reduce((a, g) => a + g, 0) / gaps.length : 3 * H;
  const gap = Math.min(5 * H, Math.max(1.5 * H, avg));
  return { at: feeds[0].startedAt + gap, gap, last: feeds[0] };
}

export type AlertLevel = "urgent" | "attention" | "rappel" | "info";
export interface Alert { level: AlertLevel; title: string; text: string }

/** Alertes du moment. `entries` doit être trié du plus récent au plus ancien. */
export function computeAlerts(b: Baby, entries: Entry[], now = Date.now()): Alert[] {
  const out: Alert[] = [];
  const age = ageDays(b.birthDate, now), th = thresholds(b), name = b.name || "Bébé";
  const young = age != null && age < 90;

  const t = entries.find((e): e is EntryOf<"temperature"> => e.type === "temperature");
  if (t && now - t.startedAt < 12 * H) {
    const v = t.data.celsius;
    if (v >= th.fever) out.push({
      level: young ? "urgent" : "attention",
      title: `Fièvre : ${num(v, 1)} °C ${ago(t.startedAt, now)}`,
      text: young
        ? "Avant 3 mois, toute fièvre demande un avis médical rapide. Appelez votre médecin, ou le 15 si vous ne pouvez pas le joindre."
        : `Surveillez son comportement, son hydratation et ses couches. Consultez si la fièvre dure plus de 48 h, si ${name} est inhabituellement ${agree(b, "abattu")} ou en cas de doute.`,
    });
    else if (v < 36) out.push({ level: "attention", title: `Température basse : ${num(v, 1)} °C`, text: "Reprenez la température. Si elle reste basse, demandez un avis médical." });
  }

  const seen = new Set<string>();
  for (const e of entries) {
    if (e.type !== "diaper" || now - e.startedAt > 48 * H || !e.data.poo || !e.data.color) continue;
    const c = e.data.color;
    if (!STOOL[c].alert || seen.has(c)) continue;
    if (c === "black" && age != null && age < 4) continue;
    seen.add(c);
    if (c === "pale") out.push({ level: "urgent", title: `Selles très pâles ${ago(e.startedAt, now)}`, text: "Des selles blanches, grises ou couleur mastic doivent être signalées à votre médecin sans attendre. Comparez avec la carte de couleur des selles du carnet de santé et gardez la couche si possible." });
    if (c === "red") out.push({ level: "urgent", title: `Selles rouges ${ago(e.startedAt, now)}`, text: "Du sang dans les selles demande un avis médical. Prenez une photo de la couche pour la montrer." });
    if (c === "black") out.push({ level: "attention", title: `Selles noires ${ago(e.startedAt, now)}`, text: "Après les premiers jours (méconium), des selles noires sont à signaler à votre médecin. Un supplément de fer peut aussi les foncer : précisez-le-lui." });
  }

  const diapers = entries.filter((e): e is EntryOf<"diaper"> => e.type === "diaper");
  const oldest = diapers.length ? diapers[diapers.length - 1].startedAt : null;
  if (oldest && now - oldest >= 24 * H) {
    const wet = diapers.filter((e) => now - e.startedAt < 24 * H && e.data.pee).length;
    const exp = expectedWet(b, now);
    if (wet < exp) out.push({
      level: "attention",
      title: `${wet} couche${wet > 1 ? "s" : ""} mouillée${wet > 1 ? "s" : ""} sur 24 h`,
      text: `Repère à cet âge : au moins ${exp}. Si ce n’est pas un oubli de saisie, un nombre faible peut signaler que ${name} ne boit pas assez. Parlez-en à votre médecin, surtout si les urines sont foncées ou ${b.sex === "f" ? "si elle est moins réactive" : "s’il est moins réactif"}.`,
    });
  }

  if (th.gapH > 0) {
    const last = entries.find((e) => e.type === "bottle" || e.type === "breastfeeding");
    if (last && now - last.startedAt > th.gapH * H) out.push({
      level: age != null && age < 30 && now - last.startedAt > (th.gapH + 2) * H ? "attention" : "rappel",
      title: `Dernier repas ${ago(last.startedAt, now)}`,
      text: `Repère ${th.gapAuto ? "pour son âge" : "choisi"} : un repas environ toutes les ${th.gapH} h. Pensez à lui proposer à manger.`,
    });
  }

  const today = dayKey(now);
  const totals = Array.from({ length: 8 }, (_, i) => {
    const d = keyToDate(today); d.setDate(d.getDate() - 8 + i);
    return sumBottles(entriesOfDay(entries, dayKey(d.getTime())));
  });
  const yest = totals[7], prev = totals.slice(0, 7).filter((v) => v > 0);
  if (prev.length >= 5 && yest > 0) {
    const avg = prev.reduce((a, v) => a + v, 0) / prev.length;
    if (yest < avg * (1 - th.dropPct / 100)) out.push({
      level: "info",
      title: "Moins de lait bu hier",
      text: `${num(yest)} ml contre ${num(avg)} ml en moyenne sur les jours précédents. Une journée plus calme arrive ; si la baisse dure ou s’accompagne d’autres signes, parlez-en à votre médecin.`,
    });
  }

  const rank: Record<AlertLevel, number> = { urgent: 0, attention: 1, rappel: 2, info: 3 };
  return out.sort((a, c) => rank[a.level] - rank[c.level]);
}

export type DayStatus = "" | "ok" | "check" | "alert";

/** Statut d’une journée pour le journal. */
export function dayStatus(b: Baby, entries: Entry[], k: string, now = Date.now()): { list: Entry[]; ml: number; feeds: number; status: DayStatus; future: boolean } {
  const [s, e] = dayRange(k), list = entriesOfDay(entries, k), th = thresholds(b);
  const ml = sumBottles(list);
  const feeds = list.filter((x) => x.type === "bottle" || x.type === "breastfeeding").length;
  const done = e <= now, ageAt = Math.round((s - keyToDate(b.birthDate).getTime()) / DAY);
  let status: DayStatus = list.length ? "ok" : "";
  const fever = list.some((x) => x.type === "temperature" && x.data.celsius >= th.fever);
  const stool = list.some((x) => x.type === "diaper" && x.data.poo && x.data.color && STOOL[x.data.color].alert && !(x.data.color === "black" && ageAt < 4));
  if (fever || stool) status = "alert";
  else if (done && list.length) {
    const prev: number[] = [];
    for (let i = 1; i <= 7; i++) { const d = keyToDate(k); d.setDate(d.getDate() - i); const v = sumBottles(entriesOfDay(entries, dayKey(d.getTime()))); if (v) prev.push(v); }
    if (ml && prev.length >= 2 && ml < (prev.reduce((a, v) => a + v, 0) / prev.length) * (1 - th.dropPct / 100)) status = "check";
    const dia = list.filter((x): x is EntryOf<"diaper"> => x.type === "diaper");
    if (dia.length && dia.filter((x) => x.data.pee).length < (ageAt < 5 ? Math.max(1, ageAt + 1) : th.wetMin)) status = "check";
  }
  return { list, ml, feeds, status, future: s > now };
}

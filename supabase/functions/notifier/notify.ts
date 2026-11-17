/**
 * Contenu des notifications : quoi dire, avec quel « sujet » (tag), et si c'est important.
 * Module pur, sans dépendance : utilisé par la fonction Supabase « notifier » (index.ts) et testé par Vitest.
 */

export interface EntryRow {
  id: string;
  baby_id: string;
  type: string;
  started_at: string;
  ended_at: string | null;
  in_progress: boolean;
  data: Record<string, unknown> | null;
  created_by: string | null;
}

export interface BabyInfo { name: string; sex: "f" | "m" | null; fever: number; prepRoomMin: number; prepWarmMin: number }

export interface Message {
  title: string;
  body: string;
  /** Une seule notification par sujet : la nouvelle remplace l'ancienne. */
  tag: string;
  /** Fièvre, selles à signaler, biberon à jeter : passent le mode silencieux de la nuit et « L'important seulement ». */
  important: boolean;
  /** « bottle » : réglage Biberon préparé ; « other » : réglage Ce que fait l'autre parent. */
  category: "bottle" | "other";
}

export interface Prefs { bottle?: boolean; other?: "all" | "important" | "none" }

export const TZ = "Europe/Paris";
const MIN = 60_000;

export const hm = (ms: number, tz = TZ) =>
  new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(ms));

export function dur(ms: number): string {
  const m = Math.max(0, Math.round(ms / MIN));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
}

const num = (v: unknown, dec = 0) =>
  Number(v).toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

/** Nuit (21 h à 7 h, heure de Paris) : notifications sans son ni vibration, sauf si importantes. */
export function isNight(now: number, tz = TZ): boolean {
  // formatToParts : en français, l'heure seule se formate « 21 h », pas « 21 ».
  const part = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: tz }).formatToParts(new Date(now)).find((p) => p.type === "hour");
  const h = Number(part?.value);
  return h >= 21 || h < 7;
}

export function wants(prefs: Prefs | null | undefined, msg: Message): boolean {
  if (msg.category === "bottle") return prefs?.bottle !== false;
  const other = prefs?.other ?? "all";
  return other === "all" || (other === "important" && msg.important);
}

const STOOL_ALERT: Record<string, string> = { pale: "très pâles", red: "rouges (sang)", black: "noires" };
const agree = (b: BabyInfo, word: string) => (b.sex === "f" ? `${word}e` : word);

/** Heure limite d'un biberon préparé : 1 h à température ambiante, 30 min tiédi (réglables par bébé). */
export function bottleDeadline(e: EntryRow, b: BabyInfo): number {
  const warmed = Boolean((e.data ?? {}).warmed);
  return Date.parse(e.started_at) + (warmed ? b.prepWarmMin : b.prepRoomMin) * MIN;
}

/**
 * Notification pour une saisie créée ou modifiée par un parent (à envoyer aux autres membres du foyer).
 * `old` : la saisie avant modification (null pour une création). Renvoie null quand il n'y a rien à dire
 * (une simple correction de saisie, par exemple).
 */
export function entryMessage(e: EntryRow, old: EntryRow | null, baby: BabyInfo, author: string, tz = TZ): Message | null {
  const d = e.data ?? {}, at = hm(Date.parse(e.started_at), tz), by = `par ${author}`, k = e.baby_id;

  // Modifications : seul le réveil (fin d'un sommeil en cours) est annoncé.
  if (old) {
    if (e.type === "sleep" && old.in_progress && !e.in_progress && e.ended_at) {
      const len = Date.parse(e.ended_at) - Date.parse(e.started_at);
      return { title: `${baby.name} est ${agree(baby, "réveillé")}`, body: `Après ${dur(len)} de sommeil, noté ${by}.`, tag: `sommeil-${k}`, important: false, category: "other" };
    }
    return null;
  }

  switch (e.type) {
    case "bottle":
      if (e.in_progress) {
        return { title: `Biberon préparé ${by}`, body: `${num(d.ml)} ml, à donner avant ${hm(bottleDeadline(e, baby), tz)}.`, tag: `biberon-${e.id}`, important: false, category: "bottle" };
      }
      return { title: `Biberon donné ${by}`, body: `${num(d.ml)} ml à ${at}.`, tag: `repas-${k}`, important: false, category: "other" };
    case "breastfeeding":
      return { title: `Tétée notée ${by}`, body: `À ${at}.`, tag: `repas-${k}`, important: false, category: "other" };
    case "solid":
      return { title: `Repas solide noté ${by}`, body: `${String(d.food ?? "")} à ${at}.`, tag: `repas-${k}`, important: false, category: "other" };
    case "diaper": {
      const what = d.pee && d.poo ? "pipi et caca" : d.poo ? "caca" : "pipi";
      const alert = d.poo && typeof d.color === "string" ? STOOL_ALERT[d.color] : undefined;
      if (alert) return { title: `Selles ${alert} à signaler`, body: `Couche changée ${by} à ${at}. Montrez-la à votre médecin.`, tag: `couche-${k}`, important: true, category: "other" };
      return { title: `Couche changée ${by}`, body: `${what[0].toUpperCase()}${what.slice(1)}, à ${at}.`, tag: `couche-${k}`, important: false, category: "other" };
    }
    case "sleep":
      if (!e.in_progress) return null;
      return { title: `${baby.name} s'est ${agree(baby, "endormi")}`, body: `À ${at}, noté ${by}.`, tag: `sommeil-${k}`, important: false, category: "other" };
    case "medication":
      return { title: `${String(d.name ?? "Médicament")} : prise notée ${by}`, body: `À ${at}${d.dose ? `, ${String(d.dose)}` : ""}.`, tag: `soin-${k}`, important: false, category: "other" };
    case "temperature": {
      const c = Number(d.celsius);
      if (c >= baby.fever) return { title: `Fièvre : ${num(c, 1)} °C`, body: `Relevée ${by} à ${at}. Avant 3 mois, appelez votre médecin ; urgence : 15.`, tag: `soin-${k}`, important: true, category: "other" };
      return { title: `Température : ${num(c, 1)} °C`, body: `Relevée ${by} à ${at}.`, tag: `soin-${k}`, important: false, category: "other" };
    }
    case "tummy":
      return e.in_progress ? null : { title: `Tummy time noté ${by}`, body: `À ${at}.`, tag: `soin-${k}`, important: false, category: "other" };
    case "growth":
      return { title: `Pesée notée ${by}`, body: d.weight_g ? `${num(Number(d.weight_g) / 1000, 2)} kg.` : `À ${at}.`, tag: `soin-${k}`, important: false, category: "other" };
    case "pumping":
      return { title: `Tire-lait noté ${by}`, body: `À ${at}.`, tag: `repas-${k}`, important: false, category: "other" };
    default:
      return null;
  }
}

/** Rappel d'un biberon préparé : 10 min avant l'heure limite, puis à l'heure limite. */
export type ReminderKind = "soon" | "expired";
export const SOON_MIN = 10;

export function bottleReminder(e: EntryRow, baby: BabyInfo, sent: Set<ReminderKind>, now: number, tz = TZ): { kind: ReminderKind; msg: Message } | null {
  if (e.type !== "bottle" || !e.in_progress) return null;
  const end = bottleDeadline(e, baby), d = e.data ?? {}, tag = `biberon-${e.id}`;
  // Au-delà d'une heure après la limite, on ne rattrape plus un rappel manqué.
  if (now >= end + 60 * MIN) return null;
  if (now >= end) {
    if (sent.has("expired")) return null;
    return { kind: "expired", msg: { title: "Biberon à jeter", body: `Préparé à ${hm(Date.parse(e.started_at), tz)} (${num(d.ml)} ml), délai dépassé.`, tag, important: true, category: "bottle" } };
  }
  if (now >= end - SOON_MIN * MIN && !sent.has("soon") && !sent.has("expired")) {
    return { kind: "soon", msg: { title: `Biberon à donner avant ${hm(end, tz)}`, body: `Dans ${dur(end - now)} (${num(d.ml)} ml).`, tag, important: false, category: "bottle" } };
  }
  return null;
}

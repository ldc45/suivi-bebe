/** Utilitaires de dates et de durées, tous en heure locale. */

export const MIN = 60_000;
export const H = 3_600_000;
export const DAY = 86_400_000;

const DOW = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
export const MON = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export const pad = (n: number) => String(n).padStart(2, "0");

/** Clé de jour « AAAA-MM-JJ » en heure locale. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function keyToDate(k: string): Date {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}
/** Début et fin (exclue) d’un jour, en millisecondes. */
export function dayRange(k: string): [number, number] {
  const s = keyToDate(k);
  const e = new Date(s);
  e.setDate(e.getDate() + 1);
  return [s.getTime(), e.getTime()];
}
export function addDays(k: string, n: number): string {
  const d = keyToDate(k);
  d.setDate(d.getDate() + n);
  return dayKey(d.getTime());
}
/** Les n jours se terminant au jour k, du plus ancien au plus récent. */
export function daysEnding(k: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(k, i - n + 1));
}
export const todayKey = () => dayKey(Date.now());
export const overlap = (a1: number, a2: number, b1: number, b2: number) => Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));

export function hm(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function dur(ms: number): string {
  const m = Math.max(0, Math.round(ms / MIN));
  // Espaces insécables : une durée ne se coupe jamais en fin de ligne (« 2 » puis « h »).
  if (m < 60) return `${m}\u00a0min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}\u00a0h\u00a0${pad(r)}` : `${h}\u00a0h`;
}
export function ago(ms: number, now = Date.now()): string {
  const d = now - ms;
  return d < MIN ? "à l’instant" : `il y a ${dur(d)}`;
}
export function dayLabel(k: string): string {
  if (k === todayKey()) return "Aujourd’hui";
  if (k === addDays(todayKey(), -1)) return "Hier";
  const d = keyToDate(k);
  return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
}
export function dateLabel(k: string): string {
  const l = dayLabel(k);
  return l === "Aujourd’hui" ? "aujourd’hui" : l === "Hier" ? "hier" : `le ${l}`;
}
export const shortDay = (k: string) => { const d = keyToDate(k); return `${d.getDate()}/${pad(d.getMonth() + 1)}`; };
export const dowLetter = (k: string) => DOW[keyToDate(k).getDay()].charAt(0).toUpperCase();

/** Valeurs pour <input type="date"> et <input type="time">. */
export const toDateInput = (ms: number) => dayKey(ms);
export const toTimeInput = (ms: number) => hm(ms);
export function fromInputs(date: string, time: string): number {
  return date && time ? new Date(`${date}T${time}`).getTime() : NaN;
}

export function ageDays(birthDate: string | null | undefined, at = Date.now()): number | null {
  if (!birthDate) return null;
  return Math.round((keyToDate(dayKey(at)).getTime() - keyToDate(birthDate).getTime()) / DAY);
}
export function ageLabel(birthDate: string | null | undefined): string {
  const a = ageDays(birthDate);
  if (a == null || !birthDate) return "";
  if (a < 0) return "naissance à venir";
  if (a === 0) return "premier jour";
  if (a < 14) return a === 1 ? "1 jour" : `${a} jours`;
  if (a < 61) return `${Math.floor(a / 7)} semaines`;
  const b = keyToDate(birthDate), n = new Date();
  let m = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth();
  if (n.getDate() < b.getDate()) m--;
  return m < 24 ? `${m} mois` : `${Math.floor(m / 12)} ans`;
}

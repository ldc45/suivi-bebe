/**
 * Préférences d’affichage, propres à chaque téléphone (stockage local) :
 * thème clair, sombre ou automatique, et mode nuit (lumière ambrée très faible).
 * Le même calcul est fait dans index.html avant le premier affichage, pour éviter un flash de lumière.
 */
import { useSyncExternalStore } from "react";

export type Theme = "auto" | "light" | "dark";
export interface DisplayPrefs {
  theme: Theme;
  /** Mode nuit automatique entre NIGHT_FROM et NIGHT_TO. */
  autoNight: boolean;
  /** Mode nuit allumé à la main jusqu’à cette heure (ms). */
  nightUntil?: number;
  /** Mode nuit automatique éteint à la main jusqu’à cette heure (ms). */
  offUntil?: number;
}

const KEY = "suivi-bebe:display";
export const NIGHT_FROM = 21;
export const NIGHT_TO = 7;
const DEFAULTS: DisplayPrefs = { theme: "auto", autoNight: false };

function load(): DisplayPrefs {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return DEFAULTS; }
}
let prefs = load();
const listeners = new Set<() => void>();

const inNightHours = (now: number) => { const h = new Date(now).getHours(); return h >= NIGHT_FROM || h < NIGHT_TO; };
/** Prochain matin à NIGHT_TO heures. */
function nextMorning(now: number) {
  const d = new Date(now); d.setHours(NIGHT_TO, 0, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

export function isNight(p = prefs, now = Date.now()) {
  if (p.nightUntil && now < p.nightUntil) return true;
  return p.autoNight && inNightHours(now) && !(p.offUntil && now < p.offUntil);
}

function apply() {
  const root = document.documentElement, night = isNight();
  if (prefs.theme === "auto") delete root.dataset.theme; else root.dataset.theme = prefs.theme;
  if (night) root.dataset.night = ""; else delete root.dataset.night;
  // Couleur de la barre du navigateur : une seule balise quand le thème est imposé.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const light = m.media.includes("light");
    m.content = night ? "#140A07" : prefs.theme === "dark" ? "#1B1828" : prefs.theme === "light" ? "#F5F2F9" : light ? "#F5F2F9" : "#1B1828";
  });
}

function set(next: DisplayPrefs) {
  prefs = next;
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* stockage indisponible */ }
  apply();
  lastNight = isNight();
  listeners.forEach((l) => l());
}

export const setTheme = (theme: Theme) => set({ ...prefs, theme });
export const setAutoNight = (autoNight: boolean) => set({ ...prefs, autoNight, offUntil: undefined });

/** Bouton lune : allume ou éteint le mode nuit jusqu’au matin. */
export function toggleNight(now = Date.now()) {
  if (isNight(prefs, now)) set({ ...prefs, nightUntil: undefined, offUntil: prefs.autoNight ? nextMorning(now) : undefined });
  else set({ ...prefs, nightUntil: nextMorning(now), offUntil: undefined });
}

// Réévalue chaque minute : le mode nuit automatique s’allume et s’éteint à l’heure.
let lastNight = isNight();
if (typeof window !== "undefined") {
  apply();
  window.setInterval(() => { const n = isNight(); if (n !== lastNight) { lastNight = n; apply(); listeners.forEach((l) => l()); } }, 60_000);
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
let snapshot = { prefs, night: isNight() };
function getSnapshot() {
  const night = isNight();
  if (snapshot.prefs !== prefs || snapshot.night !== night) snapshot = { prefs, night };
  return snapshot;
}

export function useDisplay() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

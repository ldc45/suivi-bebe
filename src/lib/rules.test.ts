import { describe, expect, it } from "vitest";
import type { Baby } from "@/babies/types";
import type { Entry } from "@/entries/types";
import { computeAlerts, expectedWet, isPrepared, milkTarget, nextFeed, preparedDeadline, thresholds } from "./rules";
import { H } from "./time";

const NOW = new Date("2026-11-11T12:00:00").getTime();
const baby = (over: Partial<Baby> = {}): Baby => ({
  id: "b", householdId: "h", name: "Leï", birthDate: "2026-11-01", sex: "m",
  birthWeightG: 3350, birthLengthMm: 500, settings: {}, createdAt: "", ...over,
});
let n = 0;
const entry = (e: Partial<Entry> & Pick<Entry, "type" | "data">, hoursAgo: number): Entry =>
  ({ id: `e${n++}`, babyId: "b", startedAt: NOW - hoursAgo * H, endedAt: null, inProgress: false, note: null, medicationId: null, createdBy: null, ...e }) as Entry;

describe("seuils", () => {
  it("adapte l’intervalle entre repas à l’âge", () => {
    expect(thresholds(baby()).gapH).toBe(4);
    expect(thresholds(baby({ birthDate: "2026-07-01" })).gapH).toBe(0);
  });
  it("suit l’âge en jours pour les couches avant 5 jours", () => {
    expect(expectedWet(baby({ birthDate: "2026-11-09" }), NOW)).toBe(3);
    expect(expectedWet(baby(), NOW)).toBe(6);
  });
});

describe("repère de lait", () => {
  it("n’existe pas avant 7 jours", () => {
    expect(milkTarget(baby({ birthDate: "2026-11-08" }), [])).toBeNull();
  });
  it("utilise le dernier poids connu", () => {
    const w = entry({ type: "growth", data: { weight_g: 3600 } }, 2);
    expect(milkTarget(baby(), [w])?.ml).toBe(540);
  });
});

describe("alertes", () => {
  it("signale une fièvre comme urgente avant 3 mois", () => {
    const a = computeAlerts(baby(), [entry({ type: "temperature", data: { celsius: 38.4, method: "rectal" } }, 1)], NOW);
    expect(a[0]).toMatchObject({ level: "urgent" });
  });
  it("signale des selles très pâles", () => {
    const a = computeAlerts(baby(), [entry({ type: "diaper", data: { pee: false, poo: true, color: "pale" } }, 3)], NOW);
    expect(a.some((x) => x.title.startsWith("Selles très pâles"))).toBe(true);
  });
  it("ignore les selles noires des premiers jours (méconium)", () => {
    const a = computeAlerts(baby({ birthDate: "2026-11-10" }), [entry({ type: "diaper", data: { pee: false, poo: true, color: "black" } }, 3)], NOW);
    expect(a.some((x) => x.title.startsWith("Selles noires"))).toBe(false);
  });
});

describe("prochain repas", () => {
  const bottle = (hoursAgo: number) => entry({ type: "bottle", data: { ml: 90, milk: "formula" } }, hoursAgo);
  it("ajoute l’écart moyen des dernières 24 h au dernier repas", () => {
    const r = nextFeed([bottle(1), bottle(3.5), bottle(6), bottle(8.5)], NOW);
    expect(r?.gap).toBe(2.5 * H);
    expect(r?.at).toBe(NOW - 1 * H + 2.5 * H);
  });
  it("retient 3 h sans assez de données", () => {
    expect(nextFeed([bottle(1)], NOW)?.gap).toBe(3 * H);
  });
  it("ignore les longs trous (oubli de saisie) et borne l’écart", () => {
    expect(nextFeed([bottle(1), bottle(2), bottle(2.5), bottle(13)], NOW)?.gap).toBe(1.5 * H);
  });
  it("renvoie null sans aucun repas", () => {
    expect(nextFeed([], NOW)).toBeNull();
  });
});

describe("biberon préparé", () => {
  const prep = (warmed: boolean) => entry({ type: "bottle", data: { ml: 90, milk: "formula", warmed }, inProgress: true }, 0) as Extract<Entry, { type: "bottle" }>;
  it("se donne dans l’heure à température ambiante, dans la demi-heure tiédi", () => {
    expect(preparedDeadline(baby(), prep(false))).toBe(NOW + 60 * 60_000);
    expect(preparedDeadline(baby(), prep(true))).toBe(NOW + 30 * 60_000);
  });
  it("suit les durées réglées", () => {
    expect(preparedDeadline(baby({ settings: { thresholds: { prepRoomMin: 45 } } }), prep(false))).toBe(NOW + 45 * 60_000);
  });
  it("n’est pas compté comme un biberon bu", () => {
    expect(isPrepared(prep(false))).toBe(true);
    expect(isPrepared(entry({ type: "bottle", data: { ml: 90, milk: "formula" } }, 1))).toBe(false);
  });
});

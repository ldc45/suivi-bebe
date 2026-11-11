import { describe, expect, it } from "vitest";
import type { Baby } from "@/babies/types";
import type { Entry } from "@/entries/types";
import { computeAlerts, expectedWet, milkTarget, thresholds } from "./rules";
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

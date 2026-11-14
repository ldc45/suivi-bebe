import { describe, expect, it } from "vitest";
import type { Baby } from "@/babies/types";
import type { Entry } from "@/entries/types";
import { H } from "./time";
import { milkSeries, weekInsights } from "./week";
import { addDays, dayKey } from "./time";

const NOW = new Date("2026-11-14T12:00:00").getTime();
const baby = (over: Partial<Baby> = {}): Baby => ({
  id: "b", householdId: "h", name: "Leï", birthDate: "2026-11-01", sex: "m",
  birthWeightG: 3350, birthLengthMm: 500, settings: {}, createdAt: "", ...over,
});
let n = 0;
const at = (t: number, e: Partial<Entry> & Pick<Entry, "type" | "data">): Entry =>
  ({ id: `e${n++}`, babyId: "b", startedAt: t, endedAt: null, inProgress: false, note: null, medicationId: null, createdBy: null, ...e }) as Entry;
const sorted = (l: Entry[]) => l.sort((a, b) => b.startedAt - a.startedAt);
/** Un biberon toutes les 3 h pendant `days` jours avant NOW, de `ml` ml. */
const bottles = (days: number, ml = 90) => Array.from({ length: days * 8 }, (_, i) => at(NOW - (i + 1) * 3 * H, { type: "bottle", data: { ml, milk: "formula" } }));

describe("séries de la semaine", () => {
  it("additionne le lait par jour et exclut le jour en cours de la moyenne", () => {
    const today = dayKey(NOW), days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    const s = milkSeries(sorted(bottles(7)), days);
    expect(s.values[5]).toBe(720);
    expect(s.average).toBe(720);
    expect(s.trend).toBe("flat");
  });
});

describe("ce qu’on remarque", () => {
  it("décrit le rythme des repas", () => {
    expect(weekInsights(baby(), sorted(bottles(4)), NOW)[0]).toBe("Il boit en moyenne 90 ml toutes les 3\u00a0h.");
  });
  it("accorde au féminin et sans sexe renseigné", () => {
    expect(weekInsights(baby({ sex: "f" }), sorted(bottles(4)), NOW)[0]).toMatch(/^Elle boit/);
    expect(weekInsights(baby({ sex: null }), sorted(bottles(4)), NOW)[0]).toMatch(/^Leï boit/);
  });
  it("signale une selle qui tarde par rapport à l’habitude", () => {
    const poos = [30, 42, 54, 66, 78].map((h) => at(NOW - h * H, { type: "diaper", data: { pee: true, poo: true } }));
    const notes = weekInsights(baby(), sorted(poos), NOW);
    expect(notes.some((x) => x.startsWith("Pas de selle depuis 30\u00a0h") && x.includes("S’il semble gêné"))).toBe(true);
  });
  it("ne dit rien sans assez de données", () => {
    expect(weekInsights(baby(), [], NOW)).toEqual([]);
  });
});

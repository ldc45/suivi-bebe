import { describe, expect, it } from "vitest";
import { type BabyInfo, bottleReminder, type EntryRow, entryMessage, isNight, wants } from "../../supabase/functions/notifier/notify";

const baby: BabyInfo = { name: "Leï", sex: "m", fever: 38, prepRoomMin: 60, prepWarmMin: 30 };
const at = (iso: string, over: Partial<EntryRow> & Pick<EntryRow, "type">): EntryRow =>
  ({ id: "e1", baby_id: "b1", started_at: iso, ended_at: null, in_progress: false, data: {}, created_by: "u2", ...over });
// 14 h 48 à Paris, en novembre (UTC+1).
const T = "2026-11-18T13:48:00Z";

describe("messages de l'autre parent", () => {
  it("annonce une couche avec le prénom et l'heure de Paris", () => {
    const m = entryMessage(at(T, { type: "diaper", data: { pee: true, poo: false } }), null, baby, "Ludo")!;
    expect(m.title).toBe("Couche changée par Ludo");
    expect(m.body).toBe("Pipi, à 14:48.");
    expect(m.tag).toBe("couche-b1");
    expect(m.important).toBe(false);
  });
  it("signale des selles à montrer au médecin comme importantes", () => {
    const m = entryMessage(at(T, { type: "diaper", data: { pee: true, poo: true, color: "pale" } }), null, baby, "Ludo")!;
    expect(m.title).toBe("Selles très pâles à signaler");
    expect(m.important).toBe(true);
  });
  it("accorde au féminin et annonce le réveil, pas les simples corrections", () => {
    const fille = { ...baby, name: "Lou", sex: "f" as const };
    const dort = at(T, { type: "sleep", in_progress: true });
    expect(entryMessage(dort, null, fille, "Ludo")!.title).toBe("Lou s'est endormie");
    const reveil = { ...dort, in_progress: false, ended_at: "2026-11-18T15:23:00Z" };
    expect(entryMessage(reveil, dort, fille, "Ludo")!.title).toBe("Lou est réveillée");
    expect(entryMessage({ ...reveil, data: { x: 1 } }, reveil, fille, "Ludo")).toBeNull();
  });
  it("marque la fièvre comme importante", () => {
    expect(entryMessage(at(T, { type: "temperature", data: { celsius: 38.4, method: "rectal" } }), null, baby, "Ludo")!.important).toBe(true);
    expect(entryMessage(at(T, { type: "temperature", data: { celsius: 37.1, method: "rectal" } }), null, baby, "Ludo")!.important).toBe(false);
  });
  it("classe le biberon préparé dans les rappels de biberon", () => {
    const m = entryMessage(at(T, { type: "bottle", in_progress: true, data: { ml: 90, warmed: true } }), null, baby, "Ludo")!;
    expect(m.category).toBe("bottle");
    expect(m.body).toBe("90 ml, à donner avant 15:18.");
  });
});

describe("réglages et nuit", () => {
  const couche = entryMessage(at(T, { type: "diaper", data: { pee: true } }), null, baby, "Ludo")!;
  const fievre = entryMessage(at(T, { type: "temperature", data: { celsius: 39 } }), null, baby, "Ludo")!;
  it("respecte Tout, L'important seulement et Rien", () => {
    expect(wants({ other: "all" }, couche)).toBe(true);
    expect(wants({ other: "important" }, couche)).toBe(false);
    expect(wants({ other: "important" }, fievre)).toBe(true);
    expect(wants({ other: "none" }, fievre)).toBe(false);
    expect(wants(undefined, couche)).toBe(true);
  });
  it("considère 21 h à 7 h comme la nuit, à l'heure de Paris", () => {
    expect(isNight(Date.parse("2026-11-18T20:30:00Z"))).toBe(true); // 21 h 30
    expect(isNight(Date.parse("2026-11-18T05:30:00Z"))).toBe(true); // 6 h 30
    expect(isNight(Date.parse("2026-11-18T13:48:00Z"))).toBe(false);
  });
});

describe("rappels du biberon préparé", () => {
  const prep = at("2026-11-18T13:00:00Z", { type: "bottle", in_progress: true, data: { ml: 90, warmed: true } }); // limite 14 h 30 à Paris
  const t = (iso: string) => Date.parse(iso);
  it("prévient 10 min avant la limite, puis à la limite, une seule fois chacun", () => {
    expect(bottleReminder(prep, baby, new Set(), t("2026-11-18T13:15:00Z"))).toBeNull();
    const soon = bottleReminder(prep, baby, new Set(), t("2026-11-18T13:21:00Z"))!;
    expect(soon.kind).toBe("soon");
    expect(soon.msg.title).toBe("Biberon à donner avant 14:30");
    expect(bottleReminder(prep, baby, new Set(["soon"]), t("2026-11-18T13:25:00Z"))).toBeNull();
    const late = bottleReminder(prep, baby, new Set(["soon"]), t("2026-11-18T13:31:00Z"))!;
    expect(late.kind).toBe("expired");
    expect(late.msg.important).toBe(true);
    expect(bottleReminder(prep, baby, new Set(["soon", "expired"]), t("2026-11-18T13:40:00Z"))).toBeNull();
  });
  it("ne rattrape pas un rappel plus d'une heure après la limite", () => {
    expect(bottleReminder(prep, baby, new Set(), t("2026-11-18T14:45:00Z"))).toBeNull();
  });
});

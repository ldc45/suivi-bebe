import type { CSSProperties } from "react";
import { useApp } from "@/app/AppContext";
import { newId, useEntryMutations } from "@/entries/api";
import { EntrySheet } from "@/entries/EntrySheet";
import { ENTRY_META, type EntryOf } from "@/entries/types";
import { DAY, dayKey, hm, keyToDate, MIN } from "@/lib/time";
import { Icon } from "@/ui/Icon";
import { useSheet, useToast } from "@/ui/Overlay";
import { FREQ_LABEL } from "@/babies/types";

/** Traitements à donner le jour affiché, avec validation en un geste. */
export function MedCards() {
  const { baby, medications, entries, viewDay, isToday, now, userId } = useApp();
  const { save, remove } = useEntryMutations(baby?.id);
  const sheet = useSheet();
  const toast = useToast();
  if (!baby) return null;
  const meds = medications.filter((m) => m.active && (m.frequency === "daily" || m.frequency === "weekly"));
  const cards = meds.flatMap((m) => {
    const given = entries.filter((e): e is EntryOf<"medication"> => e.type === "medication" && e.medicationId === m.id);
    const done = given.find((e) => dayKey(e.startedAt) === viewDay);
    if (m.frequency === "weekly" && !done && (!isToday || (given[0] && now - given[0].startedAt < 6.5 * DAY))) return [];
    let late = false;
    if (isToday && !done && m.timeOfDay) {
      const [h, mi] = m.timeOfDay.split(":").map(Number), due = new Date(); due.setHours(h, mi, 0, 0);
      late = now > due.getTime() + 30 * MIN;
    }
    return [{ m, done, late }];
  });
  if (!cards.length) return null;

  const validate = (id: string) => {
    const m = medications.find((x) => x.id === id)!;
    let ts = Date.now();
    if (!isToday) { const d = keyToDate(viewDay), [h, mi] = (m.timeOfDay ?? "12:00").split(":").map(Number); d.setHours(h, mi, 0, 0); ts = Math.min(d.getTime(), Date.now()); }
    const e: EntryOf<"medication"> = { id: newId(), babyId: baby.id, type: "medication", startedAt: ts, endedAt: null, inProgress: false, note: null, medicationId: m.id, createdBy: userId, data: { name: m.name, dose: m.dose ?? "" } };
    save.mutate(e);
    toast(`${m.name} : prise notée`, () => remove.mutate(e.id));
  };

  return (
    <>
      <h2 className="sec">{isToday ? "À donner aujourd’hui" : "Traitements de ce jour"}</h2>
      {cards.map(({ m, done, late }) => (
        <div key={m.id} className={`medcard${done ? " done" : ""}`} style={{ "--c": ENTRY_META.medication.color } as CSSProperties}>
          <span className={`mtime${late ? " late" : ""}`}>{m.timeOfDay ?? (m.frequency === "weekly" ? "Semaine" : "Jour")}</span>
          <span className="lic"><Icon name="medication" /></span>
          <span className="lt"><b>{m.name}</b><span>{m.dose || FREQ_LABEL[m.frequency]}{done ? `, donné à ${hm(done.startedAt)}` : late ? ", à donner" : ""}</span></span>
          {done
            ? <button type="button" className="mbtn ok" aria-label="Voir la prise" onClick={() => sheet.open(<EntrySheet type="medication" entry={done} />)}><Icon name="check" /></button>
            : <button type="button" className="mbtn" onClick={() => validate(m.id)}>Valider</button>}
        </div>
      ))}
    </>
  );
}

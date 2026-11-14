import { useState } from "react";
import { useApp } from "@/app/AppContext";
import { num, parseNum } from "@/lib/format";
import { preparedDeadline, thresholds } from "@/lib/rules";
import { addDays, fromInputs, hm, MIN, toTimeInput, todayKey } from "@/lib/time";
import { Chips, Field, Stepper } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { SheetLayout, useSheet, useToast } from "@/ui/Overlay";
import { newId, useEntryMutations } from "./api";
import { ENTRY_META, type EntryOf, MILK_LABEL, type Milk } from "./types";

type Temp = "room" | "warm";

const OFFSETS: [number, string][] = [[0, "Maintenant"], [5, "−5 min"], [15, "−15 min"], [30, "−30 min"]];

/**
 * Heure récente : raccourcis ou heure précise. Une heure plus tardive que maintenant désigne la veille
 * (23:50 saisi à 00:10). Renvoie le champ à afficher et une fonction qui lit l’heure choisie (NaN si invalide).
 */
function useRecentTime(label: string, initial?: number) {
  const [chip, setChip] = useState<number | null>(initial ? null : 0);
  const [time, setTime] = useState(toTimeInput(initial ?? Date.now()));
  const read = () => {
    if (chip !== null) return Date.now() - chip * MIN;
    const t = fromInputs(todayKey(), time);
    return t > Date.now() + 5 * MIN ? fromInputs(addDays(todayKey(), -1), time) : t;
  };
  const field = (
    <div className="grp">
      <span className="lab">{label}</span>
      <div className="chips timechips">
        {OFFSETS.map(([o, l]) => <button key={o} type="button" aria-pressed={chip === o} onClick={() => { setChip(o); setTime(toTimeInput(Date.now() - o * MIN)); }}>{l}</button>)}
      </div>
      <input className="inp" type="time" style={{ marginTop: 10 }} value={time} aria-label={label} onChange={(e) => { setTime(e.target.value); setChip(null); }} />
    </div>
  );
  return { field, read };
}

/**
 * Préparer un biberon à l’avance (ou corriger un biberon préparé, avec `entry`) :
 * il s’affiche sur l’accueil avec le temps restant pour le donner.
 */
export function PrepareSheet({ entry }: { entry?: EntryOf<"bottle"> }) {
  const { baby, entries, userId } = useApp();
  const sheet = useSheet();
  const toast = useToast();
  const { save, remove } = useEntryMutations(baby?.id);
  const last = entries.find((e): e is EntryOf<"bottle"> => e.type === "bottle");
  const [ml, setMl] = useState(String(entry?.data.ml ?? last?.data.ml ?? 90));
  const [milk, setMilk] = useState<Milk>(entry?.data.milk ?? last?.data.milk ?? "formula");
  const [temp, setTemp] = useState<Temp>(entry?.data.warmed ? "warm" : "room");
  const when = useRecentTime("Préparé à", entry?.startedAt);
  if (!baby) return null;
  const th = thresholds(baby);
  const TEMP_LABEL: Record<Temp, string> = { room: `Température ambiante (${th.prepRoomMin} min)`, warm: `Tiédi (${th.prepWarmMin} min)` };

  const submit = () => {
    const v = parseNum(ml);
    if (v <= 0) return toast("Indiquez la quantité.");
    const at = when.read();
    if (!Number.isFinite(at)) return toast("Indiquez l’heure de préparation.");
    const e: EntryOf<"bottle"> = {
      id: entry?.id ?? newId(), babyId: baby.id, type: "bottle", startedAt: at, endedAt: null, inProgress: true,
      note: null, medicationId: null, createdBy: entry?.createdBy ?? userId, data: { ml: v, milk, warmed: temp === "warm" },
    };
    save.mutate(e);
    sheet.close();
    const until = `à donner avant ${hm(preparedDeadline(baby, e))}`;
    if (entry) toast(`Biberon modifié, ${until}`, () => save.mutate(entry));
    else toast(`Biberon prêt, ${until}`, () => remove.mutate(e.id));
  };

  return (
    <SheetLayout title={entry ? "Modifier le biberon préparé" : "Biberon préparé"} icon={<Icon name="bottle" />} color={ENTRY_META.bottle.color} onClose={() => sheet.close()}
      footer={<button className="btn primary wide" type="button" onClick={submit}>{entry ? "Enregistrer" : "C’est prêt"}</button>}>
      {when.field}
      <div className="grp"><Stepper value={ml} onChange={setMl} step={10} unit="millilitres préparés" /></div>
      <Field label="Contenu"><Chips name="milk" options={MILK_LABEL} value={milk} onChange={setMilk} /></Field>
      <Field label="Biberon"><Chips name="temp" options={TEMP_LABEL} value={temp} onChange={setTemp} /></Field>
      <p className="small muted">Délais habituels : dans l’heure à température ambiante, dans la demi-heure s’il est tiédi. Suivez les consignes de votre boîte de lait ; les durées se règlent dans Réglages. Le reste d’un biberon entamé se jette.</p>
    </SheetLayout>
  );
}

/** Donner un biberon préparé : on note la quantité réellement bue, et il devient un biberon ordinaire. */
export function GiveSheet({ entry }: { entry: EntryOf<"bottle"> }) {
  const { baby } = useApp();
  const sheet = useSheet();
  const toast = useToast();
  const { save } = useEntryMutations(baby?.id);
  const [ml, setMl] = useState(String(entry.data.ml));
  const when = useRecentTime("Donné à");
  if (!baby) return null;

  const submit = () => {
    const v = parseNum(ml);
    if (v <= 0) return toast("Indiquez la quantité bue.");
    const at = when.read();
    if (!Number.isFinite(at)) return toast("Indiquez l’heure du biberon.");
    if (at < entry.startedAt - MIN) return toast(`Le biberon a été préparé à ${hm(entry.startedAt)} : il ne peut pas avoir été donné avant.`);
    const given: EntryOf<"bottle"> = { ...entry, startedAt: at, inProgress: false, data: { ml: v, milk: entry.data.milk } };
    save.mutate(given);
    sheet.close();
    toast(`Biberon de ${num(v)} ml enregistré`, () => save.mutate(entry));
  };

  return (
    <SheetLayout title="Biberon donné" icon={<Icon name="bottle" />} color={ENTRY_META.bottle.color} onClose={() => sheet.close()}
      footer={<button className="btn primary wide" type="button" onClick={submit}>Enregistrer</button>}>
      <p className="muted" style={{ marginTop: 0 }}>Préparé à {hm(entry.startedAt)} : {num(entry.data.ml)} ml. Quelle quantité a été bue ?</p>
      {when.field}
      <div className="grp"><Stepper value={ml} onChange={setMl} step={10} unit="millilitres bus" /></div>
      <p className="small muted">Jetez ce qui reste dans le biberon.</p>
    </SheetLayout>
  );
}

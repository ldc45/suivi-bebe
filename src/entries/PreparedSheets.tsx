import { useState } from "react";
import { useApp } from "@/app/AppContext";
import { num, parseNum } from "@/lib/format";
import { preparedDeadline, thresholds } from "@/lib/rules";
import { hm } from "@/lib/time";
import { Chips, Field, Stepper } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { SheetLayout, useSheet, useToast } from "@/ui/Overlay";
import { newId, useEntryMutations } from "./api";
import { ENTRY_META, type EntryOf, MILK_LABEL, type Milk } from "./types";

type Temp = "room" | "warm";

/** Préparer un biberon à l’avance : il s’affiche sur l’accueil avec le temps restant pour le donner. */
export function PrepareSheet() {
  const { baby, entries, userId } = useApp();
  const sheet = useSheet();
  const toast = useToast();
  const { save, remove } = useEntryMutations(baby?.id);
  const last = entries.find((e): e is EntryOf<"bottle"> => e.type === "bottle");
  const [ml, setMl] = useState(String(last?.data.ml ?? 90));
  const [milk, setMilk] = useState<Milk>(last?.data.milk ?? "formula");
  const [temp, setTemp] = useState<Temp>("room");
  if (!baby) return null;
  const th = thresholds(baby);
  const TEMP_LABEL: Record<Temp, string> = { room: `Température ambiante (${th.prepRoomMin} min)`, warm: `Tiédi (${th.prepWarmMin} min)` };

  const submit = () => {
    const v = parseNum(ml);
    if (v <= 0) return toast("Indiquez la quantité.");
    const e: EntryOf<"bottle"> = {
      id: newId(), babyId: baby.id, type: "bottle", startedAt: Date.now(), endedAt: null, inProgress: true,
      note: null, medicationId: null, createdBy: userId, data: { ml: v, milk, warmed: temp === "warm" },
    };
    save.mutate(e);
    sheet.close();
    toast(`Biberon prêt, à donner avant ${hm(preparedDeadline(baby, e))}`, () => remove.mutate(e.id));
  };

  return (
    <SheetLayout title="Biberon préparé" icon={<Icon name="bottle" />} color={ENTRY_META.bottle.color} onClose={() => sheet.close()}
      footer={<button className="btn primary wide" type="button" onClick={submit}>C’est prêt</button>}>
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
  if (!baby) return null;

  const submit = () => {
    const v = parseNum(ml);
    if (v <= 0) return toast("Indiquez la quantité bue.");
    const given: EntryOf<"bottle"> = { ...entry, startedAt: Date.now(), inProgress: false, data: { ml: v, milk: entry.data.milk } };
    save.mutate(given);
    sheet.close();
    toast(`Biberon de ${num(v)} ml enregistré`, () => save.mutate(entry));
  };

  return (
    <SheetLayout title="Biberon donné" icon={<Icon name="bottle" />} color={ENTRY_META.bottle.color} onClose={() => sheet.close()}
      footer={<button className="btn primary wide" type="button" onClick={submit}>Enregistrer</button>}>
      <p className="muted" style={{ marginTop: 0 }}>Préparé à {hm(entry.startedAt)} : {num(entry.data.ml)} ml. Quelle quantité a été bue ?</p>
      <div className="grp"><Stepper value={ml} onChange={setMl} step={10} unit="millilitres bus" /></div>
      <p className="small muted">Le biberon est enregistré à l’heure actuelle. Jetez ce qui reste.</p>
    </SheetLayout>
  );
}

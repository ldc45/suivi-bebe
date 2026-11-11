import { useId, useState } from "react";
import { parseNum } from "@/lib/format";
import { todayKey } from "@/lib/time";
import { Chips, Field } from "@/ui/controls";
import type { BabyInput } from "./api";
import { type Baby, SEX_LABEL, type Sex } from "./types";

/** Formulaire de profil : création et modification. */
export function useBabyForm(b?: Baby | null) {
  const id = useId();
  const [name, setName] = useState(b?.name ?? "");
  const [birthDate, setBirthDate] = useState(b?.birthDate ?? "");
  const [sex, setSex] = useState<Sex | null>(b?.sex ?? null);
  const [weight, setWeight] = useState(b?.birthWeightG ? String(b.birthWeightG / 1000) : "");
  const [length, setLength] = useState(b?.birthLengthMm ? String(b.birthLengthMm / 10) : "");

  const read = (): BabyInput | string => {
    const kg = parseNum(weight), cm = parseNum(length);
    if (!name.trim()) return "Indiquez le prénom.";
    if (!birthDate) return "Indiquez la date de naissance.";
    if (kg && (kg < 1 || kg > 7)) return "Vérifiez le poids de naissance, en kilogrammes.";
    if (cm && (cm < 35 || cm > 65)) return "Vérifiez la taille de naissance, en centimètres.";
    return { name: name.trim(), birthDate, sex, birthWeightG: kg ? Math.round(kg * 1000) : null, birthLengthMm: cm ? Math.round(cm * 10) : null };
  };

  const fields = (
    <>
      <Field label="Prénom" htmlFor={`${id}-name`}><input id={`${id}-name`} className="inp" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Date de naissance" htmlFor={`${id}-birth`}><input id={`${id}-birth`} className="inp" type="date" max={todayKey()} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} /></Field>
      <Field label="Sexe"><Chips name="sex" options={SEX_LABEL} value={sex} onChange={setSex} /></Field>
      <div className="row2">
        <Field label="Poids de naissance (kg)" htmlFor={`${id}-w`}><input id={`${id}-w`} className="inp" type="number" inputMode="decimal" step="0.01" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="3,35" /></Field>
        <Field label="Taille de naissance (cm)" htmlFor={`${id}-l`}><input id={`${id}-l`} className="inp" type="number" inputMode="decimal" step="0.5" value={length} onChange={(e) => setLength(e.target.value)} placeholder="Facultatif" /></Field>
      </div>
    </>
  );
  return { fields, read };
}

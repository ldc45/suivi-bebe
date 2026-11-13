import { type CSSProperties, useEffect, useState } from "react";
import { useApp } from "@/app/AppContext";
import { newId, useEntryMutations } from "@/entries/api";
import { PEE_COLOR } from "@/entries/look";
import { ENTRY_META, type Entry, type EntryOf, MILK_LABEL } from "@/entries/types";
import { num } from "@/lib/format";
import { visibleTypes } from "@/lib/rules";
import { Icon } from "@/ui/Icon";
import { useSheet, useToast } from "@/ui/Overlay";
import { PrepareSheet } from "@/entries/PreparedSheets";

/**
 * Saisie en un geste, sans formulaire : le même biberon que la dernière fois, ou une couche pipi.
 * Enregistré à l'heure actuelle ; le message « Annuler » rattrape un appui par erreur.
 */
export function OneTap() {
  const { baby, entries, isToday, userId } = useApp();
  const { save, remove } = useEntryMutations(baby?.id);
  const toast = useToast();
  const sheet = useSheet();
  // Bloque le bouton un court instant après l’appui : évite un double enregistrement par double toucher.
  const [justDone, setJustDone] = useState<string | null>(null);
  useEffect(() => { if (!justDone) return; const t = window.setTimeout(() => setJustDone(null), 1500); return () => window.clearTimeout(t); }, [justDone]);
  if (!baby || !isToday) return null;
  const vis = visibleTypes(baby);
  const lastBottle = entries.find((e): e is EntryOf<"bottle"> => e.type === "bottle");

  const record = (e: Entry, msg: string) => {
    save.mutate(e);
    toast(msg, () => remove.mutate(e.id));
  };
  const base = () => ({ id: newId(), babyId: baby.id, startedAt: Date.now(), endedAt: null, inProgress: false, note: null, medicationId: null, createdBy: userId });

  const actions: { key: string; color: string; icon: "bottle" | "pee"; label: string; detail: string; run: () => void }[] = [];
  if (vis.includes("bottle") && lastBottle) {
    const { ml, milk } = lastBottle.data;
    actions.push({
      key: "bottle", color: ENTRY_META.bottle.color, icon: "bottle", label: `Biberon de ${num(ml)} ml`, detail: MILK_LABEL[milk],
      run: () => record({ ...base(), type: "bottle", data: { ml, milk } }, `Biberon de ${num(ml)} ml enregistré`),
    });
  }
  if (vis.includes("diaper")) {
    actions.push({
      key: "pee", color: PEE_COLOR, icon: "pee", label: "Couche pipi", detail: "Sans selles",
      run: () => record({ ...base(), type: "diaper", data: { pee: true, poo: false } }, "Couche pipi enregistrée"),
    });
  }
  if (!actions.length) return null;
  const canPrepare = vis.includes("bottle");

  return (
    <>
    <div className="onetap" role="group" aria-label="Enregistrer maintenant, en un geste">
      {actions.map((a) => (
        <button key={a.key} type="button" style={{ "--c": a.color } as CSSProperties} disabled={justDone === a.key} onClick={() => { setJustDone(a.key); a.run(); }}>
          <span className="lic"><Icon name={a.icon} /></span>
          <span className="lt"><b>{a.label}</b><span>{a.detail}</span></span>
        </button>
      ))}
    </div>
    {canPrepare && <button type="button" className="prepbtn" style={{ "--c": ENTRY_META.bottle.color } as CSSProperties} onClick={() => sheet.open(<PrepareSheet />)}>
      <Icon name="clock" />Préparer un biberon à l’avance
    </button>}
    </>
  );
}

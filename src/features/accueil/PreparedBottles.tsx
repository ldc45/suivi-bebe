import { useEffect, useState } from "react";
import { useApp } from "@/app/AppContext";
import { useEntryMutations } from "@/entries/api";
import { GiveSheet } from "@/entries/PreparedSheets";
import { num } from "@/lib/format";
import { preparedDeadline } from "@/lib/rules";
import { dur, hm, MIN } from "@/lib/time";
import { useSheet, useToast } from "@/ui/Overlay";

/** Seuil à partir duquel le bandeau passe à l’orange. */
const SOON = 10 * MIN;

/**
 * Biberons préparés en attente, avec le temps restant pour les donner.
 * Partagés entre les parents : celui qui prépare et celui qui donne voient le même bandeau.
 */
export function PreparedBottles() {
  const { baby, prepared } = useApp();
  const sheet = useSheet();
  const toast = useToast();
  const { save, remove } = useEntryMutations(baby?.id);
  // Horloge propre, plus fine que celle de l’appli (une minute) : le compte à rebours reste juste.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!prepared.length) return;
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, [prepared.length]);
  if (!baby || !prepared.length) return null;

  return (
    <>
      {prepared.map((e) => {
        const end = preparedDeadline(baby, e), left = end - now;
        const state = left <= 0 ? "expired" : left <= SOON ? "soon" : "ok";
        return (
          <div key={e.id} className={`prepbar ${state}`} role="status">
            <div className="pt">
              <b>{state === "expired" ? "Biberon à jeter" : `Biberon de ${num(e.data.ml)} ml prêt`}</b>
              <span>Préparé à {hm(e.startedAt)}{e.data.warmed ? ", tiédi" : ""}{state === "expired" ? `, délai dépassé de ${dur(-left)}` : `, à donner avant ${hm(end)}`}</span>
            </div>
            {state !== "expired" && <span className="num left">{dur(left)}</span>}
            <div className="pa">
              {state !== "expired" && <button type="button" className="btn primary" onClick={() => sheet.open(<GiveSheet entry={e} />)}>Donné</button>}
              <button type="button" className={`btn${state === "expired" ? " primary" : ""}`} onClick={() => { remove.mutate(e.id); toast("Biberon jeté", () => save.mutate(e)); }}>Jeté</button>
            </div>
          </div>
        );
      })}
    </>
  );
}

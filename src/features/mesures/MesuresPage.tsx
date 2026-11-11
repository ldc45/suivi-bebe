import { type CSSProperties, useState } from "react";
import { useApp } from "@/app/AppContext";
import { useUpdateBaby } from "@/babies/api";
import { EntrySheet } from "@/entries/EntrySheet";
import { LogList } from "@/entries/rows";
import { ENTRY_META, PLACE_LABEL } from "@/entries/types";
import { num } from "@/lib/format";
import { type GrowthPoint, lengths, weights } from "@/lib/rules";
import { ageDays, DAY, dateLabel, dayKey, dayLabel, keyToDate } from "@/lib/time";
import { DAYS_PER_MONTH, type GrowthKind, whoZ, zLabel } from "@/lib/who";
import { Toggle } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { useSheet } from "@/ui/Overlay";
import { Charts } from "../evolution/Evolution";
import { GrowthChart } from "./GrowthChart";

type Tab = "weight" | "length" | "temperature";

function insights(kind: GrowthKind, pts: GrowthPoint[], birthDate: string, sex: "f" | "m" | null, who: boolean): string[] {
  if (!pts.length) return [];
  const out: string[] = [], last = pts[pts.length - 1], age = ageDays(birthDate);
  if (kind === "weight") {
    const birth = pts.find((p) => p.birth);
    if (birth && last !== birth && last.at - birth.at < 45 * DAY) {
      const pct = ((last.value - birth.value) / birth.value) * 100;
      out.push(pct >= 0 ? `Poids de naissance retrouvé (+${num(pct, 1)} %).` : `Encore ${num(-pct, 1)} % sous le poids de naissance.`);
    }
    if (pts.length >= 2) { const p = pts[pts.length - 2], days = (last.at - p.at) / DAY; if (days >= 1) out.push(`Gain moyen depuis la pesée précédente : ${last.value >= p.value ? "+" : ""}${num(((last.value - p.value) * 1000) / days)} g par jour.`); }
  } else if (pts.length >= 2) out.push(`+${num(last.value - pts[pts.length - 2].value, 1)} cm depuis la mesure précédente.`);
  if (who && sex) {
    const m = (last.at - keyToDate(birthDate).getTime()) / DAY / DAYS_PER_MONTH;
    if (m >= 1 && m <= 24) out.push(`Repères OMS : dernière mesure ${zLabel(whoZ(kind, sex, m, last.value))}. Ce qui compte surtout, c’est que la courbe garde un couloir régulier.`);
    else if (m < 1) out.push("Les repères OMS s’affichent à partir d’un mois, comme les courbes du carnet de santé.");
  }
  if (kind === "weight" && age != null && age < 31) out.push("Avant un mois, le pédiatre surveille surtout la perte de poids des premiers jours puis le retour au poids de naissance.");
  return out;
}

export function MesuresPage() {
  const { baby, entries } = useApp();
  const sheet = useSheet();
  const update = useUpdateBaby(baby);
  const [tab, setTab] = useState<Tab>("weight");
  if (!baby) return null;
  const tabs: [Tab, string][] = [["weight", "Poids"], ...(baby.settings.show_length !== false ? [["length", "Taille"] as [Tab, string]] : []), ["temperature", "Température"]];
  const current = tabs.some(([t]) => t === tab) ? tab : "weight";
  const color = { "--c": ENTRY_META.growth.color } as CSSProperties;

  let content;
  if (current === "temperature") {
    content = <>
      <div className="ch" style={{ margin: "4px 0 12px" }}><b>30 derniers jours</b><button type="button" className="hbtn sm" style={{ "--c": ENTRY_META.temperature.color } as CSSProperties} onClick={() => sheet.open(<EntrySheet type="temperature" />)}>+ Température</button></div>
      <Charts type="temperature" range={30} />
      <LogList entries={entries.filter((e) => e.type === "temperature").slice(0, 10)} withDay empty="Aucune température enregistrée." />
    </>;
  } else {
    const kind = current;
    const pts = kind === "weight" ? weights(baby, entries) : lengths(baby, entries);
    const last = pts[pts.length - 1], unit = kind === "weight" ? "kg" : "cm", dec = kind === "weight" ? 2 : 1;
    const who = !!baby.settings.who_curves;
    const info = insights(kind, pts, baby.birthDate, baby.sex, who);
    content = <>
      <div className="card">
        <div className="ch">
          <div><b>Courbe de {kind === "weight" ? "poids" : "taille"}</b><span>{last ? `${num(last.value, dec)} ${unit} ${dateLabel(dayKey(last.at))}` : "aucune mesure"}</span></div>
          <button type="button" className="hbtn sm" style={color} onClick={() => sheet.open(<EntrySheet type="growth" />)}>+ {kind === "weight" ? "Pesée" : "Mesure"}</button>
        </div>
        <GrowthChart baby={baby} kind={kind} points={pts} showWho={who} />
        <label className="set-item" style={{ border: 0, padding: "10px 0 0" }}>
          <span className="small">Afficher les repères OMS{!baby.sex && <><br /><span className="muted">Indiquez le sexe dans Réglages pour les activer.</span></>}</span>
          <Toggle checked={who} disabled={!baby.sex} label="Afficher les repères OMS" onChange={(v) => update.mutate({ settings: { ...baby.settings, who_curves: v } })} />
        </label>
      </div>
      {info.length > 0 && <div className="card small">{info.map((t) => <p key={t}>{t}</p>)}</div>}
      <h2 className="sec">{kind === "weight" ? "Pesées" : "Mesures"}</h2>
      {pts.length ? (
        <div className="lbox">{[...pts].reverse().map((p, i) => p.birth
          ? <div className="lrow" key={`b${i}`} style={color}><span className="lic"><Icon name="growth" /></span><span className="lt"><b>{num(p.value, dec)} {unit}</b><span>à la naissance, depuis le profil</span></span><span className="lh">{dayLabel(dayKey(p.at))}</span></div>
          : <button type="button" className="lrow" key={p.entry!.id} style={color} onClick={() => sheet.open(<EntrySheet type="growth" entry={p.entry} />)}>
              <span className="lic"><Icon name="growth" /></span>
              <span className="lt"><b>{num(p.value, dec)} {unit}</b><span>{[p.entry?.data.place ? PLACE_LABEL[p.entry.data.place] : "", p.entry?.note].filter(Boolean).join(". ")}</span></span>
              <span className="lh">{dayLabel(dayKey(p.at))}</span>
            </button>)}
        </div>
      ) : <p className="empty">{kind === "weight" ? "Ajoutez le poids de naissance dans Réglages, puis les pesées au fil des visites." : "Ajoutez la taille de naissance dans Réglages, puis les mesures du pédiatre."}</p>}
    </>;
  }

  return (
    <>
      <h1 className="ptitle">Poids et mesures</h1>
      <div className="pills">{tabs.map(([t, l]) => <button key={t} type="button" aria-pressed={current === t} onClick={() => setTab(t)}>{l}</button>)}</div>
      {content}
    </>
  );
}

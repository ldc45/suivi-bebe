import type { CSSProperties } from "react";
import { useApp } from "@/app/AppContext";
import { EntrySheet } from "@/entries/EntrySheet";
import { LogList } from "@/entries/rows";
import { ENTRY_META, type EntryOf, FEEDS, MILK_LABEL, type Milk } from "@/entries/types";
import { num, plural, round5 } from "@/lib/format";
import { entriesOfDay, milkTarget, sumBottles, visibleTypes } from "@/lib/rules";
import { dayLabel, daysEnding, dur, hm } from "@/lib/time";
import { DayNav } from "@/ui/DayNav";
import { useSheet } from "@/ui/Overlay";
import { PrepareSheet } from "@/entries/PreparedSheets";
import { PreparedBottles } from "../accueil/PreparedBottles";
import { Evolution } from "../evolution/Evolution";

const MILK_COLOR: Record<Milk, string> = { formula: ENTRY_META.bottle.color, breast: ENTRY_META.pumping.color, other: "#A79FBD" };

export function RepasPage() {
  const { baby, entries, viewDay, isToday, now } = useApp();
  const sheet = useSheet();
  if (!baby) return null;
  const vis = visibleTypes(baby);
  const feeds = vis.filter((t) => FEEDS.includes(t));
  const bib = vis.includes("bottle");
  const day = entriesOfDay(entries, viewDay);
  const ml = sumBottles(day);
  const tetees = day.filter((e): e is EntryOf<"breastfeeding"> => e.type === "breastfeeding");
  const solids = day.filter((e) => e.type === "solid");
  const tmin = tetees.reduce((a, e) => a + e.data.left_min + e.data.right_min, 0);
  const target = bib ? milkTarget(baby, entries) : null;
  const lastType = entries.find((e) => feeds.includes(e.type))?.type ?? feeds[0] ?? "bottle";
  const openNew = () => sheet.open(<EntrySheet key={Date.now()} type={lastType} />);

  const lastFeed = (isToday ? entries : day).find((e) => e.type === "bottle" || e.type === "breastfeeding");
  const counts = daysEnding(viewDay, 4).slice(0, 3).map((k) => entriesOfDay(entries, k).filter((e) => e.type === "bottle").length).filter((n) => n > 0);
  const per = target && counts.length ? target.ml / (counts.reduce((a, n) => a + n, 0) / counts.length) : null;

  const extra: string[] = [];
  if (tetees.length) extra.push(`${tetees.length} ${plural(tetees.length, "tétée")}${tmin ? ` (${tmin} min)` : ""}`);
  if (solids.length) extra.push(`${solids.length} ${plural(solids.length, "repas solide", "repas solides")}`);

  const week = daysEnding(viewDay, 7).flatMap((k) => entriesOfDay(entries, k)).filter((e): e is EntryOf<"bottle"> => e.type === "bottle");
  const byMilk = week.reduce<Partial<Record<Milk, number>>>((a, e) => ({ ...a, [e.data.milk]: (a[e.data.milk] ?? 0) + e.data.ml }), {});
  const totW = Object.values(byMilk).reduce((a, v) => a + (v ?? 0), 0);
  const log = (isToday ? entries : day).filter((e) => [...FEEDS, "pumping"].includes(e.type)).slice(0, isToday ? 12 : 50);

  return (
    <>
      <DayNav />
      {isToday && bib && <PreparedBottles />}
      <div className="hero" style={{ "--c": ENTRY_META.bottle.color } as CSSProperties}>
        <div className="hl">{bib ? (isToday ? "Lait aujourd’hui" : `Lait, ${dayLabel(viewDay)}`) : (isToday ? "Repas aujourd’hui" : `Repas, ${dayLabel(viewDay)}`)}</div>
        <div className="hrow"><span className="num hbig">{bib ? `${num(ml)} ml` : tetees.length + solids.length}</span><button type="button" className="hbtn" onClick={openNew}>+ Repas</button></div>
        {isToday && bib && <button type="button" className="link" style={{ color: "var(--text)", fontWeight: 600 }} onClick={() => sheet.open(<PrepareSheet />)}>Préparer un biberon à l’avance</button>}
        {extra.length > 0 && <div className="hs" style={{ color: "var(--text)" }}>{bib ? "Plus " : ""}{extra.join(" et ")}</div>}
        {bib && (target ? <>
          <div className="bar"><i style={{ width: `${Math.min(100, Math.round((ml / target.ml) * 100))}%` }} /></div>
          <div className="hs">{Math.min(100, Math.round((ml / target.ml) * 100))} % du repère indicatif de {num(target.ml)} ml, calculé sur {num(target.kg, 2)} kg</div>
        </> : <div className="hs">Le repère quotidien s’affiche à partir de 7 jours, avec un poids enregistré.</div>)}
      </div>
      <div className="mini2">
        <div className="mini"><span className="num">{lastFeed ? (isToday ? dur(now - lastFeed.startedAt) : hm(lastFeed.startedAt)) : "–"}</span><span>{isToday ? "depuis le dernier repas" : "dernier repas du jour"}</span>{per && <em>Préparer {round5(per * 0.8)} à {round5(per * 1.2)} ml par biberon</em>}</div>
        <div className="mini"><span className="num">{day.filter((e) => FEEDS.includes(e.type)).length}</span><span>{isToday ? "repas aujourd’hui" : "repas ce jour"}</span></div>
      </div>
      {totW > 0 && (
        <div className="card">
          <div className="ch"><b>Répartition sur 7 jours</b></div>
          <div className="split">{(Object.keys(byMilk) as Milk[]).map((k) => <i key={k} style={{ flex: byMilk[k], background: MILK_COLOR[k] }} />)}</div>
          <div className="legend">{(Object.keys(byMilk) as Milk[]).map((k) => <span key={k}><i style={{ "--c": MILK_COLOR[k] } as CSSProperties} />{MILK_LABEL[k]} {Math.round(((byMilk[k] ?? 0) / totW) * 100)} %</span>)}</div>
        </div>
      )}
      <Evolution types={vis.filter((t) => FEEDS.includes(t) || t === "pumping")} />
      <h2 className="sec">{isToday ? "Derniers repas" : "Repas du jour"}</h2>
      <LogList entries={log} withDay empty="Aucun repas enregistré." />
    </>
  );
}

import type { CSSProperties } from "react";
import { useApp } from "@/app/AppContext";
import { TimeRow } from "@/entries/rows";
import { EntrySheet } from "@/entries/EntrySheet";
import { ENTRY_META } from "@/entries/types";
import { num } from "@/lib/format";
import { computeAlerts, entriesOfDay, sumBottles, timeIn, visibleTypes } from "@/lib/rules";
import { dayLabel, dayRange, daysEnding, dur, hm } from "@/lib/time";
import { DayNav } from "@/ui/DayNav";
import { useSheet } from "@/ui/Overlay";
import { Legend, Timeline } from "@/ui/Timeline";
import { lookOf, POO_COLOR } from "@/entries/look";
import { Dial } from "./Dial";
import { MedCards } from "./MedCards";
import { OneTap } from "./OneTap";

export function AccueilPage() {
  const { baby, entries, viewDay, isToday, now } = useApp();
  const sheet = useSheet();
  if (!baby) return null;
  const vis = visibleTypes(baby);
  const day = entriesOfDay(entries, viewDay);
  const [s0, s1] = dayRange(viewDay);

  const running = isToday ? entries.filter((e) => e.inProgress) : [];
  const lastFeed = entries.find((e) => e.type === "bottle" || e.type === "breastfeeding");
  const lastDiaper = entries.find((e) => e.type === "diaper");
  const sleeping = entries.find((e) => e.type === "sleep" && e.inProgress);

  let big = "–", cap = "aucun repas enregistré", sub = "";
  if (isToday) {
    if (sleeping) { big = dur(now - sleeping.startedAt); cap = "de sommeil"; }
    else if (lastFeed) { big = dur(now - lastFeed.startedAt); cap = `depuis le dernier ${lastFeed.type === "bottle" ? "biberon" : "allaitement"}`; }
  } else {
    const feeds = day.filter((e) => e.type === "bottle" || e.type === "breastfeeding");
    big = String(feeds.length); cap = "repas ce jour-là"; sub = feeds.length ? `dernier à ${hm(feeds[0].startedAt)}` : "";
  }

  // « Depuis » : sorti du cadran pour lui laisser de la place. Le dernier repas n’y figure que si le cadran
  // affiche déjà autre chose (sommeil en cours).
  const lastPoo = entries.find((e) => e.type === "diaper" && e.data.poo);
  const since: { key: string; label: string; e: (typeof entries)[number]; color: string }[] = [];
  if (isToday) {
    if (sleeping && lastFeed) since.push({ key: "feed", label: "Repas", e: lastFeed, color: ENTRY_META[lastFeed.type].color });
    if (vis.includes("diaper") && lastDiaper) since.push({ key: "diaper", label: "Couche", e: lastDiaper, color: lookOf(lastDiaper).color });
    if (vis.includes("diaper") && lastPoo) since.push({ key: "poo", label: "Caca", e: lastPoo, color: POO_COLOR });
  }

  const stats: [string, string][] = [];
  if (vis.includes("bottle")) stats.push([`${num(sumBottles(day))} ml`, isToday ? "bus aujourd’hui" : "bus ce jour"]);
  const tet = day.filter((e) => e.type === "breastfeeding").length;
  if (vis.includes("breastfeeding") && (tet || !vis.includes("bottle"))) stats.push([String(tet), tet > 1 ? "tétées" : "tétée"]);
  if (vis.includes("diaper")) stats.push([`${day.filter((e) => e.type === "diaper" && e.data.pee).length} / ${day.filter((e) => e.type === "diaper" && e.data.poo).length}`, "pipi / caca"]);
  if (vis.includes("sleep")) stats.push([dur(timeIn(entries, "sleep", s0, s1, now)), "de sommeil"]);

  const alerts = isToday ? computeAlerts(baby, entries, now) : [];
  const timelineTypes = vis.filter((t) => t !== "growth");

  return (
    <>
      <DayNav />
      {running.map((e) => (
        <div key={e.id} className="sleepbar" style={{ "--c": ENTRY_META[e.type].color } as CSSProperties}>
          <div><b>{e.type === "sleep" ? "Sommeil en cours" : `${ENTRY_META[e.type].label} en cours`}</b><div className="small muted">depuis {hm(e.startedAt)}</div></div>
          <span className="num">{dur(now - e.startedAt)}</span>
          <button type="button" className="btn primary" onClick={() => sheet.open(<EntrySheet type={e.type} entry={e} />)}>{e.type === "sleep" ? "Réveil" : "Terminer"}</button>
        </div>
      ))}
      <Dial day={viewDay} entries={entries} now={now} center={<><div className="big num">{big}</div><div className="cap">{cap}</div>{sub && <div className="sub">{sub}</div>}</>} />
      <div className="daystats">{stats.map(([v, l]) => <div key={l}><span className="num">{v}</span><span>{l}</span></div>)}</div>
      <OneTap />
      {since.length > 0 && (
        <div className="since" role="group" aria-label="Temps écoulé depuis le dernier repas, la dernière couche et le dernier caca">
          {since.map((x) => (
            <button key={x.key} type="button" style={{ "--c": x.color } as CSSProperties} onClick={() => sheet.open(<EntrySheet type={x.e.type} entry={x.e} />)}>
              <span>{x.label}</span><b className="num">{dur(now - x.e.startedAt)}</b><span>depuis {hm(x.e.startedAt)}</span>
            </button>
          ))}
        </div>
      )}
      <MedCards />
      {alerts.length > 0 && (
        <div className="alerts">
          {alerts.map((a) => <div key={a.title} className={`note ${a.level}`}><b>{a.title}</b><p>{a.text}</p></div>)}
          <p className="disclaimer">Repères indicatifs selon l’âge de {baby.name}. Ils ne remplacent pas un avis médical. Urgence : 15 ou 112.</p>
        </div>
      )}
      <h2 className="sec">Rythme des 7 derniers jours</h2>
      <div className="card"><Timeline days={daysEnding(viewDay, 7)} entries={entries} types={timelineTypes} now={now} /><Legend types={timelineTypes} /></div>
      <h2 className="sec">{isToday ? "Aujourd’hui" : dayLabel(viewDay)}</h2>
      {day.length
        ? <ul className="tlist">{day.map((e) => <TimeRow key={e.id} entry={e} />)}</ul>
        : <p className="empty">{isToday ? "Rien encore depuis minuit." : "Aucune saisie ce jour-là."} Le bouton + en bas permet d’ajouter une saisie{isToday ? "" : " à cette date"}.</p>}
    </>
  );
}

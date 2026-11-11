import type { CSSProperties } from "react";
import { useApp } from "@/app/AppContext";
import { interval } from "@/entries/describe";
import { EntrySheet } from "@/entries/EntrySheet";
import { LogList } from "@/entries/rows";
import { ENTRY_META } from "@/entries/types";
import { timeIn } from "@/lib/rules";
import { dayLabel, dayRange, dur, hm, overlap } from "@/lib/time";
import { DayNav } from "@/ui/DayNav";
import { useSheet } from "@/ui/Overlay";
import { Evolution } from "../evolution/Evolution";

export function SommeilPage() {
  const { baby, entries, viewDay, isToday, now } = useApp();
  const sheet = useSheet();
  if (!baby) return null;
  const [s0, s1] = dayRange(viewDay);
  const sleeps = entries.filter((e) => e.type === "sleep");
  const running = sleeps.find((e) => e.inProgress);
  const inDay = (e: (typeof sleeps)[number]) => { const [a, b] = interval(e, now); return overlap(a, b, s0, Math.min(s1, now)); };
  const daySleeps = sleeps.filter((e) => inDay(e) > 0);
  const total = timeIn(entries, "sleep", s0, s1, now);
  const lastEnd = sleeps.filter((e) => !e.inProgress).sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt))[0];
  const longest = daySleeps.reduce((m, e) => Math.max(m, inDay(e)), 0);

  const action = isToday && running
    ? <button type="button" className="hbtn" onClick={() => sheet.open(<EntrySheet type="sleep" entry={running} />)}>Réveil</button>
    : <button type="button" className="hbtn" onClick={() => sheet.open(<EntrySheet type="sleep" />)}>{isToday ? "Il s’endort" : "+ Sommeil"}</button>;

  return (
    <>
      <DayNav />
      <div className="hero" style={{ "--c": ENTRY_META.sleep.color } as CSSProperties}>
        <div className="hl">{isToday ? "Sommeil aujourd’hui" : `Sommeil, ${dayLabel(viewDay)}`}</div>
        <div className="hrow"><span className="num hbig">{dur(total)}</span>{action}</div>
        <div className="hs">{isToday && running ? `Endormi à ${hm(running.startedAt)}, depuis ${dur(now - running.startedAt)}` : "Total sur la journée, de minuit à minuit"}</div>
      </div>
      <div className="mini2">
        <div className="mini">
          <span className="num">{isToday ? (running ? dur(now - running.startedAt) : lastEnd ? dur(now - (lastEnd.endedAt ?? lastEnd.startedAt)) : "–") : longest ? dur(longest) : "–"}</span>
          <span>{isToday ? (running ? "de sommeil en cours" : "éveillé depuis") : "plus long sommeil"}</span>
        </div>
        <div className="mini"><span className="num">{daySleeps.length}</span><span>{daySleeps.length > 1 ? "siestes et nuits" : "sieste ou nuit"}</span></div>
      </div>
      <Evolution types={["sleep"]} />
      <h2 className="sec">{isToday ? "Derniers sommeils" : "Sommeils du jour"}</h2>
      <LogList entries={isToday ? sleeps.slice(0, 12) : daySleeps} withDay empty="Aucun sommeil enregistré." />
    </>
  );
}

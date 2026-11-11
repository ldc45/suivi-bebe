import type { CSSProperties } from "react";
import { useApp } from "@/app/AppContext";
import { interval } from "@/entries/describe";
import { EntrySheet } from "@/entries/EntrySheet";
import { LogList } from "@/entries/rows";
import { ENTRY_META } from "@/entries/types";
import { thresholds, timeIn } from "@/lib/rules";
import { dayLabel, dayRange, dur, MIN, overlap } from "@/lib/time";
import { DayNav } from "@/ui/DayNav";
import { useSheet } from "@/ui/Overlay";
import { Evolution } from "../evolution/Evolution";

export function TummyPage() {
  const { baby, entries, viewDay, isToday, now } = useApp();
  const sheet = useSheet();
  if (!baby) return null;
  const goal = thresholds(baby).tummyMin;
  const [s0, s1] = dayRange(viewDay);
  const sessions = entries.filter((e) => e.type === "tummy");
  const running = sessions.find((e) => e.inProgress);
  const inDay = (e: (typeof sessions)[number]) => { const [a, b] = interval(e, now); return overlap(a, b, s0, Math.min(s1, now)); };
  const daySessions = sessions.filter((e) => inDay(e) > 0);
  const total = Math.round(timeIn(entries, "tummy", s0, s1, now) / MIN);
  const pct = Math.min(100, Math.round((total / goal) * 100));
  const longest = daySessions.reduce((m, e) => Math.max(m, inDay(e)), 0);

  const action = isToday && running
    ? <button type="button" className="hbtn" onClick={() => sheet.open(<EntrySheet type="tummy" entry={running} />)}>Terminer</button>
    : <button type="button" className="hbtn" onClick={() => sheet.open(<EntrySheet type="tummy" />)}>{isToday ? "Démarrer" : "+ Séance"}</button>;

  return (
    <>
      <DayNav />
      <div className="hero" style={{ "--c": ENTRY_META.tummy.color } as CSSProperties}>
        <div className="hl">{isToday ? "Tummy time aujourd’hui" : `Tummy time, ${dayLabel(viewDay)}`}</div>
        <div className="hrow"><span className="num hbig">{total} min</span>{action}</div>
        <div className="bar"><i style={{ width: `${pct}%` }} /></div>
        <div className="hs">{isToday && running ? `Séance en cours depuis ${dur(now - running.startedAt)}. ` : ""}{pct} % de l’objectif de {goal} min par jour, à répartir en courtes séances</div>
      </div>
      <div className="mini2">
        <div className="mini"><span className="num">{daySessions.length}</span><span>{daySessions.length > 1 ? "séances" : "séance"}</span></div>
        <div className="mini"><span className="num">{longest ? `${Math.round(longest / MIN)} min` : "–"}</span><span>plus longue séance</span></div>
      </div>
      <Evolution types={["tummy"]} />
      <h2 className="sec">{isToday ? "Dernières séances" : "Séances du jour"}</h2>
      <LogList entries={isToday ? sessions.slice(0, 12) : daySessions} withDay empty="Aucune séance enregistrée." />
    </>
  );
}

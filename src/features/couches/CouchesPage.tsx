import type { CSSProperties } from "react";
import { useApp } from "@/app/AppContext";
import { EntrySheet } from "@/entries/EntrySheet";
import { LogList } from "@/entries/rows";
import { ENTRY_META, type EntryOf } from "@/entries/types";
import { plural } from "@/lib/format";
import { entriesOfDay, expectedWet } from "@/lib/rules";
import { dayLabel, dur, hm } from "@/lib/time";
import { DayNav } from "@/ui/DayNav";
import { useSheet } from "@/ui/Overlay";
import { Evolution } from "../evolution/Evolution";

export function CouchesPage() {
  const { baby, entries, viewDay, isToday, now } = useApp();
  const sheet = useSheet();
  if (!baby) return null;
  const day = entriesOfDay(entries, viewDay).filter((e): e is EntryOf<"diaper"> => e.type === "diaper");
  const wet = day.filter((e) => e.data.pee).length;
  const last = (isToday ? entries : day).find((e) => e.type === "diaper");
  const pee = day.filter((e) => e.data.pee && !e.data.poo).length, poo = day.filter((e) => e.data.poo && !e.data.pee).length, both = day.filter((e) => e.data.pee && e.data.poo).length;
  const log = isToday ? entries.filter((e) => e.type === "diaper").slice(0, 12) : day;
  return (
    <>
      <DayNav />
      <div className="hero" style={{ "--c": ENTRY_META.diaper.color } as CSSProperties}>
        <div className="hl">{isToday ? "Couches aujourd’hui" : `Couches, ${dayLabel(viewDay)}`}</div>
        <div className="hrow"><span className="num hbig">{day.length}</span><button type="button" className="hbtn" onClick={() => sheet.open(<EntrySheet type="diaper" />)}>+ Couche</button></div>
        <div className="hs">dont {wet} {plural(wet, "mouillée")}, repère sur une journée : au moins {expectedWet(baby)}</div>
      </div>
      <div className="mini2">
        <div className="mini"><span className="num">{last ? (isToday ? dur(now - last.startedAt) : hm(last.startedAt)) : "–"}</span><span>{isToday ? "depuis la dernière" : "dernière du jour"}</span></div>
        <div className="mini"><span className="num">{pee} · {poo} · {both}</span><span>pipi · caca · les deux</span></div>
      </div>
      <Evolution types={["diaper"]} />
      <h2 className="sec">{isToday ? "Dernières couches" : "Couches du jour"}</h2>
      <LogList entries={log} withDay empty="Aucune couche enregistrée." />
    </>
  );
}

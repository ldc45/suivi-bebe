import type { CSSProperties } from "react";
import { useApp } from "@/app/AppContext";
import { interval } from "@/entries/describe";
import { lookBackground, lookOf, PEE_COLOR, POO_COLOR } from "@/entries/look";
import { ENTRY_META, type Entry, type EntryType } from "@/entries/types";
import { dayRange, dowLetter, hm, keyToDate, MIN, overlap, todayKey } from "@/lib/time";

/**
 * Rythme de la semaine, pensé pour un téléphone : un jour par colonne, de minuit (en haut) à minuit (en bas).
 * La hauteur de l’écran donne bien plus de place aux heures qu’une frise horizontale.
 * Trois couloirs par colonne, pour que rien ne se superpose : repas à gauche, sommeil au centre, soins à droite.
 */
const LANE: Partial<Record<EntryType, "feed" | "sleep" | "care">> = {
  bottle: "feed", breastfeeding: "feed", solid: "feed", pumping: "feed",
  sleep: "sleep", tummy: "sleep",
  diaper: "care", medication: "care", temperature: "care",
};
const HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

export function WeekRhythm({ days, entries, now, types }: { days: string[]; entries: Entry[]; now: number; types: EntryType[] }) {
  const { setViewDay } = useApp();
  const items = entries.filter((e) => types.includes(e.type) && LANE[e.type]);
  const today = todayKey();

  const columns = days.map((k) => {
    const [d0, d1] = dayRange(k), span = d1 - d0;
    const marks = items.flatMap((e) => {
      let [a, b] = interval(e, now);
      const point = b - a < 12 * MIN;
      if (point) b = a;
      if (point ? a < d0 || a >= d1 : !overlap(a, b, d0, d1)) return [];
      a = Math.max(a, d0); b = Math.min(b, d1);
      return [{ e, top: ((a - d0) / span) * 100, height: point ? 0 : ((b - a) / span) * 100, point }];
    });
    return { k, marks };
  });

  // Légende : uniquement ce qui apparaît vraiment sur la semaine.
  const present = new Set(columns.flatMap((c) => c.marks.map((m) => m.e.type)));
  const legend: [string, string][] = [];
  for (const t of types) {
    if (!present.has(t)) continue;
    if (t === "diaper") legend.push(["Pipi", PEE_COLOR], ["Caca", POO_COLOR]);
    else legend.push([ENTRY_META[t].label, ENTRY_META[t].color]);
  }

  return (
    <>
      <div className="wr" role="img" aria-label="Rythme des 7 derniers jours : un jour par colonne, de minuit en haut à minuit en bas. Repas à gauche, sommeil au centre, soins à droite.">
        <div className="wr-head">
          <span />
          {columns.map(({ k }) => (
            <button key={k} type="button" className={k === today ? "today" : undefined} onClick={() => { setViewDay(k); window.scrollTo(0, 0); }} aria-label={`Afficher le ${keyToDate(k).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}`}>
              <span>{dowLetter(k)}</span><b>{keyToDate(k).getDate()}</b>
            </button>
          ))}
        </div>
        <div className="wr-body">
          <div className="wr-axis">{HOURS.map((h) => <span key={h} style={{ top: `${(h / 24) * 100}%` }}>{h} h</span>)}</div>
          {columns.map(({ k, marks }) => (
            <div key={k} className={`wr-col${k === today ? " today" : ""}`}>
              {HOURS.slice(1, -1).map((h) => <i key={h} className={`wr-grid${h % 6 ? "" : " major"}`} style={{ top: `${(h / 24) * 100}%` }} />)}
              {marks.map(({ e, top, height, point }) => {
                const look = lookOf(e);
                return (
                  <i key={e.id} className={`wr-m ${LANE[e.type]}${point ? " pt" : ""}`} title={`${ENTRY_META[e.type].label} ${hm(e.startedAt)}`}
                    style={{ top: `${top}%`, height: point ? undefined : `${height}%`, background: lookBackground(look) } as CSSProperties} />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="wr-note">Dans chaque colonne : repas à gauche, sommeil au centre, soins à droite. Touchez un jour pour l’afficher.</p>
      {legend.length > 0 && <div className="legend">{legend.map(([l, c]) => <span key={l}><i style={{ "--c": c } as CSSProperties} />{l}</span>)}</div>}
    </>
  );
}

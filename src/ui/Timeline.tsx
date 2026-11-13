import type { CSSProperties } from "react";
import { describe, interval } from "@/entries/describe";
import { lookBackground, lookOf, PEE_COLOR, POO_COLOR } from "@/entries/look";
import { ENTRY_META, type Entry, type EntryType } from "@/entries/types";
import { dayLabel, dayRange, H, hm, MIN, overlap } from "@/lib/time";

/** Frise des activités sur 24 heures, une ligne par jour (le plus récent en haut). */
export function Timeline({ days, entries, types, now }: { days: string[]; entries: Entry[]; types: EntryType[]; now: number }) {
  const items = entries.filter((e) => types.includes(e.type));
  const pct = (ms: number) => `${((ms / H / 24) * 100).toFixed(2)}%`;
  return (
    <div className="tl" role="img" aria-label="Frise des activités sur 24 heures">
      {[...days].reverse().map((k) => {
        const [d0, d1] = dayRange(k);
        return (
          <div className="tl-r" key={k}>
            <span className="tl-d">{dayLabel(k)}</span>
            <span className="tl-t">
              {items.map((e) => {
                let [a, b] = interval(e, now);
                const point = b - a < 10 * MIN;
                if (point) { a = e.startedAt - 5 * MIN; b = e.startedAt + 5 * MIN; }
                if (!overlap(a, b, d0, d1)) return null;
                const x1 = Math.max(a, d0) - d0, x2 = Math.min(b, d1) - d0;
                return <i key={e.id} className={point ? "pt" : "bd"} title={`${ENTRY_META[e.type].label} ${hm(e.startedAt)} : ${describe(e, now)}`}
                  style={{ left: pct(x1), width: pct(x2 - x1), background: lookBackground(lookOf(e)) }} />;
              })}
            </span>
          </div>
        );
      })}
      <div className="tl-r tl-ax"><span className="tl-d" /><span className="tl-t">{[0, 6, 12, 18, 24].map((h) => <b key={h} style={{ left: `${(h / 24) * 100}%` }}>{h} h</b>)}</span></div>
    </div>
  );
}

export function Legend({ types }: { types: EntryType[] }) {
  // Les couches sont détaillées : pipi et caca ont chacun leur couleur.
  const items = types.flatMap((t): [string, string][] => (t === "diaper" ? [["Pipi", PEE_COLOR], ["Caca", POO_COLOR]] : [[ENTRY_META[t].label, ENTRY_META[t].color]]));
  return <div className="legend">{items.map(([l, c]) => <span key={l}><i style={{ "--c": c } as CSSProperties} />{l}</span>)}</div>;
}

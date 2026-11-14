import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/app/AppContext";
import { interval } from "@/entries/describe";
import { PEE_COLOR } from "@/entries/look";
import { ENTRY_META, type EntryType } from "@/entries/types";
import { num } from "@/lib/format";
import { entriesOfDay, expectedWet } from "@/lib/rules";
import { dayRange, daysEnding, dowLetter, dur } from "@/lib/time";
import { feedSeries, longestSleep, milkSeries, peeSeries, type Series, sleepSeries, sleepWhen, type Trend, weekInsights } from "@/lib/week";

const TREND: Record<Trend, string> = { up: "en hausse", down: "en baisse", flat: "stable" };

/** Sept petites barres, une par jour ; le jour affiché est plus clair s’il n’est pas terminé. */
function Bars({ s, days, partial }: { s: Series; days: string[]; partial: boolean }) {
  const max = Math.max(...s.values, 1);
  return (
    <span className="tr-bars" aria-hidden="true">
      {s.values.map((v, i) => (
        <span key={days[i]} className={i === s.values.length - 1 && partial ? "partial" : undefined}>
          <i style={{ "--v": v ? Math.max(0.08, v / max) : 0 } as CSSProperties} /><small>{dowLetter(days[i])}</small>
        </span>
      ))}
    </span>
  );
}

interface Card { key: string; to: string; color: string; title: string; value: string; unit: string; sub: string; s: Series }

/**
 * Tendances de la semaine (lait, sommeil, couches) et constats en phrases.
 * Remplace la frise des 7 jours, peu lisible sur téléphone : ici, on lit la tendance plutôt que chaque saisie.
 */
export function WeekTrends({ types }: { types: EntryType[] }) {
  const { baby, entries, viewDay, isToday, now } = useApp();
  const navigate = useNavigate();
  if (!baby) return null;
  const days = daysEnding(viewDay, 7);
  const when = isToday ? "aujourd’hui" : "ce jour-là";
  const trend = (s: Series, fmt: (v: number) => string) =>
    s.trend ? `hier ${fmt(s.values[s.values.length - 2])}, ${TREND[s.trend]}` : s.average ? `moyenne ${fmt(s.average)} par jour` : "pas encore assez de jours";
  const cards: Card[] = [];

  if (types.includes("bottle")) {
    const s = milkSeries(entries, days);
    cards.push({ key: "milk", to: "/repas", color: ENTRY_META.bottle.color, title: "Lait", value: num(s.values[6]), unit: `ml ${when}`, sub: [s.average && `moyenne ${num(s.average)} ml par jour`, s.trend && `hier ${TREND[s.trend]}`].filter(Boolean).join(", ") || "pas encore assez de jours", s });
  } else if (types.some((t) => t === "breastfeeding" || t === "solid")) {
    const s = feedSeries(entries, days);
    cards.push({ key: "feeds", to: "/repas", color: ENTRY_META.breastfeeding.color, title: "Repas", value: String(s.values[6]), unit: `repas ${when}`, sub: trend(s, (v) => num(v, 1)), s });
  }
  if (types.includes("sleep")) {
    const s = sleepSeries(entries, days, now);
    const [from] = dayRange(days[0]), [, to] = dayRange(days[6]);
    const best = longestSleep(entries, from, to);
    const bestLen = best ? (([a, b]) => b - a)(interval(best, now)) : 0;
    cards.push({ key: "sleep", to: "/sommeil", color: ENTRY_META.sleep.color, title: "Sommeil", value: dur(s.values[6]), unit: when, sub: best ? `plus long : ${dur(bestLen)}, ${sleepWhen(best)}` : trend(s, (v) => dur(v)), s });
  }
  if (types.includes("diaper")) {
    const s = peeSeries(entries, days);
    const poo = entriesOfDay(entries, viewDay).filter((e) => e.type === "diaper" && e.data.poo).length;
    const exp = expectedWet(baby, now - 24 * 3600e3), y = s.values[5];
    const hadDiapers = entriesOfDay(entries, days[5]).some((e) => e.type === "diaper");
    cards.push({
      key: "pee", to: "/couches", color: PEE_COLOR, title: "Couches", value: String(s.values[6]), unit: `pipi, ${poo} caca ${when}`,
      sub: hadDiapers ? `hier ${y} pipi, ${y >= exp ? "dans le repère" : "sous le repère"} (au moins ${exp})` : `repère : au moins ${exp} pipi par jour`, s,
    });
  }

  const notes = isToday ? weekInsights(baby, entries, now) : [];
  if (!cards.length) return null;

  return (
    <>
      <h2 className="sec">La semaine</h2>
      <div className="trends">
        {cards.map((c) => (
          <button key={c.key} type="button" className="trend" style={{ "--c": c.color } as CSSProperties} onClick={() => navigate(c.to)}>
            <span className="tr-txt">
              <span className="tr-t">{c.title}</span>
              <span className="tr-v"><b className="num">{c.value}</b> {c.unit}</span>
              <span className="tr-s">{c.sub}</span>
            </span>
            <Bars s={c.s} days={days} partial={isToday} />
          </button>
        ))}
      </div>
      {notes.length > 0 && (
        <div className="card notes">
          <h3>Ce qu’on remarque</h3>
          <ul>{notes.map((n) => <li key={n}>{n}</li>)}</ul>
          <p className="disclaimer">Calculé à partir de vos saisies des derniers jours. Ce sont des repères, pas un avis médical.</p>
        </div>
      )}
    </>
  );
}

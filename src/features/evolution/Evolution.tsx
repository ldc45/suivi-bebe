import { type CSSProperties, type ReactNode, useState } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { useApp } from "@/app/AppContext";
import { interval } from "@/entries/describe";
import { PEE_COLOR, POO_COLOR } from "@/entries/look";
import { ENTRY_META, type EntryOf, type EntryType, REACTION_LABEL, STOOL, TEXTURE_LABEL } from "@/entries/types";
import { cssVar, num } from "@/lib/format";
import { entriesOfDay, milkTarget, sleepOfDay, sumBottles, thresholds } from "@/lib/rules";
import { dayKey, dayLabel, dayRange, daysEnding, dur, H, hm, MIN, overlap, shortDay } from "@/lib/time";
import { Timeline } from "@/ui/Timeline";
import { baseOptions } from "./chartSetup";

const RANGES = [7, 14, 30] as const;
const alpha = (hex: string) => `${hex}88`;
/** Moyenne à partir du premier jour où il y a des données. */
const meanFrom = (arr: number[]) => { const i = arr.findIndex((v) => v > 0); if (i < 0) return 0; const a = arr.slice(i); return a.reduce((x, y) => x + y, 0) / a.length; };
const rolling = (arr: number[], w: number) => arr.map((_, i) => { const s = arr.slice(Math.max(0, i - w + 1), i + 1).filter((v) => v > 0); return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null; });

function Kpis({ items }: { items: [string, string][] }) {
  return <div className="kpis">{items.map(([v, l]) => <div className="kpi" key={l}><b>{v}</b><span>{l}</span></div>)}</div>;
}
function ChartBox({ title, height = 220, children }: { title: string; height?: number; children: ReactNode }) {
  return <div className="chart"><h4>{title}</h4><div className="cbox" style={{ height }}>{children}</div></div>;
}

/** Section « Évolution » d’un onglet : choix du type (si plusieurs) et de la période. */
export function Evolution({ types }: { types: EntryType[] }) {
  const [type, setType] = useState<EntryType>(types[0]);
  const [range, setRange] = useState<number>(7);
  const current = types.includes(type) ? type : types[0];
  if (!current) return null;
  return (
    <>
      <h2 className="sec">Évolution</h2>
      {types.length > 1 && (
        <div className="filters">
          {types.map((t) => (
            <button key={t} type="button" aria-pressed={t === current} onClick={() => setType(t)} style={{ "--c": ENTRY_META[t].color } as CSSProperties}><i />{ENTRY_META[t].short}</button>
          ))}
        </div>
      )}
      <div className="seg">{RANGES.map((n) => <button key={n} type="button" aria-pressed={range === n} onClick={() => setRange(n)}>{n} jours</button>)}</div>
      <Charts type={current} range={range} />
    </>
  );
}

export function Charts({ type, range }: { type: EntryType; range: number }) {
  const { baby, entries, viewDay, now } = useApp();
  if (!baby) return null;
  const days = daysEnding(viewDay, range);
  const labels = days.map(shortDay);
  const byDay = days.map((k) => entriesOfDay(entries, k).filter((e) => e.type === type));
  const flat = byDay.flat();
  const C = ENTRY_META[type].color;
  if (!flat.length && type !== "sleep") return <p className="empty">Pas encore de données sur cette période.</p>;

  switch (type) {
    case "bottle": {
      const tot = byDay.map(sumBottles);
      const target = milkTarget(baby, entries)?.ml;
      const intervals = flat.map((e) => e.startedAt).sort((a, b) => a - b).map((t, i, a) => (i ? t - a[i - 1] : 0)).filter((g) => g > 0 && g < 12 * H);
      return <>
        <Kpis items={[[`${num(meanFrom(tot))} ml`, "par jour en moyenne"], [`${num(sumBottles(flat) / flat.length)} ml`, "par biberon"], [intervals.length ? dur(intervals.reduce((a, b) => a + b, 0) / intervals.length) : "–", "entre deux biberons"]]} />
        <ChartBox title="Quantité bue par jour (ml)">
          <Bar options={baseOptions()} data={{ labels, datasets: [
            { type: "bar" as const, label: "ml bus", data: tot, backgroundColor: target ? tot.map((v) => (v >= target ? "#8DC765" : C)) : C, borderRadius: 8 },
            { type: "line" as const, label: "Moyenne sur 7 jours", data: rolling(tot, 7), borderColor: cssVar("--text"), borderWidth: 2, pointRadius: 0, tension: 0.3, spanGaps: true },
            ...(target ? [{ type: "line" as const, label: `Repère ${target} ml`, data: tot.map(() => target), borderColor: cssVar("--moon"), borderDash: [6, 5], borderWidth: 1.5, pointRadius: 0 }] : []),
          ] } as never} />
        </ChartBox>
        <ChartBox title="Nombre de biberons par jour" height={180}>
          <Bar options={baseOptions({ legend: false })} data={{ labels, datasets: [{ label: "Biberons", data: byDay.map((l) => l.length), backgroundColor: alpha(C), borderRadius: 8 }] }} />
        </ChartBox>
        <div className="chart"><h4>Horaires des biberons</h4><Timeline days={days} entries={entries} types={["bottle"]} now={now} /></div>
      </>;
    }
    case "breastfeeding": {
      const l = byDay.map((d) => d.reduce((a, e) => a + (e.type === "breastfeeding" ? e.data.left_min : 0), 0));
      const r = byDay.map((d) => d.reduce((a, e) => a + (e.type === "breastfeeding" ? e.data.right_min : 0), 0));
      const g = l.reduce((a, b) => a + b, 0), d = r.reduce((a, b) => a + b, 0);
      return <>
        <Kpis items={[[num(meanFrom(byDay.map((x) => x.length)), 1), "tétées par jour"], [`${num((g + d) / flat.length)} min`, "par tétée"], [g + d ? `${Math.round((g / (g + d)) * 100)} % G` : "–", "répartition"]]} />
        <ChartBox title="Durée par jour et par sein (min)">
          <Bar options={baseOptions({ stacked: true })} data={{ labels, datasets: [{ label: "Gauche", data: l, backgroundColor: C, borderRadius: 4 }, { label: "Droite", data: r, backgroundColor: alpha(C), borderRadius: 4 }] }} />
        </ChartBox>
      </>;
    }
    case "pumping": {
      const l = byDay.map((d) => d.reduce((a, e) => a + (e.type === "pumping" ? e.data.left_ml : 0), 0));
      const r = byDay.map((d) => d.reduce((a, e) => a + (e.type === "pumping" ? e.data.right_ml : 0), 0));
      return <>
        <Kpis items={[[`${num(meanFrom(l.map((v, i) => v + r[i])))} ml`, "par jour"], [String(flat.length), "séances"], [`${num(l.reduce((a, b) => a + b, 0) + r.reduce((a, b) => a + b, 0))} ml`, "au total"]]} />
        <ChartBox title="Volume tiré par jour et par côté (ml)">
          <Bar options={baseOptions({ stacked: true })} data={{ labels, datasets: [{ label: "Gauche", data: l, backgroundColor: C, borderRadius: 4 }, { label: "Droite", data: r, backgroundColor: alpha(C), borderRadius: 4 }] }} />
        </ChartBox>
      </>;
    }
    case "diaper": {
      const dia = byDay as EntryOf<"diaper">[][];
      const wet = dia.map((d) => d.filter((e) => e.data.pee).length), poo = dia.map((d) => d.filter((e) => e.data.poo).length);
      const tex: Record<string, number> = {};
      dia.flat().filter((e) => e.data.poo).forEach((e) => { const k = e.data.texture ? TEXTURE_LABEL[e.data.texture] : "Non précisée"; tex[k] = (tex[k] ?? 0) + 1; });
      const first = byDay.findIndex((x) => x.length), avg = (a: number[]) => (first < 0 ? 0 : a.slice(first).reduce((x, y) => x + y, 0) / a.slice(first).length);
      return <>
        <Kpis items={[[num(avg(wet), 1), "mouillées par jour"], [num(avg(poo), 1), "selles par jour"], [String(flat.length), "couches"]]} />
        <ChartBox title="Pipi et selles par jour">
          <Bar options={baseOptions()} data={{ labels, datasets: [{ label: "Mouillées (pipi)", data: wet, backgroundColor: PEE_COLOR, borderRadius: 4 }, { label: "Selles (caca)", data: poo, backgroundColor: POO_COLOR, borderRadius: 4 }] }} />
        </ChartBox>
        <div className="chart"><h4>Couleur des selles</h4>
          <div className="frise">{[...days].reverse().map((k) => {
            const st = entriesOfDay(entries, k).filter((e): e is EntryOf<"diaper"> => e.type === "diaper" && e.data.poo).sort((a, b) => a.startedAt - b.startedAt);
            return <div className="r" key={k}><span className="dl">{dayLabel(k)}</span><span className="ds">{st.length ? st.map((e) => <i key={e.id} title={`${hm(e.startedAt)} ${e.data.color ? STOOL[e.data.color].label : "couleur non précisée"}`} style={{ "--sc": e.data.color ? STOOL[e.data.color].hex : "transparent" } as CSSProperties} />) : <span className="small muted">aucune selle</span>}</span></div>;
          })}</div>
        </div>
        {Object.keys(tex).length > 0 && <ChartBox title="Textures des selles" height={200}>
          <Doughnut options={{ ...baseOptions(), scales: {}, plugins: { legend: { position: "right", labels: { color: cssVar("--muted") } } } }} data={{ labels: Object.keys(tex), datasets: [{ data: Object.values(tex), backgroundColor: ["#C27F45", "#D4A01E", "#7A4E2A", "#E9D36A", "#6A8C37", "#A79FBD"], borderWidth: 0 }] }} />
        </ChartBox>}
      </>;
    }
    case "sleep": {
      const s = days.map((k) => sleepOfDay(entries, k, now));
      const from = dayRange(days[0])[0], to = dayRange(days[days.length - 1])[1];
      const longest = entries.filter((e) => e.type === "sleep" && !e.inProgress).reduce((m, e) => { const [a, b] = interval(e, now); return Math.max(m, overlap(a, b, from, to)); }, 0);
      return <>
        <Kpis items={[[dur(meanFrom(s.map((x) => x.total)) * H), "par jour en moyenne"], [longest ? dur(longest) : "–", "plus long sommeil"], [dur(meanFrom(s.map((x) => x.night)) * H), "de nuit en moyenne"]]} />
        <ChartBox title="Heures de sommeil par jour (nuit : 20 h à 8 h)">
          <Bar options={baseOptions({ stacked: true, decimals: 1 })} data={{ labels, datasets: [{ label: "Nuit", data: s.map((x) => +x.night.toFixed(1)), backgroundColor: C, borderRadius: 4 }, { label: "Journée", data: s.map((x) => +x.day.toFixed(1)), backgroundColor: alpha(C), borderRadius: 4 }] }} />
        </ChartBox>
        <div className="chart"><h4>Périodes de sommeil</h4><Timeline days={days} entries={entries} types={["sleep"]} now={now} /></div>
      </>;
    }
    case "tummy": {
      const goal = thresholds(baby).tummyMin;
      const mins = days.map((k) => { const [a, b] = dayRange(k); return Math.round(entries.reduce((x, e) => { if (e.type !== "tummy") return x; const [p, q] = interval(e, now); return x + overlap(p, q, a, Math.min(b, now)) / MIN; }, 0)); });
      return <>
        <Kpis items={[[`${num(meanFrom(mins))} min`, "par jour"], [`${mins.filter((m) => m >= goal).length} / ${days.length}`, "jours à l’objectif"], [`${goal} min`, "objectif"]]} />
        <ChartBox title="Minutes de tummy time par jour">
          <Bar options={baseOptions()} data={{ labels, datasets: [
            { type: "bar" as const, label: "Minutes", data: mins, backgroundColor: mins.map((m) => (m >= goal ? "#8DC765" : C)), borderRadius: 8 },
            { type: "line" as const, label: "Objectif", data: mins.map(() => goal), borderColor: cssVar("--moon"), borderDash: [6, 5], pointRadius: 0, borderWidth: 1.5 },
          ] } as never} />
        </ChartBox>
      </>;
    }
    case "temperature": {
      const pts = (flat as EntryOf<"temperature">[]).sort((a, b) => a.startedAt - b.startedAt);
      const fever = thresholds(baby).fever;
      return <>
        <Kpis items={[[`${num(Math.max(...pts.map((e) => e.data.celsius)), 1)} °C`, "maximum"], [String(pts.length), "mesures"], [`${num(fever, 1)} °C`, "seuil de fièvre"]]} />
        <ChartBox title="Températures relevées">
          <Line options={baseOptions({ yMin: 35.5, yMax: 39.5, decimals: 1 })} data={{ labels: pts.map((e) => `${shortDay(dayKey(e.startedAt))} ${hm(e.startedAt)}`), datasets: [
            { label: "°C", data: pts.map((e) => e.data.celsius), borderColor: C, backgroundColor: C, pointRadius: 4, tension: 0.2 },
            { label: "Seuil de fièvre", data: pts.map(() => fever), borderColor: cssVar("--urgent"), borderDash: [6, 5], pointRadius: 0, borderWidth: 1.5 },
          ] }} />
        </ChartBox>
      </>;
    }
    case "solid": {
      // Première fois : sur tout l’historique, pas seulement sur la période affichée.
      const firstEver = new Map<string, number>();
      for (const e of entries) if (e.type === "solid") { const k = e.data.food.toLowerCase(); firstEver.set(k, Math.min(firstEver.get(k) ?? Infinity, e.startedAt)); }
      const foods = new Map<string, { name: string; first: number; n: number; reactions: Set<string> }>();
      for (const e of [...(flat as EntryOf<"solid">[])].sort((a, b) => a.startedAt - b.startedAt)) {
        const k = e.data.food.toLowerCase(), f = foods.get(k) ?? { name: e.data.food, first: firstEver.get(k) ?? e.startedAt, n: 0, reactions: new Set<string>() };
        f.n++; if (e.data.reaction && e.data.reaction !== "none") f.reactions.add(REACTION_LABEL[e.data.reaction]); foods.set(k, f);
      }
      return <>
        <Kpis items={[[String(foods.size), "aliments"], [String(flat.length), "repas solides"], [String([...foods.values()].filter((f) => f.reactions.size).length), "avec réaction"]]} />
        <div className="chart"><h4>Aliments proposés</h4><div className="scroll"><table className="grid"><thead><tr><th>Aliment</th><th>Première fois</th><th>Fois</th><th>Réaction</th></tr></thead>
          <tbody>{[...foods.values()].map((f) => <tr key={f.name}><td>{f.name}</td><td>{dayLabel(dayKey(f.first))}</td><td>{f.n}</td><td className={f.reactions.size ? "tx-warn" : ""}>{f.reactions.size ? [...f.reactions].join(", ") : "Aucune"}</td></tr>)}</tbody></table></div></div>
      </>;
    }
    default:
      return null;
  }
}

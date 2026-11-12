import type { ReactNode } from "react";
import { interval } from "@/entries/describe";
import { lookOf } from "@/entries/look";
import { ENTRY_META, type Entry, INNER_RING } from "@/entries/types";
import { ICONS } from "@/ui/icons";
import { dayRange, hm, MIN, todayKey } from "@/lib/time";

/**
 * Trois anneaux, de l’extérieur vers l’intérieur :
 * - sommeil seul (RS), pour lire les nuits et les siestes d’un coup d’œil ;
 * - repas et tummy time (RF) ;
 * - soins : couches, traitements, température, pesées (RC).
 */
const C = 160, RS = 147, WS = 16, RF = 116, WF = 28, RC = 82, WC = 24;
const ICON_F = 13, ICON_C = 11, ICON_S = 11;

interface Placed { key: string; e: Entry; a: number; r: number; z: number }

/**
 * Écarte les pictogrammes d’un même anneau qui se chevauchent (ex. vitamine D et couche à la même heure) :
 * chaque groupe trop serré est réparti autour de sa position moyenne. L’heure exacte reste dans l’infobulle.
 */
function spread(items: Placed[]): Placed[] {
  const sorted = [...items].sort((x, y) => x.a - y.a);
  const out: Placed[] = [];
  let group: Placed[] = [];
  const flush = () => {
    if (!group.length) return;
    const step = (2 * group[0].z + 3) / group[0].r;
    const mid = group.reduce((s, p) => s + p.a, 0) / group.length;
    group.forEach((p, i) => out.push({ ...p, a: mid + (i - (group.length - 1) / 2) * step }));
    group = [];
  };
  for (const p of sorted) {
    const last = group[group.length - 1];
    // Trop proche du précédent : même groupe (une suite d’activités rapprochées forme un seul groupe).
    if (last && p.a - last.a < (2 * p.z + 3) / p.r) group.push(p);
    else { flush(); group.push(p); }
  }
  flush();
  return out;
}

/** Cadran de la journée. */
export function Dial({ day, entries, now, center }: { day: string; entries: Entry[]; now: number; center: ReactNode }) {
  const [s0, s1] = dayRange(day);
  const live = day === todayKey();
  const end = live ? now : s1;
  const ang = (ms: number) => ((ms - s0) / (s1 - s0)) * 2 * Math.PI - Math.PI / 2;
  const pt = (a: number, r: number): [number, number] => [C + r * Math.cos(a), C + r * Math.sin(a)];
  const arc = (a1: number, a2: number, r: number) => {
    let sw = a2 - a1; if (sw <= 0) sw += 2 * Math.PI; sw = Math.min(sw, 2 * Math.PI - 0.001);
    const [x1, y1] = pt(a1, r), [x2, y2] = pt(a1 + sw, r);
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 ${sw > Math.PI ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };

  const sleepArcs: ReactNode[] = [], feedArcs: ReactNode[] = [];
  const onSleep: Placed[] = [], onFeed: Placed[] = [], onCare: Placed[] = [];
  for (const e of entries) {
    let [a, b] = interval(e, now);
    if (b < s0 || a >= end) continue;
    a = Math.max(a, s0); b = Math.min(b, end);
    if (e.type === "sleep") {
      // Anneau du sommeil : un arc par sommeil, même court (au moins 6 minutes visibles).
      const b2 = Math.max(b, a + 6 * MIN);
      sleepArcs.push(<path key={e.id} d={arc(ang(a), ang(b2), RS)} fill="none" stroke={ENTRY_META.sleep.color} strokeWidth={WS - 2} strokeLinecap="round"><title>{`Sommeil ${hm(e.startedAt)}${e.inProgress ? ", en cours" : ` à ${hm(e.endedAt ?? b)}`}`}</title></path>);
      // Pictogramme au milieu de l’arc, quand il est assez long pour le porter.
      if (b - a >= 25 * MIN) onSleep.push({ key: `${e.id}-i`, e, a: ang(a + (b - a) / 2), r: RS, z: ICON_S });
    } else if (e.type === "tummy" && b - a > 8 * MIN) {
      feedArcs.push(<path key={e.id} d={arc(ang(a), ang(b), RF)} fill="none" stroke={ENTRY_META.tummy.color} strokeWidth={WF - 2} strokeLinecap="round" opacity={0.9} />);
      onFeed.push({ key: `${e.id}-i`, e, a: ang(a + (b - a) / 2), r: RF, z: ICON_F - 1 });
    } else if (e.startedAt >= s0 && e.startedAt < end) {
      const inner = INNER_RING.includes(e.type);
      (inner ? onCare : onFeed).push({ key: e.id, e, a: ang(e.startedAt), r: inner ? RC : RF, z: inner ? ICON_C : ICON_F });
    }
  }

  const icon = ({ key, e, a, r, z }: Placed) => {
    const [x, y] = pt(a, r), look = lookOf(e);
    return (
      <g key={key}>
        <title>{`${ENTRY_META[e.type].label} ${hm(e.startedAt)}`}</title>
        {look.color2
          ? <>
            <path d={`M${x} ${y - z} A${z} ${z} 0 0 0 ${x} ${y + z} Z`} fill={look.color2} />
            <path d={`M${x} ${y - z} A${z} ${z} 0 0 1 ${x} ${y + z} Z`} fill={look.color} />
            <circle cx={x} cy={y} r={z} fill="none" stroke="var(--bg)" strokeWidth={2} />
          </>
          : <circle cx={x} cy={y} r={z} fill={look.color} stroke="var(--bg)" strokeWidth={2} />}
        <svg x={x - z * 0.68} y={y - z * 0.68} width={z * 1.36} height={z * 1.36} viewBox="0 0 24 24" fill="none" stroke="#1B1828" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[look.icon] }} />
      </g>
    );
  };

  const an = ang(now), dayEnd = -Math.PI / 2 + 2 * Math.PI - 0.0001;
  const [nx1, ny1] = pt(an, RC - WC / 2 - 4), [nx2, ny2] = pt(an, RS + WS / 2 + 2);
  return (
    <div className="dial">
      <svg viewBox="0 0 320 320" role="img" aria-label="Activités de la journée : sommeil à l’extérieur, repas au milieu, soins à l’intérieur">
        <circle cx={C} cy={C} r={RS} fill="none" stroke="var(--raised)" strokeWidth={WS} />
        <circle cx={C} cy={C} r={RF} fill="none" stroke="var(--raised)" strokeWidth={WF} />
        <circle cx={C} cy={C} r={RC} fill="none" stroke="var(--raised)" strokeWidth={WC} opacity={0.6} />
        {[0, 6, 12, 18].map((h) => { const [x, y] = pt((h / 24) * 2 * Math.PI - Math.PI / 2, 61); return <text key={h} x={x} y={y + 4} fill="var(--muted)" fontSize={11} textAnchor="middle">{h} h</text>; })}
        {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => { const a = (h / 24) * 2 * Math.PI - Math.PI / 2, [x1, y1] = pt(a, RC + WC / 2 + 2), [x2, y2] = pt(a, RF - WF / 2 - 2); return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--muted)" strokeOpacity={h % 6 ? 0.3 : 0.6} strokeWidth={1.5} strokeLinecap="round" />; })}
        {sleepArcs}{feedArcs}
        {spread(onSleep).map(icon)}{spread(onFeed).map(icon)}{spread(onCare).map(icon)}
        {live && <>
          <path d={arc(an, dayEnd, RS)} fill="none" stroke="var(--bg)" strokeWidth={WS + 2} opacity={0.45} />
          <path d={arc(an, dayEnd, RF)} fill="none" stroke="var(--bg)" strokeWidth={WF + 2} opacity={0.45} />
          <path d={arc(an, dayEnd, RC)} fill="none" stroke="var(--bg)" strokeWidth={WC + 2} opacity={0.45} />
          <line x1={nx1} y1={ny1} x2={nx2} y2={ny2} stroke="var(--moon)" strokeWidth={3} strokeLinecap="round" />
        </>}
      </svg>
      <div className="mid">{center}</div>
    </div>
  );
}

import type { ReactNode } from "react";
import { interval } from "@/entries/describe";
import { ENTRY_META, type Entry, INNER_RING } from "@/entries/types";
import { ICONS } from "@/ui/icons";
import { dayRange, hm, MIN, todayKey } from "@/lib/time";

const C = 160, RO = 134, RI = 96;

/** Cadran de la journée : repas et sommeil à l’extérieur, soins à l’intérieur. */
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

  const arcs: ReactNode[] = [], icons: ReactNode[] = [];
  const icon = (key: string, a: number, r: number, e: Entry, z: number) => {
    const [x, y] = pt(a, r);
    icons.push(
      <g key={key}>
        <title>{`${ENTRY_META[e.type].label} ${hm(e.startedAt)}`}</title>
        <circle cx={x} cy={y} r={z} fill={ENTRY_META[e.type].color} stroke="var(--bg)" strokeWidth={2} />
        <svg x={x - z * 0.68} y={y - z * 0.68} width={z * 1.36} height={z * 1.36} viewBox="0 0 24 24" fill="none" stroke="#1B1828" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[e.type] }} />
      </g>,
    );
  };
  for (const e of entries) {
    let [a, b] = interval(e, now);
    if (b < s0 || a >= end) continue;
    a = Math.max(a, s0); b = Math.min(b, end);
    if ((e.type === "sleep" || e.type === "tummy") && b - a > 8 * MIN) {
      arcs.push(<path key={e.id} d={arc(ang(a), ang(b), RO)} fill="none" stroke={ENTRY_META[e.type].color} strokeWidth={30} strokeLinecap="round" opacity={0.9} />);
      icon(`${e.id}-i`, ang(a + (b - a) / 2), RO, e, 12);
    } else if (e.startedAt >= s0 && e.startedAt < end) {
      const inner = INNER_RING.includes(e.type);
      icon(e.id, ang(e.startedAt), inner ? RI : RO, e, inner ? 11 : 13);
    }
  }

  const an = ang(now), dayEnd = -Math.PI / 2 + 2 * Math.PI - 0.0001;
  const [nx1, ny1] = pt(an, RI - 16), [nx2, ny2] = pt(an, RO + 19);
  return (
    <div className="dial">
      <svg viewBox="0 0 320 320" role="img" aria-label="Activités de la journée">
        <circle cx={C} cy={C} r={RO} fill="none" stroke="var(--raised)" strokeWidth={32} />
        <circle cx={C} cy={C} r={RI} fill="none" stroke="var(--raised)" strokeWidth={24} opacity={0.6} />
        {[0, 6, 12, 18].map((h) => { const [x, y] = pt((h / 24) * 2 * Math.PI - Math.PI / 2, 66); return <text key={h} x={x} y={y + 4} fill="var(--muted)" fontSize={11} textAnchor="middle">{h} h</text>; })}
        {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => { const a = (h / 24) * 2 * Math.PI - Math.PI / 2, [x1, y1] = pt(a, RI + 14), [x2, y2] = pt(a, RO - 18); return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--muted)" strokeOpacity={h % 6 ? 0.25 : 0.5} strokeWidth={1.5} strokeLinecap="round" />; })}
        {arcs}{icons}
        {live && <>
          <path d={arc(an, dayEnd, RO)} fill="none" stroke="var(--bg)" strokeWidth={34} opacity={0.45} />
          <path d={arc(an, dayEnd, RI)} fill="none" stroke="var(--bg)" strokeWidth={26} opacity={0.45} />
          <line x1={nx1} y1={ny1} x2={nx2} y2={ny2} stroke="var(--moon)" strokeWidth={3} strokeLinecap="round" />
        </>}
      </svg>
      <div className="mid">{center}</div>
    </div>
  );
}

import type { Baby } from "@/babies/types";
import { ENTRY_META } from "@/entries/types";
import { num } from "@/lib/format";
import type { GrowthPoint } from "@/lib/rules";
import { ageDays, dayKey, dayLabel, DAY, keyToDate } from "@/lib/time";
import { DAYS_PER_MONTH, type GrowthKind, whoValue } from "@/lib/who";

const W = 320, HT = 200, L = 34, R = 26, T = 10, B = 24;

/** Courbe de croissance de l’enfant, avec en option les repères OMS (à partir d’un mois). */
export function GrowthChart({ baby, kind, points, showWho }: { baby: Baby; kind: GrowthKind; points: GrowthPoint[]; showWho: boolean }) {
  const birth = keyToDate(baby.birthDate).getTime();
  const ages = points.map((p) => (p.at - birth) / DAY);
  const xMax = Math.min(730, Math.max(61, (ageDays(baby.birthDate) ?? 0) + 14, ...ages.map((a) => a + 7)));
  const who = showWho && baby.sex && xMax > 30 ? baby.sex : null;
  const bands = who ? [-2, -1, 0, 1, 2].map((z) => {
    const step = Math.max(2, Math.round(xMax / 60)), line: [number, number][] = [];
    for (let d = 30; d < xMax; d += step) line.push([d, whoValue(kind, who, d / DAYS_PER_MONTH, z)]);
    line.push([xMax, whoValue(kind, who, xMax / DAYS_PER_MONTH, z)]);
    return { z, line };
  }) : [];
  let vals = [...points.map((p) => p.value), ...bands.flatMap((b) => b.line.map((p) => p[1]))];
  if (!vals.length) vals = kind === "weight" ? [3, 5] : [48, 58];
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.12 || (kind === "weight" ? 0.5 : 2); lo -= pad; hi += pad;
  const X = (d: number) => L + ((W - L - R) * d) / xMax, Y = (v: number) => T + (HT - T - B) * (1 - (v - lo) / (hi - lo));
  const path = (l: [number, number][]) => l.map((p, i) => `${i ? "L" : "M"}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join(" ");
  const area = (a: [number, number][], c: [number, number][]) => `${path(a)} ${[...c].reverse().map((p) => `L${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join(" ")} Z`;
  const step = hi - lo > 8 ? 2 : hi - lo > 3 ? 1 : 0.5;
  const ticks: number[] = []; for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  const mStep = xMax > 400 ? 6 : xMax > 200 ? 3 : xMax > 100 ? 2 : 1;
  const months: number[] = []; for (let m = 0; m * DAYS_PER_MONTH <= xMax; m += mStep) months.push(m);
  const col = ENTRY_META.growth.color, dec = kind === "weight" ? 2 : 1;

  return (
    <svg className="gsvg" viewBox={`0 0 ${W} ${HT}`} role="img" aria-label={kind === "weight" ? "Courbe de poids" : "Courbe de taille"}>
      <rect x={X(0)} y={T} width={X(Math.min(30, xMax)) - X(0)} height={HT - T - B} fill="var(--raised)" opacity={0.6} />
      <text x={(X(0) + X(Math.min(30, xMax))) / 2} y={T + 12} fill="var(--muted)" fontSize={9} textAnchor="middle">1er mois</text>
      {ticks.map((v) => <g key={v}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--line)" strokeWidth={0.7} /><text x={L - 5} y={Y(v) + 3} fill="var(--muted)" fontSize={9} textAnchor="end">{num(v, step < 1 ? 1 : 0)}</text></g>)}
      {months.map((m) => <text key={m} x={X(m * DAYS_PER_MONTH)} y={HT - 8} fill="var(--muted)" fontSize={9} textAnchor={m === 0 ? "start" : "middle"}>{m === 0 ? "naiss." : `${m} m`}</text>)}
      {bands.length === 5 && <>
        <path d={area(bands[0].line, bands[4].line)} fill={col} opacity={0.07} />
        <path d={area(bands[1].line, bands[3].line)} fill={col} opacity={0.1} />
        {bands.map((b) => {
          const e = b.line[b.line.length - 1];
          return <g key={b.z}>
            <path d={path(b.line)} fill="none" stroke="var(--muted)" strokeWidth={b.z === 0 ? 1.3 : 0.9} strokeDasharray={b.z === 0 ? undefined : "3 4"} opacity={0.85} />
            {Math.abs(b.z) !== 1 && <text x={X(e[0]) + 3} y={Y(e[1]) + 3} fill="var(--muted)" fontSize={9}>{b.z === 0 ? "M" : b.z > 0 ? "+2" : "−2"}</text>}
          </g>;
        })}
      </>}
      {points.length > 0 && <polyline points={points.map((p, i) => `${X(ages[i]).toFixed(1)},${Y(p.value).toFixed(1)}`).join(" ")} fill="none" stroke={col} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
      {points.map((p, i) => <circle key={i} cx={X(ages[i])} cy={Y(p.value)} r={3.8} fill={col} stroke="var(--surface)" strokeWidth={1.5}><title>{`${dayLabel(dayKey(p.at))} : ${num(p.value, dec)}`}</title></circle>)}
    </svg>
  );
}

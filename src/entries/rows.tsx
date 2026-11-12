import type { CSSProperties } from "react";
import { useApp } from "@/app/AppContext";
import { useSheet } from "@/ui/Overlay";
import { Icon } from "@/ui/Icon";
import { dayKey, dayLabel, hm, todayKey } from "@/lib/time";
import { describe, diaperKind } from "./describe";
import { lookBackground, lookOf } from "./look";
import { EntrySheet } from "./EntrySheet";
import { ENTRY_META, type Entry } from "./types";

function author(e: Entry, userId: string) {
  return e.createdBy && e.createdBy !== userId ? ", ajouté par l’autre parent" : "";
}

/** Ligne avec pictogramme, utilisée dans les listes des onglets. */
export function LogRow({ entry: e, withDay }: { entry: Entry; withDay?: boolean }) {
  const { userId, now } = useApp();
  const sheet = useSheet();
  const meta = ENTRY_META[e.type], look = lookOf(e);
  const title = e.type === "diaper" ? diaperKind(e) : meta.label;
  const desc = e.type === "diaper" ? describe(e, now).split(", ").slice(1).join(", ") : describe(e, now);
  const k = dayKey(e.startedAt);
  return (
    <button type="button" className="lrow" style={{ "--c": look.color } as CSSProperties} onClick={() => sheet.open(<EntrySheet type={e.type} entry={e} />)}>
      <span className="lic" style={look.color2 ? { background: lookBackground(look, 30) } : undefined}><Icon name={look.icon} /></span>
      <span className="lt"><b>{title}</b><span>{[desc, e.note].filter(Boolean).join(". ")}{author(e, userId)}</span></span>
      <span className="lh">{withDay && k !== todayKey() && <>{dayLabel(k)}<br /></>}{hm(e.startedAt)}</span>
    </button>
  );
}

export function LogList({ entries, withDay, empty }: { entries: Entry[]; withDay?: boolean; empty: string }) {
  if (!entries.length) return <p className="empty">{empty}</p>;
  return <div className="lbox">{entries.map((e) => <LogRow key={e.id} entry={e} withDay={withDay} />)}</div>;
}

/** Ligne de frise chronologique (accueil). */
export function TimeRow({ entry: e }: { entry: Entry }) {
  const { now } = useApp();
  const sheet = useSheet();
  const look = lookOf(e);
  return (
    <li>
      <button type="button" className="trow" style={{ "--c": look.color, "--dot": lookBackground(look) } as CSSProperties} onClick={() => sheet.open(<EntrySheet type={e.type} entry={e} />)}>
        <span className="t">{hm(e.startedAt)}</span><span className="rail" />
        <span><span className="l">{ENTRY_META[e.type].label}</span><span className="d">{[describe(e, now), e.note].filter(Boolean).join(". ")}</span></span>
      </button>
    </li>
  );
}

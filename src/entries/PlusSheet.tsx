import type { CSSProperties } from "react";
import { useApp } from "@/app/AppContext";
import { visibleTypes } from "@/lib/rules";
import { Icon } from "@/ui/Icon";
import { SheetLayout, useSheet } from "@/ui/Overlay";
import { EntrySheet } from "./EntrySheet";
import { ENTRY_META, type EntryType, FEEDS } from "./types";

/** Grille du bouton + : les repas sont regroupés sous une seule entrée. */
export function PlusSheet() {
  const { baby, entries } = useApp();
  const sheet = useSheet();
  if (!baby) return null;
  const vis = visibleTypes(baby);
  const feeds = vis.filter((t) => FEEDS.includes(t));
  const lastFeed = (entries.find((e) => feeds.includes(e.type))?.type ?? feeds[0]) as EntryType | undefined;
  const items: { key: string; type: EntryType; icon: EntryType; label: string; color: string }[] = [];
  let grouped = false;
  for (const t of vis) {
    if (FEEDS.includes(t) && feeds.length > 1) {
      if (!grouped && lastFeed) items.push({ key: "repas", type: lastFeed, icon: "solid", label: "Repas", color: ENTRY_META.bottle.color });
      grouped = true;
      continue;
    }
    items.push({ key: t, type: t, icon: t, label: ENTRY_META[t].short, color: ENTRY_META[t].color });
  }
  return (
    <SheetLayout title="Ajouter" onClose={() => sheet.close()}>
      <div className="quick">
        {items.map((it) => (
          <button key={it.key} type="button" className="qa" style={{ "--c": it.color } as CSSProperties} onClick={() => sheet.open(<EntrySheet key={it.key} type={it.type} />)}>
            <i><Icon name={it.icon} /></i>{it.label}
          </button>
        ))}
      </div>
    </SheetLayout>
  );
}

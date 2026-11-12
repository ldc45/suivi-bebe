import type { CSSProperties } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { avatarColor, BabySwitcher, initial } from "@/babies/BabySheet";
import { PlusSheet } from "@/entries/PlusSheet";
import { type EntryType, FEEDS } from "@/entries/types";
import { AccueilPage } from "@/features/accueil/AccueilPage";
import { CouchesPage } from "@/features/couches/CouchesPage";
import { JournalPage } from "@/features/journal/JournalPage";
import { MesuresPage } from "@/features/mesures/MesuresPage";
import { ReglagesPage } from "@/features/reglages/ReglagesPage";
import { RepasPage } from "@/features/repas/RepasPage";
import { SommeilPage } from "@/features/sommeil/SommeilPage";
import { TummyPage } from "@/features/tummy/TummyPage";
import { visibleTypes } from "@/lib/rules";
import { ageLabel } from "@/lib/time";
import { Icon } from "@/ui/Icon";
import type { IconName } from "@/ui/icons";
import { useSheet } from "@/ui/Overlay";
import { useApp } from "./AppContext";

/** Onglets du bas ; `types` : l’onglet n’apparaît que si l’un de ces types est affiché (Réglages). */
const NAV: { to: string; label: string; icon: IconName; types?: EntryType[] }[] = [
  { to: "/", label: "Accueil", icon: "clock" },
  { to: "/repas", label: "Repas", icon: "bottle", types: [...FEEDS, "pumping"] },
  { to: "/sommeil", label: "Sommeil", icon: "sleep", types: ["sleep"] },
  { to: "/couches", label: "Couches", icon: "diaper", types: ["diaper"] },
  { to: "/mesures", label: "Mesures", icon: "growth", types: ["growth", "temperature"] },
  { to: "/tummy", label: "Tummy", icon: "tummy", types: ["tummy"] },
];

export function Shell() {
  const { baby, babies } = useApp();
  const sheet = useSheet();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const idx = babies.findIndex((b) => b.id === baby?.id);
  const vis = visibleTypes(baby);
  const nav = NAV.filter((n) => !n.types || n.types.some((t) => vis.includes(t)));
  const half = Math.ceil(nav.length / 2);
  const navItem = (n: (typeof NAV)[number]) => (
    <NavLink key={n.to} to={n.to} end={n.to === "/"} onClick={() => window.scrollTo(0, 0)}><Icon name={n.icon} />{n.label}</NavLink>
  );

  return (
    <>
      <div className="wrap">
        <header className="top">
          <button type="button" className="who" aria-label="Changer d’enfant" onClick={() => sheet.open(<BabySwitcher />)}>
            <span className="av" style={{ background: avatarColor(idx) } as CSSProperties}>{initial(baby?.name)}</span>
            <span className="wtx"><b>{baby?.name}</b><span>{ageLabel(baby?.birthDate)}</span></span>
            <Icon name="chevron" className="rot" />
          </button>
          <div className="topr">
            <button type="button" className={`gear${pathname === "/journal" ? " on" : ""}`} aria-label="Journal" onClick={() => navigate("/journal")}><Icon name="book" /></button>
            <button type="button" className={`gear${pathname === "/reglages" ? " on" : ""}`} aria-label="Réglages" onClick={() => navigate("/reglages")}><Icon name="sliders" /></button>
          </div>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<AccueilPage />} />
            <Route path="/repas" element={<RepasPage />} />
            <Route path="/sommeil" element={<SommeilPage />} />
            <Route path="/couches" element={<CouchesPage />} />
            <Route path="/mesures" element={<MesuresPage />} />
            <Route path="/tummy" element={<TummyPage />} />
            <Route path="/journal" element={<JournalPage />} />
            <Route path="/reglages" element={<ReglagesPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <nav className="tabs">
        <div className="in" style={{ gridTemplateColumns: `repeat(${nav.length + 1}, 1fr)` }}>
          {nav.slice(0, half).map(navItem)}
          <button type="button" className="plusbtn" aria-label="Ajouter une saisie" onClick={() => sheet.open(<PlusSheet />)}><span><Icon name="plus" /></span></button>
          {nav.slice(half).map(navItem)}
        </div>
      </nav>
    </>
  );
}

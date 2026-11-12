import { type CSSProperties, lazy, Suspense } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { avatarColor, BabySwitcher, initial } from "@/babies/BabySheet";
import { PlusSheet } from "@/entries/PlusSheet";
import { type EntryType, FEEDS } from "@/entries/types";
import { AccueilPage } from "@/features/accueil/AccueilPage";
import { toggleNight, useDisplay } from "@/lib/display";
import { visibleTypes } from "@/lib/rules";
import { ageLabel } from "@/lib/time";
import { Icon } from "@/ui/Icon";
import type { IconName } from "@/ui/icons";
import { useSheet } from "@/ui/Overlay";
import { SyncStatus } from "@/ui/SyncStatus";
import { useApp } from "./AppContext";

// Écrans chargés à la demande : l’accueil s’affiche sans attendre la bibliothèque de graphiques.
const RepasPage = lazy(() => import("@/features/repas/RepasPage").then((m) => ({ default: m.RepasPage })));
const SommeilPage = lazy(() => import("@/features/sommeil/SommeilPage").then((m) => ({ default: m.SommeilPage })));
const CouchesPage = lazy(() => import("@/features/couches/CouchesPage").then((m) => ({ default: m.CouchesPage })));
const MesuresPage = lazy(() => import("@/features/mesures/MesuresPage").then((m) => ({ default: m.MesuresPage })));
const TummyPage = lazy(() => import("@/features/tummy/TummyPage").then((m) => ({ default: m.TummyPage })));
const JournalPage = lazy(() => import("@/features/journal/JournalPage").then((m) => ({ default: m.JournalPage })));
const ReglagesPage = lazy(() => import("@/features/reglages/ReglagesPage").then((m) => ({ default: m.ReglagesPage })));

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
  const { night } = useDisplay();
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
            <button type="button" className={`gear${night ? " on" : ""}`} aria-label="Mode nuit" aria-pressed={night} onClick={() => toggleNight()}><Icon name="night" /></button>
            <button type="button" className={`gear${pathname === "/journal" ? " on" : ""}`} aria-label="Journal" onClick={() => navigate("/journal")}><Icon name="book" /></button>
            <button type="button" className={`gear${pathname === "/reglages" ? " on" : ""}`} aria-label="Réglages" onClick={() => navigate("/reglages")}><Icon name="sliders" /></button>
          </div>
        </header>
        <SyncStatus />
        <main>
          <Suspense fallback={<p className="center muted">Chargement…</p>}>
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
          </Suspense>
        </main>
      </div>
      <nav className="tabs">
        {/* Colonnes proportionnelles au nombre d’onglets de chaque côté : tous les onglets ont la même largeur. */}
        <div className="in" style={{ gridTemplateColumns: `${half}fr 64px ${nav.length - half}fr` }}>
          <div className="half">{nav.slice(0, half).map(navItem)}</div>
          <button type="button" className="plusbtn" aria-label="Ajouter une saisie" onClick={() => sheet.open(<PlusSheet />)}><span><Icon name="plus" /></span></button>
          <div className="half">{nav.slice(half).map(navItem)}</div>
        </div>
      </nav>
    </>
  );
}

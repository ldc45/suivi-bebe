import { createContext, type CSSProperties, type KeyboardEvent, type ReactNode, type TouchEvent, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/* ---------- Feuille du bas ---------- */
interface SheetApi {
  open: (node: ReactNode) => void;
  /** Ferme la feuille ; `after` s’exécute une fois l’historique revenu en place (utile pour naviguer ensuite). */
  close: (after?: () => void) => void;
}
const SheetCtx = createContext<SheetApi | null>(null);
export const useSheet = () => useContext(SheetCtx)!;

/* ---------- Messages temporaires ---------- */
type ToastFn = (msg: string, undo?: () => void) => void;
const ToastCtx = createContext<ToastFn | null>(null);
export const useToast = () => useContext(ToastCtx)!;

/** Durée de fermeture : celle de la transition CSS de la feuille (forms.css). */
const CLOSE_MS = 500;
/** Au lâcher, la feuille se ferme au-delà de cette part de sa hauteur, ou d’un geste plus rapide que FLING (px/ms). */
const DISMISS_RATIO = 0.35;
const FLING = 0.45;
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<ReactNode>(null);
  // `shown` pilote la transition d’entrée et de sortie ; `node` reste monté le temps que la feuille sorte.
  const [shown, setShown] = useState(false);
  const [toast, setToast] = useState<{ msg: string; undo?: () => void; id: number } | null>(null);
  const timer = useRef<number>();
  const unmount = useRef<number>();
  const isOpen = useRef(false);
  const lastFocus = useRef<HTMLElement | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  // Une entrée d’historique par feuille ouverte : le geste « retour » du téléphone ferme la feuille
  // au lieu de quitter la page.
  const pushed = useRef(false);
  const skipPop = useRef(false);
  const afterClose = useRef<(() => void) | null>(null);

  /** Fait sortir la feuille, puis la démonte une fois la transition finie. */
  const hide = useCallback(() => {
    isOpen.current = false;
    setShown(false);
    window.clearTimeout(unmount.current);
    unmount.current = window.setTimeout(() => {
      setNode(null);
      if (lastFocus.current?.isConnected) lastFocus.current.focus({ preventScroll: true });
      lastFocus.current = null;
    }, CLOSE_MS);
  }, []);

  const close = useCallback((after?: () => void) => {
    hide();
    if (pushed.current) {
      // history.back() est asynchrone : une navigation lancée tout de suite serait annulée par ce retour.
      pushed.current = false; skipPop.current = true; afterClose.current = after ?? null;
      history.back();
    } else after?.();
  }, [hide]);

  const open = useCallback((n: ReactNode) => {
    window.clearTimeout(unmount.current);
    if (!isOpen.current) {
      lastFocus.current = document.activeElement as HTMLElement | null;
      // Une feuille rouverte pendant sa sortie repart de l’état normal.
      sheetRef.current?.style.removeProperty("transform");
      bgRef.current?.style.removeProperty("opacity");
    }
    isOpen.current = true;
    if (!pushed.current) { history.pushState({ ...history.state, sheet: true }, ""); pushed.current = true; }
    setNode(n);
    // Deux images plus tard : la feuille est d’abord posée hors écran, puis la transition d’entrée démarre.
    requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
  }, []);
  const sheet = useMemo<SheetApi>(() => ({ open, close }), [open, close]);

  useEffect(() => {
    const onPop = () => {
      if (skipPop.current) {
        skipPop.current = false;
        const after = afterClose.current; afterClose.current = null; after?.();
        return;
      }
      if (pushed.current) { pushed.current = false; hide(); }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [hide]);

  // Le focus entre dans la feuille à l’ouverture (sans ouvrir le clavier du téléphone).
  useEffect(() => { if (shown) sheetRef.current?.focus({ preventScroll: true }); }, [shown]);

  /*
   * Glisser pour fermer, depuis la poignée ou l’en-tête. Pendant le geste, la feuille suit le doigt
   * exactement (écriture directe de `transform`, aucune transition ni rendu React) et le fond s’éclaircit
   * d’autant. Au lâcher : fermeture si la feuille a parcouru plus d’un tiers de sa hauteur ou si le geste
   * est rapide, sinon retour rapide en place. Vers le haut, la feuille résiste (effet élastique).
   */
  const drag = useRef<{ y0: number; dy: number; lastY: number; lastT: number; v: number; h: number } | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    const el = sheetRef.current;
    if (!el || !(e.target as HTMLElement).closest(".grab, .shead")) return;
    const y = e.touches[0].clientY;
    drag.current = { y0: y, dy: 0, lastY: y, lastT: e.timeStamp, v: 0, h: el.offsetHeight };
    el.style.transition = "none";
    if (bgRef.current) bgRef.current.style.transition = "none";
  };
  const onTouchMove = (e: TouchEvent) => {
    const d = drag.current, el = sheetRef.current;
    if (!d || !el) return;
    const y = e.touches[0].clientY, raw = y - d.y0, dt = e.timeStamp - d.lastT;
    if (dt > 0) d.v = 0.7 * ((y - d.lastY) / dt) + 0.3 * d.v;
    d.lastY = y; d.lastT = e.timeStamp;
    d.dy = raw > 0 ? raw : raw * 0.15;
    el.style.transform = `translateY(${d.dy}px)`;
    if (bgRef.current) bgRef.current.style.opacity = String(Math.max(0, 1 - Math.max(0, d.dy) / d.h));
  };
  const onTouchEnd = () => {
    const d = drag.current, el = sheetRef.current, bg = bgRef.current;
    drag.current = null;
    if (!d || !el) return;
    if (d.dy > d.h * DISMISS_RATIO || d.v > FLING) {
      // Sortie depuis la position du doigt, dans l’axe d’entrée.
      el.style.transition = ""; el.style.transform = "translateY(100%)";
      if (bg) { bg.style.transition = ""; bg.style.opacity = "0"; }
      close();
    } else {
      // Retour en place, plus vif que l’entrée.
      el.style.transition = "transform 260ms var(--ease-drawer)"; el.style.transform = "";
      if (bg) { bg.style.transition = "opacity 260ms var(--ease-drawer)"; bg.style.opacity = ""; }
      window.setTimeout(() => { el.style.transition = ""; if (bg) bg.style.transition = ""; }, 280);
    }
  };

  /** Tab et Maj+Tab restent dans la feuille ; Échap la ferme. */
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); close(); return; }
    if (e.key !== "Tab" || !sheetRef.current) return;
    const items = [...sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1], cur = document.activeElement;
    if (e.shiftKey && (cur === first || cur === sheetRef.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && cur === last) { e.preventDefault(); first.focus(); }
  };

  const showToast = useCallback<ToastFn>((msg, undo) => {
    window.clearTimeout(timer.current);
    // Petite vibration de confirmation (Android ; ignorée là où ce n’est pas pris en charge).
    try { navigator.vibrate?.(undo ? 12 : 0); } catch { /* indisponible */ }
    setToast({ msg, undo, id: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), undo ? 5000 : 2600);
  }, []);

  useEffect(() => {
    document.body.style.overflow = node ? "hidden" : "";
  }, [node]);

  return (
    <SheetCtx.Provider value={sheet}>
      <ToastCtx.Provider value={showToast}>
        {children}
        {node && (
          <>
            <div ref={bgRef} className={`sheet-bg${shown ? " open" : ""}`} onClick={() => close()} />
            <div className={`sheet${shown ? " open" : ""}`} role="dialog" aria-modal="true" aria-labelledby={SHEET_TITLE_ID} tabIndex={-1}
              ref={sheetRef} onKeyDown={onKeyDown} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
              <div className="grab" />
              {node}
            </div>
          </>
        )}
        <div className={`toast${toast ? " show" : ""}`} role="status" aria-live="polite">
          {toast && <span>{toast.msg}</span>}
          {toast?.undo && <button type="button" onClick={() => { const u = toast.undo; setToast(null); u?.(); }}>Annuler</button>}
        </div>
      </ToastCtx.Provider>
    </SheetCtx.Provider>
  );
}

/** Titre de la feuille ouverte, annoncé par les lecteurs d’écran (une seule feuille à la fois). */
const SHEET_TITLE_ID = "sheet-title";

/** Structure d’une feuille : en-tête, corps défilant, pied fixe. */
export function SheetLayout({ title, icon, color, onClose, children, footer }: {
  title: ReactNode; icon?: ReactNode; color?: string; onClose: () => void; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <>
      <div className="body">
        <div className="shead">
          <h2 id={SHEET_TITLE_ID} style={color ? ({ "--c": color } as CSSProperties) : undefined}>{icon}{title}</h2>
          <button className="link" type="button" onClick={onClose}>Fermer</button>
        </div>
        {children}
      </div>
      {footer && <div className="foot">{footer}</div>}
    </>
  );
}

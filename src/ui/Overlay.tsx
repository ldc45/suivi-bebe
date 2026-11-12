import { createContext, type CSSProperties, type ReactNode, type TouchEvent, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/* ---------- Feuille du bas ---------- */
interface SheetApi { open: (node: ReactNode) => void; close: () => void }
const SheetCtx = createContext<SheetApi | null>(null);
export const useSheet = () => useContext(SheetCtx)!;

/* ---------- Messages temporaires ---------- */
type ToastFn = (msg: string, undo?: () => void) => void;
const ToastCtx = createContext<ToastFn | null>(null);
export const useToast = () => useContext(ToastCtx)!;

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<ReactNode>(null);
  const [toast, setToast] = useState<{ msg: string; undo?: () => void; id: number } | null>(null);
  const timer = useRef<number>();
  // Une entrée d’historique par feuille ouverte : le geste « retour » du téléphone ferme la feuille
  // au lieu de quitter la page.
  const pushed = useRef(false);
  const skipPop = useRef(false);

  const close = useCallback(() => {
    setNode(null);
    if (pushed.current) { pushed.current = false; skipPop.current = true; history.back(); }
  }, []);
  const open = useCallback((n: ReactNode) => {
    if (!pushed.current) { history.pushState({ ...history.state, sheet: true }, ""); pushed.current = true; }
    setNode(n);
  }, []);
  const sheet = useMemo<SheetApi>(() => ({ open, close }), [open, close]);

  useEffect(() => {
    const onPop = () => {
      if (skipPop.current) { skipPop.current = false; return; }
      if (pushed.current) { pushed.current = false; setNode(null); }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Glisser la feuille vers le bas (depuis la poignée ou l’en-tête) pour la fermer.
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y0: number; dy: number } | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    if (!(e.target as HTMLElement).closest(".grab, .shead")) return;
    drag.current = { y0: e.touches[0].clientY, dy: 0 };
  };
  const onTouchMove = (e: TouchEvent) => {
    const d = drag.current, el = sheetRef.current;
    if (!d || !el) return;
    d.dy = Math.max(0, e.touches[0].clientY - d.y0);
    el.style.transition = "none";
    el.style.transform = `translateY(${d.dy}px)`;
  };
  const onTouchEnd = () => {
    const d = drag.current, el = sheetRef.current;
    drag.current = null;
    if (!d || !el) return;
    el.style.transition = "";
    el.style.transform = "";
    if (d.dy > 90) close();
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
    if (!node) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [node, close]);

  return (
    <SheetCtx.Provider value={sheet}>
      <ToastCtx.Provider value={showToast}>
        {children}
        {node && (
          <>
            <div className="sheet-bg" onClick={close} />
            <div className="sheet" role="dialog" aria-modal="true" ref={sheetRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
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

/** Structure d’une feuille : en-tête, corps défilant, pied fixe. */
export function SheetLayout({ title, icon, color, onClose, children, footer }: {
  title: ReactNode; icon?: ReactNode; color?: string; onClose: () => void; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <>
      <div className="body">
        <div className="shead">
          <h2 style={color ? ({ "--c": color } as CSSProperties) : undefined}>{icon}{title}</h2>
          <button className="link" type="button" onClick={onClose}>Fermer</button>
        </div>
        {children}
      </div>
      {footer && <div className="foot">{footer}</div>}
    </>
  );
}

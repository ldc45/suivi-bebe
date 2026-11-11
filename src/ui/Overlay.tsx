import { createContext, type CSSProperties, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

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

  const close = useCallback(() => setNode(null), []);
  const sheet = useMemo<SheetApi>(() => ({ open: (n) => setNode(n), close }), [close]);
  const showToast = useCallback<ToastFn>((msg, undo) => {
    window.clearTimeout(timer.current);
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
            <div className="sheet" role="dialog" aria-modal="true">
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

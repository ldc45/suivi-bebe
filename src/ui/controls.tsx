import type { ReactNode } from "react";
import { parseNum } from "@/lib/format";

/** Choix unique sous forme de pastilles. */
export function Chips<T extends string>({ options, value, onChange, className, name }: {
  options: Record<T, string>; value: T | null | undefined; onChange: (v: T) => void; className?: string; name: string;
}) {
  return (
    <div className={`chips ${className ?? ""}`} role="radiogroup">
      {(Object.keys(options) as T[]).map((k) => (
        <label className="chip" key={k}>
          <input type="radio" name={name} checked={value === k} onChange={() => onChange(k)} />
          <span>{options[k]}</span>
        </label>
      ))}
    </div>
  );
}

/** Valeur numérique avec boutons − et +. */
export function Stepper({ value, onChange, step, decimals = 0, unit, min = 0, compact }: {
  value: string; onChange: (v: string) => void; step: number; decimals?: number; unit?: string; min?: number; compact?: boolean;
}) {
  const bump = (d: number) => {
    const v = Math.max(min, Math.round((parseNum(value) + d) * 10 ** decimals) / 10 ** decimals);
    onChange(decimals ? v.toFixed(decimals) : String(v));
  };
  return (
    <>
      <div className={`stepper${compact ? " compact" : ""}`}>
        <button type="button" onClick={() => bump(-step)} aria-label={`Moins ${step}`}>−{decimals ? "" : step}</button>
        <input type="number" inputMode="decimal" step={step} min={min} value={value} onChange={(e) => onChange(e.target.value)} aria-label={unit} />
        <button type="button" onClick={() => bump(step)} aria-label={`Plus ${step}`}>+{decimals ? "" : step}</button>
      </div>
      {unit && <div className="unit">{unit}</div>}
    </>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <span className="toggle">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span />
    </span>
  );
}

export function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="grp">
      {htmlFor ? <label className="lab" htmlFor={htmlFor}>{label}</label> : <span className="lab">{label}</span>}
      {children}
    </div>
  );
}

export const num = (v: number, dec = 0) =>
  Number(v).toLocaleString("fr-FR", { maximumFractionDigits: dec, minimumFractionDigits: dec });

/** Lit un nombre saisi avec une virgule ou un point. */
export function parseNum(v: string | number | null | undefined): number {
  const x = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(x) ? x : 0;
}
export const round5 = (v: number) => Math.round(v / 5) * 5;
export const plural = (n: number, one: string, many = `${one}s`) => (n > 1 ? many : one);
export const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

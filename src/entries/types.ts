export type EntryType =
  | "bottle" | "breastfeeding" | "pumping" | "diaper" | "medication"
  | "sleep" | "solid" | "temperature" | "tummy" | "growth";

export type Milk = "formula" | "breast" | "other";
export type Side = "left" | "right";
export type StoolColor = "mustard" | "light_yellow" | "orange" | "green" | "brown" | "pale" | "red" | "black";
export type StoolTexture = "liquid" | "seedy" | "pasty" | "formed" | "hard";
export type Amount = "small" | "medium" | "large";
export type Reaction = "none" | "mild" | "watch";
export type TempMethod = "rectal" | "axillary" | "forehead" | "ear";
export type Place = "home" | "pediatrician" | "maternity";

export interface DataMap {
  /** Un biberon « préparé » (pas encore donné) est enregistré avec inProgress = true ; `warmed` : tiédi. */
  bottle: { ml: number; milk: Milk; warmed?: boolean };
  breastfeeding: { left_min: number; right_min: number; first_side: Side };
  pumping: { left_ml: number; right_ml: number; duration_min?: number };
  diaper: { pee: boolean; poo: boolean; color?: StoolColor; texture?: StoolTexture; amount?: Amount };
  medication: { name: string; dose?: string };
  sleep: Record<string, never>;
  solid: { food: string; quantity?: string; reaction?: Reaction };
  temperature: { celsius: number; method: TempMethod };
  tummy: Record<string, never>;
  growth: { weight_g?: number; length_mm?: number; place?: Place };
}

interface EntryBase {
  id: string;
  babyId: string;
  /** ms */
  startedAt: number;
  /** ms, null tant qu’une activité chronométrée est en cours */
  endedAt: number | null;
  inProgress: boolean;
  note: string | null;
  medicationId: string | null;
  createdBy: string | null;
}

export type Entry = { [K in EntryType]: EntryBase & { type: K; data: DataMap[K] } }[EntryType];
export type EntryOf<K extends EntryType> = Extract<Entry, { type: K }>;

export const FEEDS: EntryType[] = ["bottle", "breastfeeding", "solid"];
/** Types affichés sur l’anneau intérieur du cadran. */
export const INNER_RING: EntryType[] = ["diaper", "medication", "temperature", "growth"];

export const ENTRY_META: Record<EntryType, { label: string; short: string; color: string; timer?: boolean; feminine?: boolean }> = {
  bottle:        { label: "Biberon",          short: "Biberon",     color: "#5AAFD0" },
  breastfeeding: { label: "Allaitement",      short: "Tétée",       color: "#E0A23A" },
  pumping:       { label: "Expression",       short: "Tire-lait",   color: "#BC8FD8", feminine: true },
  diaper:        { label: "Couche",           short: "Couche",      color: "#C27F45", feminine: true },
  medication:    { label: "Médicament",       short: "Médicament",  color: "#EA7670" },
  sleep:         { label: "Sommeil",          short: "Sommeil",     color: "#6F8DF0", timer: true },
  solid:         { label: "Repas solide",     short: "Solide",      color: "#8DC765" },
  temperature:   { label: "Température",      short: "Température", color: "#F09072", feminine: true },
  tummy:         { label: "Tummy time",       short: "Tummy time",  color: "#4CCBBE", timer: true },
  growth:        { label: "Pesée et mesure",  short: "Pesée",       color: "#F29BC0", feminine: true },
};
export const ENTRY_ORDER = Object.keys(ENTRY_META) as EntryType[];

export const MILK_LABEL: Record<Milk, string> = { formula: "Lait infantile", breast: "Lait maternel", other: "Autre" };
export const STOOL: Record<StoolColor, { label: string; hex: string; alert?: boolean }> = {
  mustard:      { label: "Jaune moutarde", hex: "#D4A01E" },
  light_yellow: { label: "Jaune clair",    hex: "#E9D36A" },
  orange:       { label: "Orange",         hex: "#DD8A2E" },
  green:        { label: "Vert",           hex: "#6A8C37" },
  brown:        { label: "Marron",         hex: "#7A4E2A" },
  pale:         { label: "Très pâle (blanc, gris, mastic)", hex: "#DCD8CB", alert: true },
  red:          { label: "Rouge (sang)",   hex: "#B3261E", alert: true },
  black:        { label: "Noir",           hex: "#221D1A", alert: true },
};
export const TEXTURE_LABEL: Record<StoolTexture, string> = { liquid: "Liquide", seedy: "Molle, grumeleuse", pasty: "Pâteuse", formed: "Moulée", hard: "Dure, en billes" };
export const AMOUNT_LABEL: Record<Amount, string> = { small: "Peu", medium: "Moyen", large: "Beaucoup" };
export const REACTION_LABEL: Record<Reaction, string> = { none: "Aucune", mild: "Légère", watch: "À surveiller" };
export const METHOD_LABEL: Record<TempMethod, string> = { rectal: "Rectale", axillary: "Aisselle", forehead: "Frontale", ear: "Oreille" };
export const PLACE_LABEL: Record<Place, string> = { home: "À la maison", pediatrician: "Chez le pédiatre", maternity: "À la maternité" };

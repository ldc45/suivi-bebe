import { type CSSProperties, type ReactNode, useState } from "react";
import { useApp } from "@/app/AppContext";
import { agree, FREQ_LABEL, subject } from "@/babies/types";
import { num, parseNum } from "@/lib/format";
import { visibleTypes, weights, lengths } from "@/lib/rules";
import { dayKey, dur, fromInputs, hm, keyToDate, MIN, toDateInput, toTimeInput, todayKey } from "@/lib/time";
import { Chips, Field, Stepper } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { SheetLayout, useSheet, useToast } from "@/ui/Overlay";
import { newId, useEntryMutations } from "./api";
import {
  AMOUNT_LABEL, type Amount, type Entry, ENTRY_META, type EntryType, FEEDS, METHOD_LABEL, MILK_LABEL, type Milk, PLACE_LABEL,
  type Place, REACTION_LABEL, type Reaction, type Side, STOOL, type StoolColor, type StoolTexture, TEXTURE_LABEL, type TempMethod,
} from "./types";

type Kind = "pee" | "poo" | "both";
const KIND_LABEL: Record<Kind, string> = { pee: "Pipi", poo: "Caca", both: "Les deux" };
const SIDE_LABEL: Record<Side, string> = { left: "Gauche", right: "Droite" };
const FEED_LABEL: Partial<Record<EntryType, string>> = { bottle: "Biberon", breastfeeding: "Tétée", solid: "Solide" };
const OFFSETS: [number, string][] = [[0, "Maintenant"], [5, "−5 min"], [15, "−15 min"], [30, "−30 min"]];

interface Props { type: EntryType; entry?: Entry; initialTs?: number }

/** Fenêtre de saisie et de modification, pour tous les types d’activité. */
export function EntrySheet({ type, entry: given, initialTs }: Props) {
  const app = useApp();
  const { baby, entries, medications, viewDay, isToday } = app;
  // Un seul chrono par type : si un sommeil ou une séance est déjà en cours, on ouvre celui-ci.
  const running = !given && ENTRY_META[type].timer ? entries.find((x) => x.type === type && x.inProgress) : undefined;
  const entry = given ?? running;
  const sheet = useSheet();
  const toast = useToast();
  const { save, remove } = useEntryMutations(baby?.id);
  const meta = ENTRY_META[type];
  const editing = !!entry;

  const defaultTs = (() => {
    if (initialTs) return initialTs;
    if (entry) return entry.startedAt;
    if (isToday) return Date.now();
    const d = keyToDate(viewDay), n = new Date();
    d.setHours(n.getHours(), n.getMinutes(), 0, 0);
    return Math.min(d.getTime(), Date.now());
  })();

  const d = (entry?.data ?? {}) as Record<string, unknown>;
  const lastOf = <T extends EntryType>(t: T) => entries.find((x) => x.type === t) as Extract<Entry, { type: T }> | undefined;
  const lastBottle = lastOf("bottle");
  const lastFeedSide = lastOf("breastfeeding")?.data.first_side;
  const activeMeds = medications.filter((m) => m.active || m.id === entry?.medicationId);
  const w = baby ? weights(baby, entries) : [];
  const ls = baby ? lengths(baby, entries) : [];

  const [chip, setChip] = useState<number | null>(editing || !isToday || initialTs ? null : 0);
  const [date, setDate] = useState(toDateInput(defaultTs));
  const [time, setTime] = useState(toTimeInput(defaultTs));
  const [endDate, setEndDate] = useState(entry?.endedAt && !entry.inProgress ? toDateInput(entry.endedAt) : "");
  const [endTime, setEndTime] = useState(entry?.endedAt && !entry.inProgress ? toTimeInput(entry.endedAt) : "");
  const [startDate, setStartDate] = useState(entry && type === "sleep" ? toDateInput(entry.startedAt) : "");
  const [startTime, setStartTime] = useState(entry && type === "sleep" ? toTimeInput(entry.startedAt) : "");
  const [ml, setMl] = useState(String(d.ml ?? lastBottle?.data.ml ?? 90));
  const [milk, setMilk] = useState<Milk>((d.milk as Milk) ?? lastBottle?.data.milk ?? "formula");
  const [left, setLeft] = useState(String(d.left_min ?? d.left_ml ?? 0));
  const [right, setRight] = useState(String(d.right_min ?? d.right_ml ?? 0));
  const [firstSide, setFirstSide] = useState<Side>((d.first_side as Side) ?? (lastFeedSide === "left" ? "right" : "left"));
  const [duration, setDuration] = useState(
    type === "tummy" && entry && !entry.inProgress && entry.endedAt ? String(Math.round((entry.endedAt - entry.startedAt) / MIN)) : String(d.duration_min ?? ""),
  );
  const [kind, setKind] = useState<Kind | null>(entry?.type === "diaper" ? (entry.data.pee && entry.data.poo ? "both" : entry.data.poo ? "poo" : "pee") : null);
  const [color, setColor] = useState<StoolColor | undefined>(d.color as StoolColor | undefined);
  const [texture, setTexture] = useState<StoolTexture | undefined>(d.texture as StoolTexture | undefined);
  const [amount, setAmount] = useState<Amount | undefined>(d.amount as Amount | undefined);
  const [medId, setMedId] = useState<string>(entry ? entry.medicationId ?? "__other" : activeMeds.length === 1 ? activeMeds[0].id : activeMeds.length ? "" : "__other");
  const [medName, setMedName] = useState(entry && !entry.medicationId ? String(d.name ?? "") : "");
  const [dose, setDose] = useState(String(d.dose ?? ""));
  const [food, setFood] = useState(String(d.food ?? ""));
  const [quantity, setQuantity] = useState(String(d.quantity ?? ""));
  const [reaction, setReaction] = useState<Reaction>((d.reaction as Reaction) ?? "none");
  const [celsius, setCelsius] = useState(String(d.celsius ?? "37.0"));
  const [method, setMethod] = useState<TempMethod>((d.method as TempMethod) ?? "rectal");
  // Jamais prérempli avec la dernière pesée : noter seulement une taille ne doit pas recopier l’ancien poids.
  const [kg, setKg] = useState(d.weight_g ? (Number(d.weight_g) / 1000).toFixed(2) : "");
  const lastKg = w.length ? w[w.length - 1].value : undefined;
  const [cm, setCm] = useState(d.length_mm ? String(Number(d.length_mm) / 10) : "");
  const [place, setPlace] = useState<Place>((d.place as Place) ?? "home");
  const [note, setNote] = useState(entry?.note ?? "");
  const [busy, setBusy] = useState(false);

  if (!baby) return null;

  const pickOffset = (o: number) => { const t = Date.now() - o * MIN; setChip(o); setDate(toDateInput(t)); setTime(toTimeInput(t)); };
  const startTs = () => (chip === 0 ? Date.now() : fromInputs(date, time));

  const base = (startedAt: number) => ({
    id: entry?.id ?? newId(), babyId: baby.id, startedAt, endedAt: null as number | null, inProgress: false,
    note: note.trim() || null, medicationId: null as string | null, createdBy: entry?.createdBy ?? app.userId,
  });

  /** Construit la saisie à partir du formulaire, ou renvoie un message d’erreur. */
  function build(): Entry | string {
    if (type === "sleep") {
      const s = fromInputs(startDate, startTime), e = fromInputs(endDate, endTime);
      if (!Number.isFinite(s)) return "Indiquez l’heure d’endormissement.";
      if (s > Date.now() + 5 * MIN) return "L’heure est dans le futur.";
      if (Number.isFinite(e) && e <= s) return "Le réveil doit être après l’endormissement.";
      return { ...base(s), type: "sleep", data: {}, endedAt: Number.isFinite(e) ? e : null, inProgress: !Number.isFinite(e) };
    }
    const ts = startTs();
    if (!Number.isFinite(ts)) return "Indiquez la date et l’heure.";
    if (ts > Date.now() + 5 * MIN) return "L’heure est dans le futur.";
    const b = base(ts);
    switch (type) {
      case "bottle": { const v = parseNum(ml); return v > 0 ? { ...b, type, data: { ml: v, milk } } : "Indiquez la quantité."; }
      case "breastfeeding": { const l = parseNum(left), r = parseNum(right); if (l + r <= 0) return "Indiquez la durée d’au moins un sein."; return { ...b, type, data: { left_min: l, right_min: r, first_side: firstSide }, endedAt: ts + (l + r) * MIN }; }
      case "pumping": { const l = parseNum(left), r = parseNum(right); if (l + r <= 0) return "Indiquez au moins une quantité."; return { ...b, type, data: { left_ml: l, right_ml: r, duration_min: parseNum(duration) || undefined } }; }
      case "diaper": {
        if (!kind) return "Choisissez pipi, caca ou les deux.";
        const poo = kind !== "pee";
        return { ...b, type, data: { pee: kind !== "poo", poo, ...(poo ? { color, texture, amount } : {}) } };
      }
      case "medication": {
        const m = medications.find((x) => x.id === medId);
        const name = m ? m.name : medName.trim();
        if (!name) return "Indiquez le médicament.";
        return { ...b, type, medicationId: m?.id ?? null, data: { name, dose: dose.trim() || m?.dose || "" } };
      }
      case "solid": return food.trim() ? { ...b, type, data: { food: food.trim(), quantity: quantity.trim() || undefined, reaction } } : "Indiquez l’aliment.";
      case "temperature": { const c = Math.round(parseNum(celsius) * 10) / 10; return c >= 30 && c <= 45 ? { ...b, type, data: { celsius: c, method } } : "Indiquez une température entre 30 et 45 °C."; }
      case "tummy": {
        const m = parseNum(duration);
        if (entry?.inProgress && !m) return { ...b, type, data: {}, inProgress: true };
        return m > 0 ? { ...b, type, data: {}, endedAt: ts + m * MIN } : "Indiquez la durée, ou utilisez Démarrer.";
      }
      case "growth": {
        const k = parseNum(kg), c = parseNum(cm);
        if (!k && !c) return "Indiquez un poids ou une taille.";
        if (k && (k < 1 || k > 30)) return "Vérifiez le poids, en kilogrammes.";
        if (c && (c < 35 || c > 120)) return "Vérifiez la taille, en centimètres.";
        return { ...b, type, data: { weight_g: k ? Math.round(k * 1000) : undefined, length_mm: c ? Math.round(c * 10) : undefined, place } };
      }
      default: return "Type inconnu.";
    }
  }

  // L’écran est mis à jour tout de suite ; l’envoi au serveur se fait en arrière-plan, même hors ligne.
  const persist = (e: Entry, msg: string, undoable: boolean) => {
    if (busy) return;
    setBusy(true);
    save.mutate(e);
    sheet.close();
    toast(msg, undoable ? () => remove.mutate(e.id) : undefined);
  };
  const onSave = () => {
    const r = build();
    if (typeof r === "string") return toast(r);
    persist(r, editing ? "Modification enregistrée" : `${meta.label} ${meta.feminine ? "enregistrée" : "enregistré"}`, !editing);
  };
  const onStart = () => {
    if (entries.some((x) => x.type === type && x.inProgress)) return toast(type === "sleep" ? "Un sommeil est déjà en cours." : "Une séance est déjà en cours.");
    const ts = type === "tummy" && chip !== 0 ? Math.min(fromInputs(date, time) || Date.now(), Date.now()) : Date.now();
    persist({ ...base(ts), type: type as "sleep", data: {}, inProgress: true }, type === "sleep" ? "Bonne sieste" : "Chrono lancé", true);
  };
  const onStop = () => {
    if (!entry) return;
    const now = Date.now();
    persist({ ...entry, inProgress: false, endedAt: now } as Entry, `${meta.label} : ${dur(now - entry.startedAt)}`, false);
  };
  const onDelete = () => {
    if (!entry) return;
    remove.mutate(entry.id);
    sheet.close();
    toast("Saisie supprimée", () => save.mutate(entry));
  };

  const switchTo = (t: EntryType) => {
    const keep = chip === 0 ? undefined : fromInputs(date, time);
    sheet.open(<EntrySheet key={`${t}-${Date.now()}`} type={t} initialTs={Number.isFinite(keep) ? keep : undefined} />);
  };

  const feeds = visibleTypes(baby).filter((t) => FEEDS.includes(t));
  const isFeedNew = !editing && FEEDS.includes(type) && feeds.length > 1;

  const timeBlock = (label: string) => (
    <div className="grp">
      <span className="lab">{label}</span>
      <div className="chips timechips">
        {OFFSETS.map(([o, l]) => <button key={o} type="button" aria-pressed={chip === o} onClick={() => pickOffset(o)}>{l}</button>)}
      </div>
      <div className="row2" style={{ marginTop: 10 }}>
        <input className="inp" type="date" max={todayKey()} value={date} onChange={(e) => { setDate(e.target.value); setChip(null); }} aria-label="Date" />
        <input className="inp" type="time" value={time} onChange={(e) => { setTime(e.target.value); setChip(null); }} aria-label="Heure" />
      </div>
    </div>
  );

  const stool = kind === "poo" || kind === "both";
  const sw = color ? STOOL[color] : null;

  let body: ReactNode = null;
  switch (type) {
    case "bottle":
      body = <>{timeBlock("Date et heure")}<div className="grp"><Stepper value={ml} onChange={setMl} step={10} unit="millilitres" /></div>
        <Field label="Contenu"><Chips name="milk" options={MILK_LABEL} value={milk} onChange={setMilk} /></Field></>;
      break;
    case "breastfeeding":
      body = <>{timeBlock("Début")}<div className="grp row2">
        <div className="side"><span className="lab">Sein gauche</span><Stepper compact value={left} onChange={setLeft} step={5} unit="minutes" /></div>
        <div className="side"><span className="lab">Sein droit</span><Stepper compact value={right} onChange={setRight} step={5} unit="minutes" /></div></div>
        <Field label="Commencé par"><Chips name="side" options={SIDE_LABEL} value={firstSide} onChange={setFirstSide} /></Field></>;
      break;
    case "pumping":
      body = <>{timeBlock("Date et heure")}<div className="grp row2">
        <div className="side"><span className="lab">Gauche</span><Stepper compact value={left} onChange={setLeft} step={10} unit="ml" /></div>
        <div className="side"><span className="lab">Droite</span><Stepper compact value={right} onChange={setRight} step={10} unit="ml" /></div></div>
        <Field label="Durée (minutes)" htmlFor="dur"><input id="dur" className="inp" type="number" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Facultatif" /></Field></>;
      break;
    case "diaper":
      body = <>{timeBlock("Date et heure")}<div className="grp"><Chips name="kind" className="big3" options={KIND_LABEL} value={kind} onChange={setKind} /></div>
        {stool && <>
          <div className="grp"><span className="lab">Couleur</span>
            <div className="swatches">{(Object.keys(STOOL) as StoolColor[]).map((c) => (
              <label className="sw" key={c}><input type="radio" name="color" checked={color === c} onChange={() => setColor(c)} aria-label={STOOL[c].label} /><span style={{ "--sc": STOOL[c].hex } as CSSProperties} /></label>))}</div>
            <div className={`swname${sw?.alert ? " alert" : ""}`}>{sw ? `${sw.label}${sw.alert ? " : à signaler au médecin" : ""}` : "Touchez la couleur la plus proche"}</div></div>
          <Field label="Texture"><Chips name="texture" options={TEXTURE_LABEL} value={texture} onChange={setTexture} /></Field>
          <Field label="Quantité"><Chips name="amount" options={AMOUNT_LABEL} value={amount} onChange={setAmount} /></Field></>}</>;
      break;
    case "medication": {
      const opts = Object.fromEntries([...activeMeds.map((m) => [m.id, m.name]), ["__other", "Autre"]]) as Record<string, string>;
      const current = medications.find((m) => m.id === medId);
      body = <>{timeBlock("Date et heure")}
        {activeMeds.length > 0 && <Field label="Médicament"><Chips name="med" options={opts} value={medId} onChange={setMedId} /></Field>}
        {medId === "__other" && <Field label="Nom du médicament" htmlFor="mn"><input id="mn" className="inp" value={medName} onChange={(e) => setMedName(e.target.value)} /></Field>}
        <Field label="Dose" htmlFor="dose"><input id="dose" className="inp" value={dose} onChange={(e) => setDose(e.target.value)} placeholder={current?.dose ? `Dose habituelle : ${current.dose}` : "Ex. 1 goutte, 2,5 ml"} /></Field>
        {current && <p className="small muted">{FREQ_LABEL[current.frequency]}{current.timeOfDay ? `, à ${current.timeOfDay}` : ""}</p>}</>;
      break;
    }
    case "sleep":
      body = <>{!editing && <p className="muted" style={{ marginTop: 0 }}>Lancez le chrono quand {baby.name} s’endort, puis appuyez sur Réveil. Pour une sieste déjà terminée, indiquez les heures.</p>}
        <Field label={`${agree(baby, "Endormi")} le`}><div className="row2"><input className="inp" type="date" max={todayKey()} value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-label="Date d’endormissement" /><input className="inp" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} aria-label="Heure d’endormissement" /></div></Field>
        <Field label={`${agree(baby, "Réveillé")} le`}><div className="row2"><input className="inp" type="date" max={todayKey()} value={endDate} onChange={(e) => setEndDate(e.target.value)} aria-label="Date de réveil" /><input className="inp" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} aria-label="Heure de réveil" /></div></Field>
        {entry?.inProgress && <p className="small muted">Laissez le réveil vide si le sommeil continue.</p>}</>;
      break;
    case "solid": {
      const foods = [...new Set(entries.filter((x) => x.type === "solid").map((x) => (x.type === "solid" ? x.data.food : "")).filter(Boolean))].slice(0, 8);
      body = <>{timeBlock("Date et heure")}
        <Field label="Aliment" htmlFor="food"><input id="food" className="inp" value={food} onChange={(e) => setFood(e.target.value)} placeholder="Ex. purée de carotte" />
          {!editing && foods.length > 0 && <div className="chips" style={{ marginTop: 10 }}>{foods.map((f) => <button key={f} type="button" className="btn" style={{ padding: "8px 12px", fontWeight: 500 }} onClick={() => setFood(f)}>{f}</button>)}</div>}</Field>
        <Field label="Quantité" htmlFor="qty"><input id="qty" className="inp" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Ex. 3 cuillères" /></Field>
        <Field label="Réaction"><Chips name="reaction" options={REACTION_LABEL} value={reaction} onChange={setReaction} /></Field></>;
      break;
    }
    case "temperature":
      body = <>{timeBlock("Date et heure")}<div className="grp"><Stepper value={celsius} onChange={setCelsius} step={0.1} decimals={1} unit="degrés Celsius" /></div>
        <Field label="Méthode"><Chips name="method" options={METHOD_LABEL} value={method} onChange={setMethod} /></Field></>;
      break;
    case "tummy":
      body = <>{!editing && <p className="muted" style={{ marginTop: 0 }}>Lancez le chrono au début de la séance, ou saisissez une séance déjà faite.</p>}
        {timeBlock("Début")}<div className="grp"><Stepper value={duration} onChange={setDuration} step={1} unit="minutes" min={1} /></div></>;
      break;
    case "growth":
      body = <>{timeBlock("Date de la mesure")}<div className="grp"><Stepper value={kg} onChange={setKg} step={0.01} decimals={2} unit="kilogrammes" fallback={lastKg}
          placeholder={lastKg ? `Dernier : ${num(lastKg, 2)}` : "Poids"} /></div>
        {baby.settings.show_length !== false && <Field label="Taille (cm)" htmlFor="cm"><input id="cm" className="inp" type="number" inputMode="decimal" step="0.1" value={cm} onChange={(e) => setCm(e.target.value)} placeholder={ls.length ? `Dernière : ${num(ls[ls.length - 1].value, 1)} cm` : "Facultatif"} /></Field>}
        <Field label="Où"><Chips name="place" options={PLACE_LABEL} value={place} onChange={setPlace} /></Field></>;
      break;
  }

  let footer: ReactNode;
  if (!editing && (type === "sleep" || type === "tummy")) {
    footer = <><button className="btn wide" type="button" disabled={busy} onClick={onSave}>{type === "sleep" ? "Enregistrer la sieste" : "Enregistrer la séance"}</button>
      <button className="btn primary wide" type="button" disabled={busy} onClick={onStart}>{type === "sleep" ? `${subject(baby)} s’endort` : "Démarrer"}</button></>;
  } else if (entry?.inProgress) {
    footer = <><button className="btn danger" type="button" onClick={onDelete}>Supprimer</button>
      <button className="btn wide" type="button" disabled={busy} onClick={onSave}>Enregistrer</button>
      <button className="btn primary wide" type="button" disabled={busy} onClick={onStop}>{type === "sleep" ? "Réveil" : "Terminer"}</button></>;
  } else {
    footer = <>{editing && <button className="btn danger" type="button" onClick={onDelete}>Supprimer</button>}
      <button className="btn primary wide" type="button" disabled={busy} onClick={onSave}>Enregistrer</button></>;
  }

  return (
    <SheetLayout
      title={editing ? "Modifier" : isFeedNew ? "Repas" : meta.label}
      icon={<Icon name={isFeedNew ? "solid" : type} />}
      color={meta.color}
      onClose={sheet.close}
      footer={footer}
    >
      {isFeedNew && (
        <div className="pills feedseg">
          {feeds.map((t) => (
            <button key={t} type="button" aria-pressed={t === type} style={{ "--c": ENTRY_META[t].color } as CSSProperties} onClick={() => t !== type && switchTo(t)}>
              <Icon name={t} />{FEED_LABEL[t]}
            </button>
          ))}
        </div>
      )}
      {body}
      <Field label="Note" htmlFor="note"><input id="note" className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Facultatif" /></Field>
      {editing && entry && <p className="small muted">Saisie du {dayKey(entry.startedAt) === todayKey() ? "jour" : dayKey(entry.startedAt).split("-").reverse().join("/")} à {hm(entry.startedAt)}.</p>}
    </SheetLayout>
  );
}

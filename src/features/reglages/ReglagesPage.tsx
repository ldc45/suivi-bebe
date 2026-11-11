import { type CSSProperties, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/app/AppContext";
import { useMedicationMutations, useUpdateBaby } from "@/babies/api";
import { useBabyForm } from "@/babies/BabyForm";
import { FREQ_LABEL, type Frequency, type Thresholds } from "@/babies/types";
import { ENTRY_META, ENTRY_ORDER, type EntryType } from "@/entries/types";
import { signOut } from "@/lib/auth";
import { parseNum } from "@/lib/format";
import { autoGap, thresholds } from "@/lib/rules";
import { supabase } from "@/lib/supabase";
import { ageDays, ageLabel } from "@/lib/time";
import { Chips, Field, Toggle } from "@/ui/controls";
import { useToast } from "@/ui/Overlay";

function ProfileSection() {
  const { baby } = useApp();
  const toast = useToast();
  const update = useUpdateBaby(baby);
  const { fields, read } = useBabyForm(baby);
  const save = () => {
    const r = read();
    if (typeof r === "string") return toast(r);
    update.mutate(r, { onSuccess: () => toast("Profil enregistré"), onError: () => toast("Enregistrement impossible.") });
  };
  return <div className="panel">{fields}<button type="button" className="btn primary wide block" onClick={save}>Enregistrer le profil</button></div>;
}

function MedicationsSection() {
  const { baby, medications } = useApp();
  const toast = useToast();
  const { save, remove } = useMedicationMutations(baby?.id);
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [time, setTime] = useState("09:00");
  const add = () => {
    if (!name.trim()) return toast("Indiquez le nom du médicament.");
    save.mutate({ name: name.trim(), dose: dose.trim() || null, frequency, timeOfDay: frequency === "daily" ? time || null : null, active: true },
      { onSuccess: () => { toast(`${name.trim()} ajouté`); setName(""); setDose(""); } });
  };
  return (
    <div className="panel">
      {!medications.length && <p className="small muted" style={{ marginTop: 0 }}>Aucun pour l’instant. Ajoutez par exemple la vitamine D si elle a été prescrite.</p>}
      {medications.map((m) => (
        <div key={m.id} className="set-item" style={{ flexWrap: "wrap" }}>
          <span style={{ flex: 1, minWidth: 140 }}><b style={{ fontWeight: 500, opacity: m.active ? 1 : 0.55 }}>{m.name}</b><br />
            <span className="small muted">{FREQ_LABEL[m.frequency]}{m.dose ? `, ${m.dose}` : ""}{m.active ? "" : ", en pause"}</span></span>
          {m.frequency === "daily" && <input className="inp" type="time" style={{ width: "auto", padding: "9px 10px" }} value={m.timeOfDay ?? ""} aria-label={`Heure de prise de ${m.name}`}
            onChange={(e) => save.mutate({ ...m, timeOfDay: e.target.value || null })} />}
          <span style={{ display: "flex", gap: 6 }}>
            <button type="button" className="btn" onClick={() => save.mutate({ ...m, active: !m.active })}>{m.active ? "Mettre en pause" : "Reprendre"}</button>
            <button type="button" className="btn danger" onClick={() => confirm(`Retirer ${m.name} de la liste ?`) && remove.mutate(m.id)}>Retirer</button>
          </span>
        </div>
      ))}
      <div style={{ marginTop: 14 }}>
        <div className="chips" style={{ marginBottom: 12 }}>
          <button type="button" className="btn" onClick={() => { setName("Vitamine D"); setDose("2 gouttes"); setFrequency("daily"); }}>Vitamine D</button>
          <button type="button" className="btn" onClick={() => { setName("Vitamine K"); setFrequency("weekly"); }}>Vitamine K</button>
        </div>
        <Field label="Nom" htmlFor="mName"><input id="mName" className="inp" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Dose habituelle (facultatif)" htmlFor="mDose"><input id="mDose" className="inp" value={dose} onChange={(e) => setDose(e.target.value)} placeholder="Ex. 1 goutte" /></Field>
        <Field label="Fréquence"><Chips name="freq" options={FREQ_LABEL} value={frequency} onChange={setFrequency} /></Field>
        {frequency === "daily" && <Field label="Heure de prise" htmlFor="mTime"><input id="mTime" className="inp" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>}
        <button type="button" className="btn primary wide block" onClick={add}>Ajouter</button>
      </div>
      <p className="small muted">Retirer un médicament n’efface pas les prises déjà enregistrées.</p>
    </div>
  );
}

function TypesSection() {
  const { baby } = useApp();
  const update = useUpdateBaby(baby);
  if (!baby) return null;
  const hidden = new Set(baby.settings.hidden_types ?? []);
  const set = (t: EntryType, visible: boolean) => {
    const next = new Set(hidden); if (visible) next.delete(t); else next.add(t);
    update.mutate({ settings: { ...baby.settings, hidden_types: [...next] } });
  };
  return (
    <div className="panel">
      {ENTRY_ORDER.map((t) => (
        <div key={t} className="set-item">
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="dot" style={{ "--c": ENTRY_META[t].color } as CSSProperties} />{ENTRY_META[t].label}</span>
          <Toggle checked={!hidden.has(t)} onChange={(v) => set(t, v)} label={`Afficher ${ENTRY_META[t].label}`} />
        </div>
      ))}
      <div className="set-item">
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="dot" style={{ "--c": ENTRY_META.growth.color } as CSSProperties} />Suivre aussi la taille</span>
        <Toggle checked={baby.settings.show_length !== false} onChange={(v) => update.mutate({ settings: { ...baby.settings, show_length: v } })} label="Suivre la taille" />
      </div>
    </div>
  );
}

function ThresholdsSection() {
  const { baby } = useApp();
  const toast = useToast();
  const update = useUpdateBaby(baby);
  const th = thresholds(baby);
  const [v, setV] = useState({ fever: String(th.fever), wetMin: String(th.wetMin), gapH: th.gapAuto ? "" : String(th.gapH), dropPct: String(th.dropPct), tummyMin: String(th.tummyMin), mlPerKg: String(th.mlPerKg) });
  if (!baby) return null;
  const field = (k: keyof typeof v, label: string, step: number, placeholder?: string) => (
    <Field label={label} htmlFor={`t-${k}`}><input id={`t-${k}`} className="inp" type="number" inputMode="decimal" step={step} value={v[k]} placeholder={placeholder} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Field>
  );
  const save = () => {
    const t: Thresholds = { fever: parseNum(v.fever) || 38, wetMin: Math.round(parseNum(v.wetMin)) || 6, dropPct: parseNum(v.dropPct) || 30, tummyMin: parseNum(v.tummyMin) || 30, mlPerKg: parseNum(v.mlPerKg) || 150 };
    if (v.gapH !== "") t.gapH = parseNum(v.gapH);
    if (t.fever! < 37 || t.fever! > 40) return toast("Le seuil de fièvre doit être entre 37 et 40 °C.");
    update.mutate({ settings: { ...baby.settings, thresholds: t } }, { onSuccess: () => toast("Repères enregistrés") });
  };
  return (
    <div className="panel">
      <p className="small muted" style={{ marginTop: 0 }}>Valeurs par défaut adaptées à l’âge de {baby.name} ({ageLabel(baby.birthDate)}). Ajustez-les avec votre médecin si besoin.</p>
      <div className="row2">{field("fever", "Fièvre à partir de (°C)", 0.1)}{field("wetMin", "Couches mouillées min. sur 24 h", 1)}</div>
      <div className="row2">{field("gapH", "Repas au plus toutes les (h)", 0.5, `Auto : ${autoGap(ageDays(baby.birthDate)) || "désactivé"}`)}{field("dropPct", "Baisse de lait signalée (%)", 5)}</div>
      <div className="row2">{field("tummyMin", "Objectif de tummy time (min)", 5)}{field("mlPerKg", "Repère de lait (ml/kg/jour)", 5)}</div>
      <p className="small muted">Repas : laissez vide pour le réglage automatique selon l’âge, ou mettez 0 pour désactiver ce rappel. Le repère de lait est indicatif et à valider avec votre pédiatre.</p>
      <button type="button" className="btn primary wide block" onClick={save}>Enregistrer les repères</button>
    </div>
  );
}

function AccountSection() {
  const { email, householdId } = useApp();
  const members = useQuery({
    queryKey: ["members", householdId],
    queryFn: async () => {
      const { data, error } = await supabase.from("household_members").select("email").eq("household_id", householdId);
      if (error) throw error;
      return (data as { email: string }[]).map((m) => m.email);
    },
  });
  return (
    <div className="panel small">
      <p style={{ marginTop: 0 }}>Connecté avec {email}.</p>
      {members.data && <p>Membres du foyer : {members.data.join(", ")}.</p>}
      <p>Pour donner accès à quelqu’un, ajoutez son adresse dans Supabase, table <b>household_members</b>. Il se connectera ensuite avec un code reçu par e-mail.</p>
      <button type="button" className="btn" onClick={() => signOut()}>Se déconnecter</button>
    </div>
  );
}

export function ReglagesPage() {
  const { baby } = useApp();
  if (!baby) return null;
  return (
    <>
      <h1 className="ptitle">Réglages</h1>
      {/* key : réinitialise les formulaires quand on change d’enfant */}
      <div key={baby.id}>
        <h2 className="sec">Profil</h2><ProfileSection />
        <h2 className="sec">Médicaments et suppléments</h2><MedicationsSection />
        <h2 className="sec">Types d’activité affichés</h2><TypesSection />
        <h2 className="sec">Repères des alertes</h2><ThresholdsSection />
      </div>
      <h2 className="sec">Compte et partage</h2><AccountSection />
    </>
  );
}

import type { CSSProperties } from "react";
import { useApp } from "@/app/AppContext";
import { ageLabel } from "@/lib/time";
import { Icon } from "@/ui/Icon";
import { SheetLayout, useSheet, useToast } from "@/ui/Overlay";
import { useCreateBaby } from "./api";
import { useBabyForm } from "./BabyForm";

const AVATAR = ["#F3CA70", "#F29BC0", "#8DC765", "#5AAFD0", "#BC8FD8", "#F09072"];
export const avatarColor = (index: number) => AVATAR[Math.max(0, index) % AVATAR.length];
export const initial = (name?: string) => (name || "?").trim().charAt(0).toUpperCase();

/** Liste des enfants du foyer, pour changer d’enfant affiché. */
export function BabySwitcher() {
  const { babies, baby, selectBaby } = useApp();
  const sheet = useSheet();
  const toast = useToast();
  return (
    <SheetLayout title="Enfants suivis" onClose={() => sheet.close()}
      footer={<button className="btn wide" type="button" onClick={() => sheet.open(<NewBabySheet />)}>+ Ajouter un enfant</button>}>
      {babies.map((b, i) => (
        <button key={b.id} type="button" className="bsel" aria-current={b.id === baby?.id} onClick={() => {
          sheet.close();
          if (b.id !== baby?.id) { selectBaby(b.id); toast(`Suivi de ${b.name}`); }
        }}>
          <span className="av" style={{ background: avatarColor(i) } as CSSProperties}>{initial(b.name)}</span>
          <span className="lt"><b>{b.name}</b><span>{ageLabel(b.birthDate)}</span></span>
          {b.id === baby?.id && <Icon name="check" />}
        </button>
      ))}
    </SheetLayout>
  );
}

function NewBabySheet() {
  const { householdId, selectBaby } = useApp();
  const sheet = useSheet();
  const toast = useToast();
  const create = useCreateBaby(householdId);
  const { fields, read } = useBabyForm();
  const submit = () => {
    const r = read();
    if (typeof r === "string") return toast(r);
    create.mutate(r, {
      onSuccess: (b) => { selectBaby(b.id); sheet.close(); toast("Profil créé"); },
      onError: () => toast("Création impossible. Vérifiez la connexion."),
    });
  };
  return (
    <SheetLayout title="Ajouter un enfant" onClose={() => sheet.close()}
      footer={<button className="btn primary wide" type="button" disabled={create.isPending} onClick={submit}>Créer le profil</button>}>
      {fields}
    </SheetLayout>
  );
}

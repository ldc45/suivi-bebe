import { signOut } from "@/lib/auth";
import { useCreateBaby } from "@/babies/api";
import { useBabyForm } from "@/babies/BabyForm";
import { useToast } from "@/ui/Overlay";

export function NotConfigured() {
  return <div className="onboard"><h1>Configuration à terminer</h1><p>Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans le fichier .env.local (en local) ou dans les variables d’environnement de Netlify, puis relancez le build.</p></div>;
}

export function NotMember({ email }: { email: string }) {
  return (
    <div className="onboard">
      <h1>Accès non autorisé</h1>
      <p>L’adresse {email} ne fait partie d’aucun foyer. Demandez à l’autre parent de l’ajouter dans Supabase, table household_members.</p>
      <button type="button" className="btn wide block" onClick={() => signOut()}>Utiliser une autre adresse</button>
    </div>
  );
}

export function Loading({ text = "Chargement…" }: { text?: string }) {
  return <div className="center muted">{text}</div>;
}

/** Premier profil d’enfant du foyer. */
export function FirstBaby({ householdId }: { householdId: string }) {
  const toast = useToast();
  const create = useCreateBaby(householdId);
  const { fields, read } = useBabyForm();
  const submit = () => {
    const r = read();
    if (typeof r === "string") return toast(r);
    create.mutate(r, { onError: () => toast("Création impossible. Vérifiez la connexion.") });
  };
  return (
    <div className="onboard">
      <h1>Faisons connaissance</h1>
      <p>Ces informations règlent les repères de l’appli selon l’âge et le poids de votre bébé, et elles évolueront avec lui.</p>
      {fields}
      <button type="button" className="btn primary wide block" disabled={create.isPending} onClick={submit}>Commencer le suivi</button>
    </div>
  );
}

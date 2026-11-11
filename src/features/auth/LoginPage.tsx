import { useState } from "react";
import { signIn, signUp } from "@/lib/auth";
import { useToast } from "@/ui/Overlay";

const STORAGE_KEY = "suivi-bebe:email";
type Mode = "login" | "signup";

/** Connexion par e-mail et mot de passe ; à la première visite, chaque parent crée son mot de passe. */
export function LoginPage() {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState(() => { try { return localStorage.getItem(STORAGE_KEY) ?? ""; } catch { return ""; } });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  const submit = async () => {
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return toast("Vérifiez l’adresse e-mail.");
    if (password.length < 8) return toast("Le mot de passe doit faire au moins 8 caractères.");
    if (signup && password !== confirm) return toast("Les deux mots de passe ne correspondent pas.");
    setBusy(true);
    const { error } = signup ? await signUp(e, password) : await signIn(e, password);
    setBusy(false);
    if (error) {
      if (!signup) return toast("E-mail ou mot de passe incorrect. Première connexion ? Créez votre mot de passe.");
      return toast(/registered|exists/i.test(error.message) ? "Ce compte existe déjà : connectez-vous." : `Création impossible : ${error.message}`);
    }
    try { localStorage.setItem(STORAGE_KEY, e); } catch { /* stockage indisponible */ }
  };

  return (
    <div className="onboard">
      <h1>{signup ? "Créer mon mot de passe" : "Connexion"}</h1>
      <p>{signup ? "Première connexion : choisissez un mot de passe d’au moins 8 caractères." : "Connectez-vous avec votre adresse e-mail et votre mot de passe."}</p>
      <div className="field"><label htmlFor="email">Adresse e-mail</label>
        <input id="email" className="inp" type="email" inputMode="email" autoComplete="email" value={email} onChange={(ev) => setEmail(ev.target.value)} /></div>
      <div className="field"><label htmlFor="pwd">Mot de passe</label>
        <input id="pwd" className="inp" type="password" autoComplete={signup ? "new-password" : "current-password"} value={password} onChange={(ev) => setPassword(ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && !signup && submit()} /></div>
      {signup && <div className="field"><label htmlFor="pwd2">Confirmer le mot de passe</label>
        <input id="pwd2" className="inp" type="password" autoComplete="new-password" value={confirm} onChange={(ev) => setConfirm(ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && submit()} /></div>}
      <button type="button" className="btn primary wide block" disabled={busy} onClick={submit}>{signup ? "Créer et me connecter" : "Se connecter"}</button>
      <button type="button" className="link center-link" onClick={() => setMode(signup ? "login" : "signup")}>
        {signup ? "J’ai déjà un mot de passe" : "Première connexion ? Créer mon mot de passe"}
      </button>
    </div>
  );
}

import { useState } from "react";
import { sendCode, verifyCode } from "@/lib/auth";
import { useToast } from "@/ui/Overlay";

const STORAGE_KEY = "suivi-bebe:email";

/** Connexion sans mot de passe : un code à 6 chiffres est envoyé par e-mail. */
export function LoginPage() {
  const toast = useToast();
  const [email, setEmail] = useState(() => { try { return localStorage.getItem(STORAGE_KEY) ?? ""; } catch { return ""; } });
  const [step, setStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return toast("Vérifiez l’adresse e-mail.");
    setBusy(true);
    const { error } = await sendCode(e);
    setBusy(false);
    if (error) return toast(error.status === 429 ? "Trop de demandes, réessayez dans quelques minutes." : `Envoi impossible : ${error.message}`);
    try { localStorage.setItem(STORAGE_KEY, e); } catch { /* stockage indisponible */ }
    setEmail(e); setStep("code");
  };
  const verify = async () => {
    const t = code.replace(/\s/g, "");
    if (t.length < 6) return toast("Entrez le code reçu par e-mail.");
    setBusy(true);
    const { error } = await verifyCode(email, t);
    setBusy(false);
    if (error) toast("Code incorrect ou expiré.");
  };

  if (step === "code") return (
    <div className="onboard">
      <h1>Vérifiez vos e-mails</h1>
      <p>Un code à 6 chiffres a été envoyé à {email}. Il peut mettre une minute à arriver.</p>
      <div className="field"><label htmlFor="otp">Code reçu</label>
        <input id="otp" className="inp otp" inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} autoFocus onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && verify()} /></div>
      <button type="button" className="btn primary wide block" disabled={busy} onClick={verify}>Se connecter</button>
      <button type="button" className="link center-link" onClick={() => setStep("email")}>Changer d’adresse</button>
    </div>
  );
  return (
    <div className="onboard">
      <h1>Connexion</h1>
      <p>Entrez votre adresse e-mail : vous recevrez un code pour vous connecter, sans mot de passe.</p>
      <div className="field"><label htmlFor="email">Adresse e-mail</label>
        <input id="email" className="inp" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} /></div>
      <button type="button" className="btn primary wide block" disabled={busy} onClick={send}>Recevoir un code</button>
    </div>
  );
}

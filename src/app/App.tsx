import { useEffect } from "react";
import { useIsRestoring, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { useBabies, useHousehold } from "@/babies/api";
import { FirstBaby, Loading, NotConfigured, NotMember } from "@/features/auth/Gates";
import { LoginPage } from "@/features/auth/LoginPage";
import { useSession } from "@/lib/auth";
import { isConfigured } from "@/lib/supabase";
import { OverlayProvider } from "@/ui/Overlay";
import { AppProvider } from "./AppContext";
import { Shell } from "./Shell";

function Household({ email, userId }: { email: string; userId: string }) {
  const household = useHousehold(true);
  const babies = useBabies(household.data ?? undefined);
  if (household.isLoading) return <Loading text="Connexion…" />;
  if (household.isError) return <Loading text="La base ne répond pas. Vérifiez votre connexion." />;
  if (!household.data) return <div className="wrap"><NotMember email={email} /></div>;
  if (babies.isLoading) return <Loading />;
  if (!babies.data?.length) return <div className="wrap"><FirstBaby householdId={household.data} /></div>;
  return (
    <AppProvider email={email} userId={userId} householdId={household.data}>
      {/* Les feuilles ont besoin des données de l’enfant : elles sont rendues à l’intérieur du contexte. */}
      <OverlayProvider>
        <Shell />
      </OverlayProvider>
    </AppProvider>
  );
}

export function App() {
  const session = useSession();
  const qc = useQueryClient();
  const restoring = useIsRestoring();
  // Déconnexion : on efface les données gardées sur le téléphone.
  useEffect(() => { if (session === null && !restoring) qc.clear(); }, [session, restoring, qc]);
  if (!isConfigured) return <div className="wrap"><NotConfigured /></div>;
  if (session === undefined) return <Loading />;
  if (!session) return <div className="wrap"><LoginPage /></div>;
  return (
    <BrowserRouter>
      <Household key={session.user.id} email={session.user.email ?? ""} userId={session.user.id} />
    </BrowserRouter>
  );
}

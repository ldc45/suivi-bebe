import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/** Session Supabase courante ; undefined pendant le chargement initial. */
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

/**
 * Connexion par e-mail et mot de passe.
 * Prérequis Supabase : Authentication > Sign In / Providers > Email, option « Confirm email » désactivée,
 * pour que la création du compte connecte immédiatement sans e-mail de confirmation.
 * L’accès aux données reste limité aux adresses de la table household_members (règles RLS).
 */
export const signIn = (email: string, password: string) => supabase.auth.signInWithPassword({ email, password });
export const signUp = (email: string, password: string) => supabase.auth.signUp({ email, password });
export const signOut = () => supabase.auth.signOut();

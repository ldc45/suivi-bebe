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

export const sendCode = (email: string) => supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
export const verifyCode = (email: string, token: string) => supabase.auth.verifyOtp({ email, token, type: "email" });
export const signOut = () => supabase.auth.signOut();

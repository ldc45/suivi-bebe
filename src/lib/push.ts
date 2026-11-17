/**
 * Notifications sur ce téléphone : abonnement, préférences, désabonnement.
 * L’envoi est fait par la fonction Supabase « notifier » (supabase/functions/notifier).
 */
import { supabase } from "./supabase";

export interface PushPrefs { bottle: boolean; other: "all" | "important" | "none" }
export const DEFAULT_PREFS: PushPrefs = { bottle: true, other: "all" };

export type PushSupport = "ok" | "ios-install" | "unsupported";

/** Sur iPhone, les notifications ne marchent que si l’appli est installée sur l’écran d’accueil (iOS 16.4+). */
export function pushSupport(): PushSupport {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (ios && !standalone) return "ios-install";
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window ? "ok" : "unsupported";
}

const b64ToBytes = (b64: string) => {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

async function registration() {
  return navigator.serviceWorker.ready;
}

/** Abonnement actuel de ce téléphone et ses préférences enregistrées (null si non abonné). */
export async function currentSubscription(): Promise<{ endpoint: string; prefs: PushPrefs } | null> {
  if (pushSupport() !== "ok" || Notification.permission !== "granted") return null;
  const sub = await (await registration()).pushManager.getSubscription();
  if (!sub) return null;
  const { data } = await supabase.from("push_subscriptions").select("prefs").eq("endpoint", sub.endpoint).maybeSingle();
  if (!data) return null;
  return { endpoint: sub.endpoint, prefs: { ...DEFAULT_PREFS, ...(data.prefs as Partial<PushPrefs>) } };
}

/** Demande l’autorisation, abonne ce téléphone et l’enregistre. Renvoie un message d’erreur, ou null. */
export async function enablePush(householdId: string, prefs: PushPrefs = DEFAULT_PREFS): Promise<string | null> {
  if (pushSupport() !== "ok") return "Les notifications ne sont pas disponibles sur ce téléphone.";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "Notifications refusées. Autorisez-les dans les réglages du téléphone pour cette appli, puis réessayez.";
  const { data, error } = await supabase.functions.invoke("notifier", { method: "GET" });
  const publicKey = (data as { publicKey?: string } | null)?.publicKey;
  if (error || !publicKey) return "Les notifications ne sont pas encore installées côté serveur (fonction « notifier » de Supabase).";
  const reg = await registration();
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error: saveError } = await supabase.from("push_subscriptions").upsert(
    { household_id: householdId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, prefs },
    { onConflict: "endpoint" },
  );
  return saveError ? "Enregistrement impossible. Vérifiez la connexion, puis réessayez." : null;
}

export async function savePushPrefs(endpoint: string, prefs: PushPrefs): Promise<boolean> {
  const { error } = await supabase.from("push_subscriptions").update({ prefs }).eq("endpoint", endpoint);
  return !error;
}

export async function disablePush(): Promise<void> {
  if (pushSupport() !== "ok") return;
  const sub = await (await registration()).pushManager.getSubscription();
  if (!sub) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

/**
 * Fonction Supabase « notifier » : notifications de l'appli Suivi bébé.
 *
 * - GET : renvoie la clé publique des notifications (créée automatiquement au premier appel).
 * - POST d'un « Database Webhook » sur la table entries (INSERT, UPDATE) : prévient les autres
 *   membres du foyer de ce qu'un parent vient de noter.
 * - POST {"kind":"tick"} chaque minute (Supabase Cron) : rappels des biberons préparés.
 *
 * Les POST ne sont acceptés que de Supabase lui-même (clé « service_role » ou en-tête x-notifier-secret).
 * Contenu des messages : notify.ts (testé dans le dépôt).
 */
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { type BabyInfo, bottleReminder, type EntryRow, entryMessage, isNight, type Message, type Prefs, type ReminderKind, wants } from "./notify.ts";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("NOTIFIER_SECRET");
const db = createClient(URL_, SERVICE_KEY, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

/** Appel venu de Supabase (webhook, cron) et non d'un téléphone. */
function trusted(req: Request): boolean {
  if (SECRET && req.headers.get("x-notifier-secret") === SECRET) return true;
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  if (token === SERVICE_KEY) return true;
  // La passerelle de Supabase a déjà vérifié la signature du jeton (vérification JWT activée).
  try { return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role === "service_role"; } catch { return false; }
}

/** Clés VAPID, créées une fois et gardées dans la table push_config (invisible depuis l'appli). */
async function keys(): Promise<{ public_key: string; private_key: string }> {
  const { data } = await db.from("push_config").select("public_key, private_key").eq("id", 1).maybeSingle();
  if (data) return data;
  const k = webpush.generateVAPIDKeys();
  await db.from("push_config").upsert({ id: 1, public_key: k.publicKey, private_key: k.privateKey }, { onConflict: "id", ignoreDuplicates: true });
  const { data: again } = await db.from("push_config").select("public_key, private_key").eq("id", 1).single();
  return again!;
}

async function babyInfo(babyId: string): Promise<(BabyInfo & { household_id: string }) | null> {
  const { data } = await db.from("babies").select("name, sex, household_id, settings").eq("id", babyId).maybeSingle();
  if (!data) return null;
  const t = (data.settings?.thresholds ?? {}) as Record<string, number>;
  return { name: data.name, sex: data.sex, household_id: data.household_id, fever: t.fever || 38, prepRoomMin: t.prepRoomMin || 60, prepWarmMin: t.prepWarmMin || 30 };
}

async function authorName(householdId: string, userId: string | null): Promise<string> {
  if (!userId) return "l'autre parent";
  const { data } = await db.from("household_members").select("display_name").eq("household_id", householdId).eq("user_id", userId).maybeSingle();
  return data?.display_name || "l'autre parent";
}

interface Sub { id: string; user_id: string; endpoint: string; p256dh: string; auth: string; prefs: Prefs }

async function send(subs: Sub[], msg: Message, now: number) {
  const k = await keys();
  webpush.setVapidDetails(URL_, k.public_key, k.private_key);
  const payload = JSON.stringify({ title: msg.title, body: msg.body, tag: msg.tag, silent: isNight(now) && !msg.important, url: "/" });
  let sent = 0;
  await Promise.all(subs.filter((s) => wants(s.prefs, msg)).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: msg.category === "bottle" ? 1800 : 3600, urgency: msg.important ? "high" : "normal" });
      sent++;
    } catch (err) {
      // Abonnement expiré ou désinstallé : on l'oublie.
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
      else console.error("envoi impossible", code, (err as Error).message);
    }
  }));
  return sent;
}

async function onEntry(record: EntryRow, old: EntryRow | null) {
  const baby = await babyInfo(record.baby_id);
  if (!baby) return { sent: 0 };
  const msg = entryMessage(record, old, baby, await authorName(baby.household_id, record.created_by));
  if (!msg) return { sent: 0 };
  const { data } = await db.from("push_subscriptions").select("*").eq("household_id", baby.household_id);
  // Jamais de notification pour ce qu'on a fait soi-même.
  const others = ((data ?? []) as Sub[]).filter((s) => s.user_id !== record.created_by);
  return { sent: await send(others, msg, Date.now()) };
}

async function onTick() {
  const now = Date.now();
  const { data: bottles } = await db.from("entries").select("*").eq("type", "bottle").eq("in_progress", true)
    .gte("started_at", new Date(now - 24 * 3600_000).toISOString());
  if (!bottles?.length) return { sent: 0 };
  const { data: log } = await db.from("push_sent").select("entry_id, kind").in("entry_id", bottles.map((b) => b.id));
  let sent = 0;
  for (const e of bottles as EntryRow[]) {
    const baby = await babyInfo(e.baby_id);
    if (!baby) continue;
    const done = new Set((log ?? []).filter((l) => l.entry_id === e.id).map((l) => l.kind as ReminderKind));
    const r = bottleReminder(e, baby, done, now);
    if (!r) continue;
    // On inscrit le rappel avant de l'envoyer : deux passages simultanés ne l'enverront pas deux fois.
    const { error } = await db.from("push_sent").insert({ entry_id: e.id, kind: r.kind });
    if (error) continue;
    const { data: subs } = await db.from("push_subscriptions").select("*").eq("household_id", baby.household_id);
    sent += await send((subs ?? []) as Sub[], r.msg, now);
  }
  return { sent };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (req.method === "GET") return json({ publicKey: (await keys()).public_key });
    if (req.method !== "POST") return json({ error: "méthode non prise en charge" }, 405);
    if (!trusted(req)) return json({ error: "réservé à Supabase" }, 401);
    const body = await req.json().catch(() => ({}));
    if (body.kind === "tick") return json(await onTick());
    if (body.table === "entries" && (body.type === "INSERT" || body.type === "UPDATE") && body.record) {
      return json(await onEntry(body.record, body.type === "UPDATE" ? body.old_record ?? null : null));
    }
    return json({ ignored: true });
  } catch (err) {
    console.error(err);
    return json({ error: "erreur interne" }, 500);
  }
});

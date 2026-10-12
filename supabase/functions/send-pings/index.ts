// Called every minute by pg_cron. Claims the checklist items that are
// due (or due a 15-minute repeat), groups them per user so a busy
// minute is one notification instead of several, and sends Web Push to
// each of that user's devices. Subscriptions the push service reports
// as gone (404/410) are deleted.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CRON_SECRET = Deno.env.get("CRON_SECRET");

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT")!,
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

type DuePing = {
  user_id: string;
  item_id: string;
  title: string;
  body: string | null;
  due_at: string;
  send_count: number;
};

function buildPayload(items: DuePing[]) {
  if (items.length === 1) {
    const [item] = items;
    return {
      title: item.send_count > 1 ? `Still to do: ${item.title}` : item.title,
      body: item.body ?? "Tap to check it off.",
      tag: item.item_id,
    };
  }
  return {
    title: `${items.length} things due`,
    body: items.map((i) => i.title).join(" · "),
    tag: "batch",
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return json({ error: "forbidden" }, 403);
  }

  const { data: due, error } = await db.rpc("claim_due_pings");
  if (error) return json({ error: error.message }, 500);
  if (!due?.length) return json({ items: 0, sent: 0 });

  const byUser = new Map<string, DuePing[]>();
  for (const ping of due as DuePing[]) {
    byUser.set(ping.user_id, [...(byUser.get(ping.user_id) ?? []), ping]);
  }

  const { data: subs, error: subsError } = await db
    .from("push_subscriptions")
    .select("endpoint, user_id, p256dh, auth")
    .in("user_id", [...byUser.keys()]);
  if (subsError) return json({ error: subsError.message }, 500);

  let sent = 0;
  const failures: string[] = [];
  await Promise.all((subs ?? []).map(async (sub) => {
    const payload = JSON.stringify({ ...buildPayload(byUser.get(sub.user_id)!), url: "./" });
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 900, urgency: "high" },
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
      failures.push(`${status ?? "?"}: ${(err as Error).message}`);
    }
  }));

  return json({ items: due.length, sent, failures });
});

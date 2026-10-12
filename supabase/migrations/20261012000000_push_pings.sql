-- Push reminders. The app owns the schedule (coach-core.js), so it
-- writes the next week of checklist items into ping_queue with their
-- done/skipped status. The send-pings Edge Function, run by pg_cron
-- every minute, claims the rows that are due and sends Web Push to
-- that user's subscribed devices. Users are anonymous Supabase auth
-- users - one per installed app - so RLS keeps each one's rows private.

create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table public.ping_queue (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  item_id text not null,
  title text not null,
  body text,
  due_at timestamptz not null,
  -- Last moment a ping (or repeat) may go out: due + 60 min, cut off
  -- at the 10:45 PM quiet-hours start. Computed by the app.
  stop_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'skipped')),
  last_sent_at timestamptz,
  send_count int not null default 0,
  primary key (user_id, day, item_id)
);

create index ping_queue_pending_due on public.ping_queue (due_at) where status = 'pending';

alter table public.push_subscriptions enable row level security;
alter table public.ping_queue enable row level security;

create policy "own subscriptions" on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own pings" on public.ping_queue
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- A device's endpoint can outlive the anonymous account that first
-- saved it (e.g. app storage cleared, new sign-in), so re-saving moves
-- it to the current user instead of failing on the other user's row.
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;

revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- Replaces the caller's queue for [p_from, p_to] with p_rows: items
-- removed from the day are dropped, the rest are upserted. Repeat
-- tracking survives a re-sync unless the item's time moved. Test pings
-- (item_id 'test-...') are left alone, and week-old rows are pruned.
create function public.sync_ping_queue(p_from date, p_to date, p_rows jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.ping_queue q
  where q.user_id = auth.uid()
    and (
      q.day < p_from - 7
      or (
        q.day between p_from and p_to
        and q.item_id not like 'test-%'
        and not exists (
          select 1 from jsonb_to_recordset(p_rows) as r(day date, item_id text)
          where r.day = q.day and r.item_id = q.item_id
        )
      )
    );

  insert into public.ping_queue as pq (user_id, day, item_id, title, body, due_at, stop_at, status)
  select auth.uid(), r.day, r.item_id, r.title, r.body, r.due_at, r.stop_at, r.status
  from jsonb_to_recordset(p_rows) as r(
    day date, item_id text, title text, body text, due_at timestamptz, stop_at timestamptz, status text
  )
  on conflict (user_id, day, item_id) do update set
    title = excluded.title,
    body = excluded.body,
    status = excluded.status,
    last_sent_at = case when pq.due_at = excluded.due_at then pq.last_sent_at end,
    send_count = case when pq.due_at = excluded.due_at then pq.send_count else 0 end,
    due_at = excluded.due_at,
    stop_at = excluded.stop_at;
end;
$$;

revoke execute on function public.sync_ping_queue(date, date, jsonb) from public, anon;
grant execute on function public.sync_ping_queue(date, date, jsonb) to authenticated;

-- Called only by send-pings (service role). Marks every pending row
-- that's due - first ping, or 15 min since the last one - as sent now,
-- and returns them. The 30 s slack keeps a once-a-minute cron from
-- drifting each repeat to 16 minutes.
create function public.claim_due_pings()
returns table (user_id uuid, item_id text, title text, body text, due_at timestamptz, send_count int)
language sql
security definer
set search_path = ''
as $$
  with due as (
    select q.user_id, q.day, q.item_id
    from public.ping_queue q
    where q.status = 'pending'
      and q.due_at <= now()
      and q.stop_at > now()
      and (q.last_sent_at is null or q.last_sent_at <= now() - interval '14 minutes 30 seconds')
    for update skip locked
  )
  update public.ping_queue q
  set last_sent_at = now(), send_count = q.send_count + 1
  from due
  where q.user_id = due.user_id and q.day = due.day and q.item_id = due.item_id
  returning q.user_id, q.item_id, q.title, q.body, q.due_at, q.send_count;
$$;

revoke execute on function public.claim_due_pings() from public, anon, authenticated;
grant execute on function public.claim_due_pings() to service_role;

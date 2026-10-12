-- Runs send-pings every minute. The function is deployed without JWT
-- verification, so it checks an x-cron-secret header instead; the
-- secret lives in Vault (name 'cron_secret') and in the function's
-- CRON_SECRET env var, and is never committed. Create it once with:
--   select vault.create_secret('<secret>', 'cron_secret');

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'send-pings',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://inewcgtwhuwjmiyxlrvy.supabase.co/functions/v1/send-pings',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);

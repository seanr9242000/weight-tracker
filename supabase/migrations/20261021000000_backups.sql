-- Cloud backup (feedback batch 1, step 0). The app uploads its
-- localStorage data under a restore code Sean keeps in Notes. Rows are
-- keyed by the code's hash, not by user: reinstalling the app creates a
-- new anonymous user, and the code is how the new install finds the old
-- data. RLS is on with no policies, so these two functions are the only
-- way in, and only for someone who has the code.

create table public.backups (
  code_hash text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  -- One generation back: a last-writer-wins accident (an old copy uploading
  -- over a newer one) becomes recoverable with SQL.
  previous_data jsonb,
  previous_updated_at timestamptz
);

alter table public.backups enable row level security;
revoke all on public.backups from anon, authenticated;

create function public.save_backup(p_code text, p_data jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_code !~ '^WS-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$' then
    raise exception 'bad restore code';
  end if;
  if octet_length(p_data::text) > 5000000 then
    raise exception 'backup too large';
  end if;
  insert into public.backups (code_hash, data, updated_at)
  values (encode(sha256(convert_to(p_code, 'UTF8')), 'hex'), p_data, v_at)
  on conflict (code_hash) do update
    set previous_data = public.backups.data,
        previous_updated_at = public.backups.updated_at,
        data = excluded.data,
        updated_at = excluded.updated_at;
  return v_at;
end;
$$;

create function public.load_backup(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  return (
    select b.data from public.backups b
    where b.code_hash = encode(sha256(convert_to(p_code, 'UTF8')), 'hex')
  );
end;
$$;

revoke execute on function public.save_backup(text, jsonb) from public, anon;
grant execute on function public.save_backup(text, jsonb) to authenticated;
revoke execute on function public.load_backup(text) from public, anon;
grant execute on function public.load_backup(text) to authenticated;

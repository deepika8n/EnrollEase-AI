begin;
create table if not exists public.email_deliveries (
  event_key text primary key,
  payload jsonb not null,
  status text not null check (status in ('sending', 'sent', 'retry', 'uncertain')),
  attempts integer not null default 1,
  next_attempt_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_error text
);
alter table public.email_deliveries enable row level security;
revoke all on public.email_deliveries from public, anon, authenticated;
grant all on public.email_deliveries to service_role;

create or replace function public.claim_email_delivery(p_key text, p_payload jsonb)
returns text language plpgsql security definer set search_path = pg_catalog as $$
declare claimed text; current_status text;
begin
  insert into public.email_deliveries(event_key, payload, status)
  values(p_key, p_payload, 'sending')
  on conflict(event_key) do update set status='sending', attempts=public.email_deliveries.attempts+1,
    updated_at=now(), payload=excluded.payload
  where (public.email_deliveries.status='retry' and public.email_deliveries.next_attempt_at <= now())
    or (p_key like 'content:%' and public.email_deliveries.status='sent' and public.email_deliveries.updated_at < now() - interval '5 minutes')
  returning event_key into claimed;
  if claimed is not null then return 'claimed'; end if;
  select status into current_status from public.email_deliveries where event_key=p_key;
  return coalesce(current_status, 'busy');
end $$;
revoke all on function public.claim_email_delivery(text,jsonb) from public, anon, authenticated;
grant execute on function public.claim_email_delivery(text,jsonb) to service_role;
commit;

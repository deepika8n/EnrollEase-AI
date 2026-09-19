-- Identify each payment receipt independently, including multiple payments on one day.
alter table public.email_logs add column if not exists event_key text;
create index if not exists email_logs_event_key_idx on public.email_logs (event_key)
  where event_key is not null;

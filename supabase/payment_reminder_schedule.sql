-- Deploy automation-dispatch with AUTOMATION_PAYMENT_REMINDERS_ONLY=true first.
-- Vault must contain enrollease_project_url and enrollease_automation_dispatch_secret.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.call_payment_reminders()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  project_url text;
  dispatch_secret text;
  request_id bigint;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets
    where name = 'enrollease_project_url';
  select decrypted_secret into dispatch_secret from vault.decrypted_secrets
    where name = 'enrollease_automation_dispatch_secret';
  if project_url is null or dispatch_secret is null then
    raise exception 'Payment reminder Vault configuration is missing';
  end if;
  select net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/automation-dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-automation-dispatch-secret', dispatch_secret),
    body := jsonb_build_object('source', 'supabase_cron', 'triggerType', 'payment_due'),
    timeout_milliseconds := 120000
  ) into request_id;
  return request_id;
end;
$$;
revoke all on function private.call_payment_reminders() from public, anon, authenticated;

do $$
declare reminder_job bigint;
begin
  for reminder_job in select jobid from cron.job
    where jobname = 'enrollease-payment-due-check'
  loop
    perform cron.unschedule(reminder_job);
  end loop;
end;
$$;

select cron.schedule('enrollease-payment-due-check', '*/5 * * * *',
  'select private.call_payment_reminders();');
commit;

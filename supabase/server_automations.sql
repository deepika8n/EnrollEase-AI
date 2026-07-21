create extension if not exists pg_cron;
create extension if not exists pg_net;

create schema if not exists private;

create table if not exists private.automation_config (
  id boolean primary key default true check (id),
  edge_function_url text not null,
  automation_dispatch_secret text not null,
  updated_at timestamptz not null default now()
);

insert into private.automation_config (
  id,
  edge_function_url,
  automation_dispatch_secret
)
values (
  true,
  'https://tahjvrzekccdlekxrrgp.supabase.co/functions/v1/automation-dispatch',
  'REPLACE_WITH_AUTOMATION_DISPATCH_SECRET'
)
on conflict (id) do update
set
  edge_function_url = excluded.edge_function_url,
  automation_dispatch_secret = excluded.automation_dispatch_secret,
  updated_at = now();

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

revoke all on table private.automation_config from public;
revoke all on table private.automation_config from anon;
revoke all on table private.automation_config from authenticated;

create or replace function private.call_automation_dispatch(
  p_job_name text,
  p_trigger_type text
)
returns bigint
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_edge_function_url text;
  v_automation_dispatch_secret text;
  v_request_id bigint;
begin
  select
    edge_function_url,
    automation_dispatch_secret
  into
    v_edge_function_url,
    v_automation_dispatch_secret
  from private.automation_config
  where id = true;

  if v_edge_function_url is null or btrim(v_edge_function_url) = '' then
    raise exception 'private.automation_config.edge_function_url is missing';
  end if;

  if v_automation_dispatch_secret is null or btrim(v_automation_dispatch_secret) = '' then
    raise exception 'private.automation_config.automation_dispatch_secret is missing';
  end if;

  if v_automation_dispatch_secret = 'REPLACE_WITH_AUTOMATION_DISPATCH_SECRET' then
    raise exception 'Replace REPLACE_WITH_AUTOMATION_DISPATCH_SECRET before scheduling automations';
  end if;

  select
    net.http_post(
      url := v_edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-automation-dispatch-secret', v_automation_dispatch_secret
      ),
      body := jsonb_build_object(
        'source', 'supabase_cron',
        'jobName', p_job_name,
        'triggerType', p_trigger_type,
        'scheduledAt', now()
      ),
      timeout_milliseconds := 15000
    )
  into v_request_id;

  return v_request_id;
end;
$$;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid
    from cron.job
    where jobname in (
      'enrollease-automation-dispatch',
      'enrollease-follow-up-check',
      'enrollease-payment-due-check'
    )
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end $$;

select
  cron.schedule(
    'enrollease-follow-up-check',
    '* * * * *',
    $$select private.call_automation_dispatch('enrollease-follow-up-check', 'follow_up');$$
  );

select
  cron.schedule(
    'enrollease-payment-due-check',
    '* * * * *',
    $$select private.call_automation_dispatch('enrollease-payment-due-check', 'payment_due');$$
  );

# Supabase Server Automations

This setup moves due email checks out of the browser and into Supabase so follow-up and payment mails can run even when the EnrollEase portal is closed.

## What this covers

- Admission follow-up due checks
- Admission confirmation email checks
- Payment update email checks
- EMI due reminder checks

The generic profile email remains a user-triggered action.

## Files added

- `supabase/functions/automation-dispatch/index.ts`
- `supabase/config.toml`
- `supabase/server_automations.sql`

## Required secrets

Set these in the Supabase Edge Functions secrets UI or with the CLI:

- `N8N_WEBHOOK_URL`
- `N8N_WEBHOOK_SECRET`
- `AUTOMATION_DISPATCH_SECRET`

Notes:

- `N8N_WEBHOOK_URL` must be a public HTTPS webhook for server-side use. A local value like `http://localhost:5678/...` works only from your browser, not from Supabase cloud.
- `AUTOMATION_DISPATCH_SECRET` should be a long random string used only between `pg_cron` and the Edge Function.

## Deploy steps

1. Deploy the Edge Function:

```bash
supabase functions deploy automation-dispatch
```

2. Store these Vault values in Supabase SQL Editor:

```sql
select vault.create_secret('https://YOUR_PROJECT.supabase.co', 'enrollease_project_url');
select vault.create_secret('replace-with-the-same-automation-dispatch-secret', 'enrollease_automation_dispatch_secret');
```

If the Vault secrets already exist, update them instead:

```sql
select vault.update_secret(
  id,
  'new-secret-value',
  name,
  description
)
from vault.decrypted_secrets
where name = 'enrollease_automation_dispatch_secret';
```

3. Run [`supabase/server_automations.sql`](C:/Users/deepi/OneDrive/Desktop/EnrollEase%20AI/supabase/server_automations.sql) in Supabase SQL Editor.

4. After the function is deployed and the cron job is active, enable browser-side suppression in your app environment:

```env
VITE_SERVER_SIDE_AUTOMATIONS=true
```

## How dispatching works

- The cron job calls the `automation-dispatch` Edge Function every minute.
- The function loads students, courses, enrollments, and `email_logs`.
- It calculates which emails are due and sends the same n8n email payload shape the frontend already uses.
- Successful dispatches insert into `email_logs`.
- Follow-up sends also advance `enrollments.follow_up_date` to the next cycle date.

## Verifying the rollout

1. Confirm the function responds:

```bash
curl -i https://YOUR_PROJECT.supabase.co/functions/v1/automation-dispatch
```

Expected without the secret header: `401`.

2. Check cron jobs:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'enrollease-automation-dispatch';
```

3. Check cron run results:

```sql
select *
from cron.job_run_details
where jobid in (
  select jobid from cron.job where jobname = 'enrollease-automation-dispatch'
)
order by start_time desc
limit 20;
```

4. Check failed HTTP calls:

```sql
select *
from net._http_response
where status_code >= 400 or error_msg is not null
order by created desc
limit 20;
```

## Browser behavior after rollout

When `VITE_SERVER_SIDE_AUTOMATIONS=true` and Supabase mode is enabled:

- automatic browser follow-up sends are skipped
- automatic browser EMI reminder sends are skipped
- automatic browser admission confirmation sends are skipped
- automatic browser payment update sends are skipped

Manual send actions still work from the UI.

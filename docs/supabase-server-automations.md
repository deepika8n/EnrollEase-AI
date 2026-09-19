# Supabase unattended email setup

The supported scheduler is the single five-minute job in `supabase/payment_reminder_schedule.sql`. It calls `automation-dispatch` using project URL and dispatch secret stored in Supabase Vault. Never expose the dispatch secret in the browser or install the two overlapping jobs from the legacy server_automations.sql.

## Backend

Apply schema and incremental migrations `email_automation_events.sql` and `email_delivery_guards.sql`. The delivery table is inaccessible to anonymous/authenticated clients; server service-role access controls claims and retries. Configure the existing SMTP/Resend transport and `AUTOMATION_DISPATCH_SECRET` as server secrets. Vault entries are `enrollease_project_url` and `enrollease_automation_dispatch_secret`.

Deploy mailer, public-enquiry, student-intake and automation-dispatch whenever their shared sender changes. Deploy ai-copilot separately for authenticated AI requests.

## Safe rollout order

1. Leave server `AUTOMATION_PAYMENT_REMINDERS_ONLY=true` during migration. `AUTOMATION_PAYMENT_RECEIPTS_ENABLED=true` independently enables new recorded-payment receipts during this stage; legacy opening balances are not backfilled.
2. Call the dispatcher with the private `x-automation-dispatch-secret` header and JSON `{ "dryRun": true, "scope": "all" }`. Inspect failures and pending actions; this must not send emails or change records.
3. Deploy the frontend with `VITE_SERVER_SIDE_AUTOMATIONS=true` and `VITE_SERVER_SIDE_PAYMENT_REMINDERS=true` to suppress browser-owned routine automation.
4. Verify the deployed frontend, then set `AUTOMATION_PAYMENT_REMINDERS_ONLY=false` on Supabase.
5. Check cron execution, dispatcher results and email logs. A 200 response alone does not prove all emails arrived.

Send Mail and Send Confirmation stay manual. Full mode includes existing day-three/day-six follow-up and day-seven enquiry-dropout rules. AI custom campaigns have no autonomous schedule.

Known provider failures enter a durable retry queue. Ambiguous outcomes remain uncertain/sending for review against provider evidence; do not reset these blindly. Payment receipt keys identify transactions, daily keys suppress repeated reminders/follow-ups, and identical generic messages have a five-minute suppression window.

Current rollout state and limitations: [email audit](email-automation-audit.md), [validation report](validation-report.md).


Historical notification protection: `AUTOMATION_NOTIFICATION_START_AT=2026-09-12T18:05:21.408Z` is a fixed event cutoff. The dispatcher does not backfill old enquiry acknowledgements, submission notices or payment receipts based only on missing logs. New recorded payments on existing enrollments remain eligible. Do not advance this cutoff on redeployment; newer failed notifications must remain recoverable. Scheduled due reminders and follow-ups retain their normal rules.

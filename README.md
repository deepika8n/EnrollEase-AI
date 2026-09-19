# EnrollEase AI

Student admissions portal built with React, Vite, Tailwind CSS and Supabase. It manages enquiries, secure student intake, enrollments, documents, payments, PDFs, email communication and AI-assisted admissions review.

Existing production site: https://enroll-ease-ai.vercel.app

## Run locally

Use Node.js 24 and npm. Create an ignored `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the project. These are public client configuration; never put service-role, email-provider or AI secrets in `VITE_` variables.

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Without Supabase configuration, the application supports its local/sample-data mode. Production uses Supabase Auth, PostgreSQL, Storage and Edge Functions. Authenticated portal access is implemented; separate Admin/Staff/Student database permission levels are not claimed.

## Enrollment and payments

Public enquiry creates a lead. A token-protected intake link lets the student submit enrollment details. The portal provides records, profiles, search, course/batch management, document uploads and enrollment PDF generation.

Use **Record Payment** from the payment tracker or student profile. Enter the amount actually received, payment date and method, then save. The application preserves payment history and records the entry timestamp. Dates and amounts are validated. A remote save fetches current history and guards the previous balance to reject conflicting updates.

Installment counts represent actual payment transactions. An initial payment counts as one. If two payments have been received but money remains, a two-installment plan extends to **2/3**. A further partial payment extends it to **3/4**. Full settlement clears the next due date and remaining installments. A partially paid one-time plan becomes EMI. The student profile and payment tracker use the same calculation.

## Email operation

**Send Mail** and **Send Confirmation** in Student Records/profile remain manual. Routine lifecycle messages cover enquiry acknowledgement, admin notices, follow-ups, submitted-intake notices, payment receipts/completion and due reminders. AI-generated custom campaigns still require an operator action.

A single Supabase cron job runs every five minutes without an open browser. Database delivery claims prevent concurrent duplicate sends; payment receipts have separate transaction keys. Known provider rejections can retry. Ambiguous SMTP outcomes are held for review, because retrying an unconfirmed send can duplicate a delivered message.

**Current rollout:** the new frontend is deployed and full server lifecycle scheduling is active. Production uses `VITE_SERVER_SIDE_AUTOMATIONS=true`, `VITE_SERVER_SIDE_PAYMENT_REMINDERS=true`, and server `AUTOMATION_PAYMENT_REMINDERS_ONLY=false`.

See [server setup](docs/supabase-server-automations.md) and [email audit](docs/email-automation-audit.md).

## AI assistant

The browser invokes the authenticated `ai-copilot` Edge Function. Provider credentials belong in Supabase secrets (`GEMINI_API_KEY` or `AI_API_KEY`; optional `GEMINI_MODEL`/`AI_MODEL`). They are no longer read from client-side environment variables. Server credentials have been provisioned with user approval; the new browser bundle contains no configured AI key. The new production bundle removes the previous key. Provider-key rotation remains required because older copies may still exist. Local guidance remains available when the remote AI service cannot respond. Generated action plans require operator review/execution.

## Validation and deployment

`npm test` runs workflow tests using Node's test runner with mocked external delivery. Tests include payments, concurrency, date validation, intake, scheduling, duplicate protection, follow-up retry tokens, CSV parsing and PDF content generation. `npm run build` produces `dist/`; Vercel uses the repository's SPA routing configuration. Link/deploy to the existing `enroll-ease-ai` project, not a new project.

See [validation report](docs/validation-report.md) for current evidence and limitations. Mock validation created no live student payments or test emails. Separately, the user-requested missing receipt was delivered and a stale installment summary was corrected; see the validation report. Browser interaction and inbox delivery are separate checks and are not implied by a successful build.

## Viva documentation

- [Questions and answers](exam%20viva/EnrollEase_AI_Viva_Questions.md)
- [Demonstration checklist](exam%20viva/Demo_Checklist.md)

Database setup is in `supabase/schema.sql`; incremental email tracking and delivery-guard migrations are in `supabase/email_automation_events.sql` and `supabase/email_delivery_guards.sql`. Scheduler setup is `supabase/payment_reminder_schedule.sql`; do not install overlapping legacy schedules.


## Production rollout completed

The updated frontend is live at https://enroll-ease-ai.vercel.app (deployment `dpl_Db2okjwhbz23XkwtH9c4qV12KKWM`). Vercel reported READY. Homepage, records and payments routes returned HTTP 200. The public bundle contains the new receipt workflow and authenticated AI endpoint, and no longer contains the configured AI key.

Production `VITE_SERVER_SIDE_AUTOMATIONS=true` and `VITE_SERVER_SIDE_PAYMENT_REMINDERS=true` are configured. Supabase `AUTOMATION_PAYMENT_REMINDERS_ONLY=false` activates full lifecycle scheduling through the existing five-minute cron job. Send Mail and Send Confirmation remain manual. A live full-mode dry run scanned nine enrollments without failures. Stale opening receipts are suppressed when a newer cumulative-payment receipt has already been sent.

All 53 automated tests pass. Interactive browser/visual verification and inbox placement remain separate, unverified checks. The previously exposed AI key still needs provider-side rotation, even though it is absent from the new public build.


Historical notification protection: `AUTOMATION_NOTIFICATION_START_AT=2026-09-12T18:05:21.408Z` is a fixed event cutoff. The dispatcher does not backfill old enquiry acknowledgements, submission notices or payment receipts based only on missing logs. New recorded payments on existing enrollments remain eligible. Do not advance this cutoff on redeployment; newer failed notifications must remain recoverable. Scheduled due reminders and follow-ups retain their normal rules.

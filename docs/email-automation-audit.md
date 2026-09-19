# Email automation audit - 12 September 2026

## Verified live state

- One active `enrollease-payment-due-check` cron job runs every five minutes.
- `AUTOMATION_PAYMENT_REMINDERS_ONLY=false` and `AUTOMATION_PAYMENT_RECEIPTS_ENABLED=true`: full lifecycle automation runs with the portal closed. Already acknowledged newer cumulative receipts suppress stale opening receipts.
- Full follow-up/lifecycle scheduling is active with the deployed frontend using `VITE_SERVER_SIDE_AUTOMATIONS=true`.
- Manual profile **Send Mail** and **Send Confirmation** remain manual in the prepared frontend. The server does not select automatic admission confirmations.

## Flow inventory

| Mail | Operation |
| --- | --- |
| Enquiry acknowledgement / admin new enquiry | Public submission sends immediately; full dispatcher covers missed notices for active enquiries. |
| Enrollment form invitation | Explicit form-send action, plus links included in scheduled follow-ups. |
| Admission follow-up | Full dispatcher supports day 3/day 6; submitted enquiries are excluded. Full live scheduling is active. |
| Intake submission / admin submission | Intake sends each independently after save; full dispatcher covers missed notices. |
| Payment received / cleared | Prepared payment save sends immediately; active server catches recorded transactions within five minutes. Each entry has its own delivery key. |
| EMI due reminder | Active server schedule with daily deduplication. |
| Profile update | Save-triggered notification; confirmed provider rejections use the shared queue. Wider retry processing requires full mode. |
| Send Mail / Send Confirmation | Manual buttons. |
| AI drafts / reactivation | Operator-reviewed action workflow; no autonomous campaign schedule. |

## Missing second-payment receipt investigation

The saved second transaction existed, but the payment form only sent a receipt when an unused opt-in flag was provided. The reminder-only server also excluded receipts. The corrected remote save always requests the receipt after successful persistence. Mail failure reports a warning without asking the operator to record the payment again.

For the user-reported record, the saved totals were verified: 20,000 received in the second transaction, 35,000 total paid, 17,000 remaining and 12 October 2026 next due. Its stale installment summary was corrected from 1/2 to 2/3 with a guarded update; neither payment amount was changed. A targeted dry run selected exactly one receipt. The authorized receipt was then accepted and recorded with one delivery attempt and one Sent log. This proves provider acceptance, not inbox placement.

## Duplicate protection and retries

The shared durable sender is deployed in mailer, public-enquiry, student-intake and automation-dispatch. `email_delivery_guards.sql` provides atomic database claims. Payment keys identify transactions; reminder/follow-up keys identify the enrollment and India-local day. Identical generic button requests share a five-minute suppression window. Follow-up counts ignore duplicate daily success logs.

Known provider rejections are retained for retry. Ambiguous transport results are held as uncertain; interrupted sends may remain sending. Review provider evidence before retrying these cases. Exactly-once SMTP delivery cannot be guaranteed. Successful payloads are cleared from the service-only delivery table.

Follow-up token metadata is persisted under the claim before transport and retained in retry payloads, preventing invalid links after a delayed send. Intake logs messages independently and continues if another notification fails.

## Completed rollout procedure

1. Sign into Vercel with access to the existing enroll-ease-ai project.
2. Deploy the updated frontend with server-side automation suppression enabled; verify the deployed build.
3. Dry-run full scope and inspect the existing seven-day enquiry-dropout transitions as well as pending mail.
4. Set `AUTOMATION_PAYMENT_REMINDERS_ONLY=false` only after frontend verification. Retain one cron job.
5. Review actual dispatcher failures and delivery logs; a successful HTTP response alone is insufficient.

See [validation report](validation-report.md) for test coverage and limitations.


## Production rollout completed

The updated frontend is live at https://enroll-ease-ai.vercel.app (deployment `dpl_Db2okjwhbz23XkwtH9c4qV12KKWM`). Vercel reported READY. Homepage, records and payments routes returned HTTP 200. The public bundle contains the new receipt workflow and authenticated AI endpoint, and no longer contains the configured AI key.

Production `VITE_SERVER_SIDE_AUTOMATIONS=true` and `VITE_SERVER_SIDE_PAYMENT_REMINDERS=true` are configured. Supabase `AUTOMATION_PAYMENT_REMINDERS_ONLY=false` activates full lifecycle scheduling through the existing five-minute cron job. Send Mail and Send Confirmation remain manual. A live full-mode dry run scanned nine enrollments without failures. Stale opening receipts are suppressed when a newer cumulative-payment receipt has already been sent.

All 53 automated tests pass. Interactive browser/visual verification and inbox placement remain separate, unverified checks. The previously exposed AI key still needs provider-side rotation, even though it is absent from the new public build.


Historical notification protection: `AUTOMATION_NOTIFICATION_START_AT=2026-09-12T18:05:21.408Z` is a fixed event cutoff. The dispatcher does not backfill old enquiry acknowledgements, submission notices or payment receipts based only on missing logs. New recorded payments on existing enrollments remain eligible. Do not advance this cutoff on redeployment; newer failed notifications must remain recoverable. Scheduled due reminders and follow-ups retain their normal rules.

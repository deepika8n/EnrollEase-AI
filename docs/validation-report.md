## Recheck: 19 September 2026

- All 83 automated tests pass; production frontend build passes. Coverage includes login restoration, stale-response cancellation, failed/empty loads, enquiry/dropout form links, intake validation, payment history, reminder deduplication, media loading, avatar cropping, profile patches, and email failure handling. External services are mocked in these tests.
- Fixed partial profile updates so omitted photos, documents and notes are preserved, and timeline-only edits do not blank student fields.
- Public enrollment submission now calls a single restricted database transaction for the student, enrollment and documents. It rechecks the token under a row lock, serializes student ID allocation, preserves existing IDs and prevents duplicate document inserts on competing submissions.
- Applied `supabase/transactional_student_intake.sql` and deployed the updated student-intake function. New installations must apply that SQL after the schema, discount-fields and media-preview migrations.
- Live rollback-only tests passed for token rejection, function access restrictions, complete rollback after a document failure, successful complete save, repeated submission and existing student ID preservation. The reusable check is `supabase/verify_transactional_intake.sql`; all fixtures are rolled back and no email is sent.
- Production REST schema checks accepted the student, enrollment, document and email-log payload columns (HTTP 200).
- Limits: this is not a guarantee of zero errors. No complete interactive browser journey, real inbox delivery, arbitrary uploaded-file compatibility or simultaneous real-user load test was performed in this recheck. The build still reports a large JavaScript chunk warning.

Earlier validation history follows; its counts and deployment IDs refer to earlier releases.

# Validation report - 12 September 2026

## Passed

- `npm test`: 53 tests passed, zero failures. Coverage includes payment validation/history/conflicts, automatic installment extension, immediate receipt requests, server receipt catch-up, targeted sends, due timing, duplicate delivery claims, retry handling, follow-up token persistence, manual mail exclusions, intake and calendar validation, CSV parsing, PDF content generation, AI authentication and mailer authentication.
- `npm run build`: passed with Vite 8.3.0. A large main-chunk warning remains (about 1.17 MB before gzip); this is a performance improvement opportunity, not a failed build.
- Dependency installation audited the full tree with zero vulnerabilities. Final `npm audit --omit=dev`: zero vulnerabilities. Updated jsPDF, Vite, React plugin and React Router, with lockfile changes.
- Configured AI key values are absent from every built JavaScript file. Provider secrets were provisioned in Supabase after explicit user approval.
- Backend deployments succeeded: mailer, public-enquiry, student-intake, automation-dispatch and ai-copilot. The intake bundle successfully includes shared frontend date/payment utility modules.
- Existing production homepage and records route return HTTP 200. This does not verify the new frontend build.
- Deployed AI and mailer endpoints reject anonymous access with HTTP 401; the dispatcher rejects a missing private secret with HTTP 401.
- A rollback-only live SQL claim test passed during this work session. The live scheduler has exactly one active five-minute job.
- User-requested payment correction and missing receipt: guarded installment-summary repair, one targeted preview, one accepted delivery, one persisted Sent log and one attempt. Payment amounts/history amounts were preserved. No synthetic student payments or test emails were sent to real recipients.

## Corrections

The payment save now fetches fresh history before its guarded write. Installment plans extend to match actual transactions and remaining balance. Impossible dates, invalid monetary precision, invalid installment counts and inconsistent intake due-date requirements are rejected/corrected. Failed follow-up deliveries retain valid form tokens. Routine receipts have an active server fallback, including when the portal is closed.

AI requests now go through an authenticated server endpoint. Manual mail also requires an authenticated user; the public project key alone cannot invoke delivery.

## Deployment and remaining validation limits

- New Vercel production deployment: completed; see the rollout record below.
- Full server lifecycle mode is active following production frontend verification.
- Interactive browser, visual PDF and end-to-end UI checks: no browser was available in the current tool session. PDF tests verify real jsPDF content generation while mocking logo rasterization; they are not visual inspection.
- Security follow-up: the previous public production JavaScript contained the old configured AI key. The new production build does not. Rotate the provider key and update the server secret; moving the same key server-side does not revoke exposed copies.
- Live AI generation and real recipient inbox placement are not verified. The requested receipt has provider acceptance and database confirmation only.
- Tests use mocked external services and do not establish unrestricted role-based authorization or exactly-once SMTP guarantees.

README, email setup/audit, viva answers and the demonstration checklist were updated to reflect these boundaries.


## Production rollout completed

The updated frontend is live at https://enroll-ease-ai.vercel.app (deployment `dpl_Db2okjwhbz23XkwtH9c4qV12KKWM`). Vercel reported READY. Homepage, records and payments routes returned HTTP 200. The public bundle contains the new receipt workflow and authenticated AI endpoint, and no longer contains the configured AI key.

Production `VITE_SERVER_SIDE_AUTOMATIONS=true` and `VITE_SERVER_SIDE_PAYMENT_REMINDERS=true` are configured. Supabase `AUTOMATION_PAYMENT_REMINDERS_ONLY=false` activates full lifecycle scheduling through the existing five-minute cron job. Send Mail and Send Confirmation remain manual. A live full-mode dry run scanned nine enrollments without failures. Stale opening receipts are suppressed when a newer cumulative-payment receipt has already been sent.

All 53 automated tests pass. Interactive browser/visual verification and inbox placement remain separate, unverified checks. The previously exposed AI key still needs provider-side rotation, even though it is absent from the new public build.


Historical notification protection: `AUTOMATION_NOTIFICATION_START_AT=2026-09-12T18:05:21.408Z` is a fixed event cutoff. The dispatcher does not backfill old enquiry acknowledgements, submission notices or payment receipts based only on missing logs. New recorded payments on existing enrollments remain eligible. Do not advance this cutoff on redeployment; newer failed notifications must remain recoverable. Scheduled due reminders and follow-ups retain their normal rules.

# Viva demonstration checklist

Use local/sample records or an explicitly designated test student. Do not demonstrate by modifying a real student's payment or sending them test emails.

1. Explain React/Vite frontend, Supabase Auth/database/storage/functions, and Vercel hosting.
2. Show enquiry, intake, records and the student profile.
3. Record an initial payment in a two-installment example. Explain 1/2.
4. Record a second partial payment. Show the preserved history, remaining balance and 2/3 count.
5. Record the final balance. Show Paid, no next due date and zero remaining installments.
6. Show validation of an invalid amount/date without saving.
7. Show Send Mail and Send Confirmation and explain that both require a manual action.
8. Explain the five-minute server scheduler and transaction/daily duplicate keys using the email audit. Full server lifecycle mode is active; Send Mail and Send Confirmation remain manual.
9. Generate a PDF and inspect it visually during the demonstration.
10. Explain AI server credentials and human-reviewed action plans.
11. Run npm test and npm run build. Refer to docs/validation-report.md for actual coverage and outstanding deployment checks.

Do not claim browser testing, inbox delivery, role-based authorization, or the new production deployment has been verified unless those checks are subsequently completed.


## Production rollout completed

The updated frontend is live at https://enroll-ease-ai.vercel.app (deployment `dpl_Db2okjwhbz23XkwtH9c4qV12KKWM`). Vercel reported READY. Homepage, records and payments routes returned HTTP 200. The public bundle contains the new receipt workflow and authenticated AI endpoint, and no longer contains the configured AI key.

Production `VITE_SERVER_SIDE_AUTOMATIONS=true` and `VITE_SERVER_SIDE_PAYMENT_REMINDERS=true` are configured. Supabase `AUTOMATION_PAYMENT_REMINDERS_ONLY=false` activates full lifecycle scheduling through the existing five-minute cron job. Send Mail and Send Confirmation remain manual. A live full-mode dry run scanned nine enrollments without failures. Stale opening receipts are suppressed when a newer cumulative-payment receipt has already been sent.

All 51 automated tests pass. Interactive browser/visual verification and inbox placement remain separate, unverified checks. The previously exposed AI key still needs provider-side rotation, even though it is absent from the new public build.

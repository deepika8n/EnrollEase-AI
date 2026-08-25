# EnrollEase AI

EnrollEase AI is an agentic student enrollment management and automation portal for institutes, academies, coaching centers, training providers, and colleges. It combines a modern React frontend with Supabase-ready backend integrations so teams can manage inquiry, enrollment, payments, PDF generation, communication, and AI-assisted workflow support from one place.

## Problem Statement

Educational organizations often manage admissions across forms, spreadsheets, phone calls, payments, and manual follow-ups. This creates missed follow-ups, scattered records, and confusion for students. EnrollEase AI solves that by centralizing the full enrollment flow and adding an AI agent that guides both students and admins.

## Features

- Role-based login experience for Admin, Staff, and Student
- Dashboard views for enrollment metrics, payment status, follow-ups, and course demand
- Multi-section enrollment form for student, guardian, course, batch, payment, and remarks
- Document upload center with Supabase Storage integration points
- Enrollment records table with search, filters, and action buttons
- Student profile page with documents, timeline, and PDF generation
- Native Supabase email and automation flow for enquiry, follow-up, and enrollment communication
- Optional Supabase server-side automation dispatcher for unattended follow-up and payment reminder runs
- Admissions Copilot workspace for AI-guided summaries, next steps, follow-up drafts, and priority review
- Sample data for courses, enrollments, documents, and email logs

## Tech Stack

- Frontend: React.js + Vite
- Styling: Tailwind CSS
- Backend / Database: Supabase PostgreSQL
- Authentication: Supabase Auth ready structure
- Storage: Supabase Storage ready helpers
- PDF Generation: jsPDF
- Automation: Supabase Edge Functions + scheduled dispatch
- Hosting: Vercel compatible

## Project Structure

```text
.
├── .env.example
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
├── src
│   ├── components
│   ├── context
│   ├── data
│   ├── lib
│   ├── pages
│   ├── services
│   └── utils
└── supabase
    └── schema.sql
```

## Supabase Setup

1. Create a new Supabase project.
2. Open the SQL editor and run [`supabase/schema.sql`](/C:/Users/deepi/OneDrive/Desktop/EnrollEase%20AI/supabase/schema.sql:1).
3. Create a public storage bucket such as `enrollment-documents`.
4. Copy `.env.example` to `.env` and add your project values.

Required environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_PUBLIC_APP_URL` set this to your real deployed app URL so student enrollment form links open on mobile and outside your laptop
- `VITE_AI_API_KEY` optional
- `VITE_AI_MODEL` optional, defaults to `gpt-4o-mini`
- `VITE_SERVER_SIDE_AUTOMATIONS` optional, set to `true` after the Supabase cron dispatcher is deployed

Supabase Edge Function secrets required for email delivery:

- `MAIL_FROM_EMAIL`
- `ADMIN_NOTIFICATION_EMAIL`
- either `RESEND_API_KEY`
- or `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`

For unattended automation setup, use:

- [`docs/supabase-server-automations.md`](/C:/Users/deepi/OneDrive/Desktop/EnrollEase%20AI/docs/supabase-server-automations.md:1)
- [`supabase/server_automations.sql`](/C:/Users/deepi/OneDrive/Desktop/EnrollEase%20AI/supabase/server_automations.sql:1)

## How To Run Locally

1. Install dependencies with `npm install`
2. Start the dev server with `npm run dev`
3. Open the local Vite URL shown in the terminal

The app is local-first by default. If Supabase environment variables are missing, it still runs using built-in sample data so you can explore the complete MVP immediately.

## Future Enhancements

- Real Supabase Auth signup and login flows
- Live row-level security policies per role
- Real document upload to Supabase Storage with previews
- LLM-backed conversational agent using `VITE_AI_API_KEY`
- Extended automation rules for PDF, email, and admin alerts
- Analytics dashboards and downloadable reports
- WhatsApp and SMS notification triggers

## Notes

- The current implementation is beginner-friendly and intentionally commented through service boundaries.
- This MVP is designed to be extended without changing the overall architecture.
- The UI is responsive and optimized for a modern, premium admissions portal feel.

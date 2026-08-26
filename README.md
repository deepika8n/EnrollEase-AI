# EnrollEase AI

EnrollEase AI is an agentic student enrollment management and automation portal for institutes, academies, coaching centers, training providers, and colleges. It combines a modern React frontend with Supabase-ready backend integrations so teams can manage enquiry, enrollment, payments, PDF generation, communication, and AI-assisted workflow support from one place.

Live production URL: https://enroll-ease-ai.vercel.app

## Problem Statement

Educational organizations often manage admissions across forms, spreadsheets, phone calls, payments, and manual follow-ups. This creates missed follow-ups, scattered records, payment confusion, and repeated manual work. EnrollEase AI solves this by centralizing the full admission flow and adding an AI-assisted action workflow for admins.

## Features

- Role-based login experience for Admin, Staff, and Student
- Dashboard views for enrollment metrics, payment status, follow-ups, and course demand
- Multi-section enrollment form for student, guardian, course, batch, payment, and remarks
- Public enquiry form and secure student intake form
- Document upload center with Supabase Storage integration points
- Enrollment records table with search, filters, and action buttons
- Student profile page with documents, timeline, payment history, and PDF generation
- Native Supabase email and automation flow for enquiry, follow-up, enrollment, and payment communication
- Optional Supabase server-side automation dispatcher for unattended follow-up and payment reminder runs
- AI Copilot workspace for summaries, next steps, follow-up drafts, and priority review
- Admissions Action Agent that observes records, reasons over priority, plans actions, executes admin-approved follow-up/payment/reactivation emails, and marks completed actions
- Sample data for courses, enrollments, documents, and email logs

## Tech Stack

- Frontend: React.js + Vite
- Styling: Tailwind CSS
- Backend / Database: Supabase PostgreSQL
- Authentication: Supabase Auth-ready structure
- Storage: Supabase Storage-ready helpers
- PDF Generation: jsPDF and PDF preview support
- Automation: Supabase Edge Functions + scheduled dispatch
- Agentic AI: admissions action planner with human-approved tool execution
- Hosting: Vercel
- Version Control: GitHub

## AI Copilot And Action Agent

EnrollEase AI includes two related AI experiences inside the AI Copilot page:

- `Ask agent`: answers questions, summarizes selected records, suggests next steps, and drafts messages.
- `Run action agent`: scans current records and prepares an executable action plan for priority work such as dropout reactivation emails and payment reminders.

The action agent follows this loop:

1. Observes current enrollment, payment, follow-up, and dropout records.
2. Reasons over urgency, payment due amount, status, and follow-up dates.
3. Plans the next best action for priority students.
4. Uses existing app tools to send payment reminders, admission follow-ups, or reactivation emails after admin approval.
5. Marks completed actions in the workflow UI and logs communication through the app email flow.

The `Run action agent` button prepares the plan. The actual action is performed only when the admin clicks a workflow button such as `Send reactivation email` or `Execute payment reminder`.

AI model usage is optional and controlled by environment variables. If `VITE_GEMINI_API_KEY` is configured, Gemini is used first. If `VITE_AI_API_KEY` is configured, the OpenAI-compatible chat completion endpoint is used. If no AI key is configured, the app still provides local guided responses from the student records. Email sending uses the mail/Supabase automation flow, not the AI key directly.

The document upload process is intentionally not part of the action agent because Aadhaar and student photo uploads are already required during enrollment completion.

## Project Structure

```text
.
|-- .env.example
|-- index.html
|-- package.json
|-- postcss.config.js
|-- tailwind.config.js
|-- vite.config.js
|-- src
|   |-- components
|   |-- context
|   |-- data
|   |-- lib
|   |-- pages
|   |-- services
|   `-- utils
|-- supabase
|   |-- functions
|   `-- schema.sql
`-- docs
```

## Supabase Setup

1. Create a new Supabase project.
2. Open the SQL editor and run `supabase/schema.sql`.
3. Create a public storage bucket such as `enrollment-documents`.
4. Copy `.env.example` to `.env` and add your project values.

Required frontend environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_PUBLIC_APP_URL` set this to the deployed app URL so student enrollment links open outside the local machine
- `VITE_GEMINI_API_KEY` optional, used first when configured
- `VITE_GEMINI_MODEL` optional
- `VITE_AI_API_KEY` optional OpenAI-compatible key
- `VITE_AI_MODEL` optional OpenAI-compatible model, defaults to `gpt-4o-mini`
- `VITE_SERVER_SIDE_AUTOMATIONS` optional, set to `true` after the Supabase cron dispatcher is deployed

Supabase Edge Function secrets required for email delivery:

- `MAIL_FROM_EMAIL`
- `ADMIN_NOTIFICATION_EMAIL`
- either `RESEND_API_KEY`
- or `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`

For unattended automation setup, use:

- `docs/supabase-server-automations.md`
- `supabase/server_automations.sql`

## How To Run Locally

1. Install dependencies with `npm install`.
2. Start the dev server with `npm run dev`.
3. Open the local Vite URL shown in the terminal.

The app is local-first by default. If Supabase environment variables are missing, it still runs using built-in sample data so the complete MVP can be explored immediately.

## Deployment

The project is deployed on Vercel:

- Production: https://enroll-ease-ai.vercel.app
- Source control: GitHub repository `deepika8n/EnrollEase-AI`
- Build command: `npm run build`
- Output folder: `dist`

The current workflow is GitHub-driven: after changes are pushed to `main`, Vercel automatically creates the production deployment.

## Future Enhancements

- Real Supabase Auth signup and login flows
- Live row-level security policies per role
- Real document upload to Supabase Storage with previews
- More advanced LLM-backed reasoning and analytics
- Extended automation rules for PDF, email, and admin alerts
- Analytics dashboards and downloadable reports
- WhatsApp and SMS notification triggers
- Payment gateway integration

## Notes

- The current implementation is beginner-friendly and structured around clear service boundaries.
- The MVP is designed to be extended without changing the overall architecture.
- The UI is responsive and optimized for a modern admissions portal experience.

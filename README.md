# EnrollEase AI

EnrollEase AI is an agentic student enrollment management and automation portal for institutes, academies, coaching centers, training providers, and colleges. It combines a modern React frontend with Supabase-ready backend integrations so teams can manage inquiry, enrollment, document verification, PDF generation, communication, and AI-assisted workflow support from one place.

## Problem Statement

Educational organizations often manage admissions across forms, spreadsheets, file folders, phone calls, and manual follow-ups. This slows down verification, creates missed document requests, and makes it hard for students to understand what happens next. EnrollEase AI solves that by centralizing the full enrollment flow and adding an AI agent that guides both students and admins.

## Features

- Role-based login experience for Admin, Staff, and Student
- Dashboard views for enrollment metrics, verification status, and course demand
- Multi-section enrollment form for student, guardian, course, batch, payment, and remarks
- Document upload center with Supabase Storage integration points
- Enrollment records table with search, filters, and action buttons
- Student profile page with documents, timeline, PDF generation, and email history
- Verification panel for approval, rejection, corrections, and workflow progression
- Email template manager with trigger placeholders for future automation
- AI Enrollment Agent panel with goal-driven guidance and next-action recommendations
- n8n webhook-ready automation service for workflow expansion
- Sample data for courses, enrollments, documents, and email templates

## Tech Stack

- Frontend: React.js + Vite
- Styling: Tailwind CSS
- Backend / Database: Supabase PostgreSQL
- Authentication: Supabase Auth ready structure
- Storage: Supabase Storage ready helpers
- PDF Generation: jsPDF
- Automation: n8n webhook placeholder service
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
- `VITE_AI_API_KEY` optional
- `VITE_N8N_WEBHOOK_URL` optional

## How To Run Locally

1. Install dependencies with `npm install`
2. Start the dev server with `npm run dev`
3. Open the local Vite URL shown in the terminal

The app is local-first by default. If Supabase environment variables are missing, it still runs using built-in sample data so you can explore the complete MVP immediately.

## Agentic AI Workflow

The AI enrollment agent follows this pattern:

1. Goal: complete or review an enrollment
2. Analyze: inspect student status, payment, and documents
3. Plan: decide the next steps
4. Use Tools: query records, document metadata, or templates
5. Take Action: submit, approve, reject, notify, or generate PDF
6. Monitor: watch pending and missing items
7. Update Status: move the enrollment forward

In this MVP, the agent logic is implemented locally in `src/services/agentService.js` so the UX is already in place. You can later swap that logic for a live LLM or AI workflow engine.

## Future Enhancements

- Real Supabase Auth signup and login flows
- Live row-level security policies per role
- Real document upload to Supabase Storage with previews
- LLM-backed conversational agent using `VITE_AI_API_KEY`
- n8n workflow orchestration for PDF, email, and admin alerts
- Analytics dashboards and downloadable reports
- WhatsApp and SMS notification triggers

## Notes

- The current implementation is beginner-friendly and intentionally commented through service boundaries.
- This MVP is designed to be extended without changing the overall architecture.
- The UI is responsive and optimized for a modern, premium admissions portal feel.

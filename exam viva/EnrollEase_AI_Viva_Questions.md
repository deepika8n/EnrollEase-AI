# EnrollEase AI - Exam Viva Preparation

## 1. Project Introduction

EnrollEase AI is a student enquiry, enrollment, payment, document, and communication management system for institutes and training centers. It helps admins manage the full admission workflow from public enquiry to confirmed enrollment.

The system supports public enquiry forms, student intake forms, course selection, payment tracking, EMI handling, discounts, PDF enrollment agreement generation, document preview, email communication, and AI-assisted admin support.

In simple words, EnrollEase AI reduces manual admission work and keeps all student details, payment details, documents, and follow-ups in one place.

## 2. Problem Statement

Many institutes manage enquiries and admissions using notebooks, Excel sheets, phone calls, WhatsApp messages, and separate payment records. This can cause missed follow-ups, duplicate student records, wrong fee calculations, unclear payment status, and difficulty tracking documents.

EnrollEase AI solves this by providing one centralized digital platform for admissions, student records, payment management, and automated communication.

## 3. Existing System

In the existing manual system, institutes usually collect student details through paper forms, Google Forms, phone calls, or spreadsheets. Payment information is often maintained separately, and follow-up reminders depend on staff memory.

### Disadvantages of Existing System

- Data can be duplicated or misplaced.
- Payment tracking is difficult, especially for EMI students.
- Follow-up reminders may be missed.
- Student documents are scattered across files or chats.
- Manual fee discount calculation can cause mistakes.
- Generating enrollment agreements manually takes time.
- Admins cannot easily see total revenue, pending amount, or student status.
- Communication history is not centralized.

## 4. Proposed System

The proposed system is EnrollEase AI, a web-based admission management portal. It stores student enquiries, enrollment details, course details, payment details, uploaded documents, email logs, and audit details in a structured database.

### Advantages of Proposed System

- Centralized student and enrollment records.
- Public enquiry form for collecting leads online.
- Student intake form for completing admission details.
- Automatic fee calculation with original fee, discount, payable fee, amount paid, and remaining amount.
- EMI and one-time payment support.
- Payment emails, reminders, and admission emails.
- PDF enrollment agreement generation.
- Document upload and preview.
- Dashboard for quick admission and payment overview.
- AI Copilot support for admin assistance and student follow-up planning.
- Hosted online using Vercel, so it can be accessed from anywhere.

## 5. Project Objectives

- To digitize the admission and enrollment process.
- To reduce manual errors in payment and discount calculation.
- To maintain student, course, document, and payment records in one place.
- To automate important communication through email.
- To generate professional enrollment PDFs.
- To provide dashboards for fast decision making.
- To make the system easy for admins, staff, and students.

## 6. Software Requirements

### Frontend

- React.js: Used to build the interactive user interface.
- Vite: Used as the build tool and development server.
- React Router DOM: Used for page routing like dashboard, records, payments, login, enquiry, and student profile.
- Tailwind CSS: Used for styling and responsive UI design.
- Chart.js and react-chartjs-2: Used for dashboard charts and visual reports.
- jsPDF: Used to generate enrollment agreement PDFs.
- pdfjs-dist: Used for PDF preview support.

### Backend and Cloud

- Supabase: Used as backend platform.
- PostgreSQL: Used as the database through Supabase.
- Supabase Auth: Used for authentication-ready admin/staff/student login structure.
- Supabase Edge Functions: Used for mailer, public enquiry, student intake, and automation dispatch.
- Supabase Storage-ready helpers: Used for handling student photo and Aadhaar document URLs.
- Vercel: Used for frontend hosting and production deployment.
- GitHub: Used for source code version control.

### Development Tools

- Node.js: Used to run the React/Vite project.
- npm: Used to install packages and run scripts.
- Git: Used for version control.
- VS Code or any code editor: Used for development.

## 7. Hardware Requirements

### Minimum Requirements

- Processor: Dual-core processor or above.
- RAM: 4 GB minimum.
- Storage: 1 GB free space for project files and dependencies.
- Internet: Required for Supabase, Vercel, GitHub, and email services.
- Browser: Latest Chrome, Edge, or Firefox.

### Recommended Requirements

- Processor: Intel i3/i5 or equivalent.
- RAM: 8 GB or above.
- Storage: 2 GB or more free space.
- Stable internet connection.

## 8. Database Used

The project uses Supabase PostgreSQL as the database.

### Why PostgreSQL/Supabase Was Used

- PostgreSQL is reliable and supports structured relational data.
- Supabase provides database, authentication, storage, and Edge Functions in one platform.
- It supports real-time ready architecture.
- It is easy to connect with React using `@supabase/supabase-js`.
- It supports Row Level Security policies.
- It is suitable for student, enrollment, course, payment, document, and email log records.

### Main Database Tables

- `profiles`: Stores user profile and role details.
- `students`: Stores student personal details, contact details, photos, Aadhaar document URL, and notes.
- `courses`: Stores course name, duration, fee, batch, mode, and active status.
- `enrollments`: Stores admission stage, course selection, batch, fee details, discount, EMI, payment status, student form status, and remarks.
- `documents`: Stores uploaded document information.
- `email_logs`: Stores email type, status, and sent date.
- `audit_logs`: Stores admin actions for tracking.

## 9. Technologies Used and Why

### React.js

React.js is used because it makes the UI component-based and easier to maintain. Pages like dashboard, records, payments, student profile, and intake form can be built as separate reusable components.

### Vite

Vite is used because it is fast for development and creates optimized production builds. It improves developer speed compared to older build tools.

### Tailwind CSS

Tailwind CSS is used because it allows fast and consistent styling directly in components. It helps build responsive layouts without writing large custom CSS files.

### React Router DOM

React Router DOM is used to manage navigation between pages such as `/dashboard`, `/records`, `/payments`, `/students/:id`, `/enquiry`, and `/student-intake/:enrollmentId`.

### Supabase

Supabase is used because it provides a ready backend with PostgreSQL database, authentication support, Edge Functions, and storage support. This reduces backend development time.

### PostgreSQL

PostgreSQL is used because the project has relational data. Students, courses, enrollments, payments, documents, and email logs are connected to each other.

### Supabase Edge Functions

Edge Functions are used for server-side operations such as sending email, handling public enquiry submission, student intake submission, and automation dispatch.

### jsPDF

jsPDF is used to generate enrollment agreement PDFs directly from student and payment data.

### Chart.js

Chart.js is used to show reports and dashboard statistics visually.

### Vercel

Vercel is used for hosting because it works well with React/Vite projects and provides fast deployment with production URLs.

### GitHub

GitHub is used for storing code, tracking changes, and maintaining project versions.

## 10. Working of the Project

1. A student submits an enquiry through the public enquiry page.
2. Admin can view the enquiry in the enquiry dashboard.
3. Admin can send a student intake form.
4. Student fills personal details, course details, payment details, and uploads required documents.
5. The system converts the enquiry into an enrolled student.
6. Fee details are calculated with original fee, discount, final payable fee, paid amount, and remaining amount.
7. Payment history is created.
8. Student profile displays all details, documents, timeline, payment summary, and notes.
9. Admin can generate enrollment agreement PDF.
10. Emails are sent for admission confirmation, payment update, reminders, and follow-ups.
11. Dashboard and payment page show overall admission and collection status.

## 11. Important Modules

### Public Enquiry Module

This module allows students to submit enquiries online. It stores basic student interest and course information.

### Enrollment Module

This module allows admin to complete student admission with batch, course, payment, document, and remarks.

### Student Intake Module

This module allows students to complete their admission form through a secure link.

### Payment Module

This module tracks one-time and EMI payments, amount paid, remaining amount, installment count, due dates, and payment status.

### Student Profile Module

This module shows complete student information, document previews, timeline, payment summary, and payment history.

### PDF Module

This module generates a student enrollment agreement with terms, fee details, installments, required document, signature, and seal.

### Email Module

This module sends admission confirmation, payment received, payment cleared, EMI reminder, and follow-up emails.

### AI Copilot Module

This module helps admins with summaries, next actions, and admission workflow support.

## 12. Fee and Payment Workflow

If no discount is given, the system shows only course fee as payable fee.

If discount is given, the system shows:

- Original fee
- Discount
- Final payable fee
- Amount paid
- Remaining amount

For EMI students, it also tracks:

- Number of installments
- Installments paid
- Remaining installments
- Installment amount
- Next due date

If a student pays partially during enrollment, the system sends a payment received email. If the student fully clears the amount, the system sends a payment cleared email.

## 13. Email Workflow

- Enquiry follow-up email: Sent when enquiry follow-up is required.
- Student intake form email: Sent to student to complete admission.
- Student form submitted email: Sent after student submits intake form.
- Admin alert email: Sent to admin after student form submission.
- Admission confirmation email: Sent when student is enrolled.
- Payment received email: Sent when partial payment is recorded.
- Payment cleared email: Sent when full payment is completed.
- EMI reminder email: Sent when EMI due date arrives.

## 14. Security Features

- Supabase authentication-ready structure.
- Role-based profile table for admin, staff, and student roles.
- Row Level Security policies in Supabase schema.
- Student intake uses token-based access.
- Email and backend secrets are handled through environment variables.
- Database records use UUID primary keys.

## 15. Future Enhancements

- Add WhatsApp and SMS notifications.
- Add online payment gateway integration.
- Add real-time notifications for admins.
- Add advanced reports for monthly revenue and conversion rate.
- Add role-based dashboards for admin, staff, and students.
- Add automatic certificate generation.
- Add attendance and assignment tracking.
- Add placement tracking module.
- Add stronger analytics for dropout prediction.
- Add multilingual support.
- Add mobile app version.

## 16. Conclusion

EnrollEase AI is a complete admission and enrollment management system that improves the traditional manual admission process. It centralizes enquiries, student records, payment tracking, documents, emails, and PDF generation. By using modern technologies like React, Supabase, PostgreSQL, Tailwind CSS, jsPDF, and Vercel, the project becomes fast, scalable, user-friendly, and suitable for real institute admission workflows.

## 17. Viva Questions and Answers

### 1. What is the title of your project?

The title of my project is EnrollEase AI.

### 2. What is EnrollEase AI?

EnrollEase AI is a web-based student enquiry and enrollment management system. It helps institutes manage enquiries, admissions, payments, documents, emails, and student profiles from one platform.

### 3. What problem does your project solve?

It solves the problem of manual admission management. It avoids scattered records, missed follow-ups, payment confusion, duplicate data, and manual PDF creation.

### 4. Who are the users of this system?

The main users are admins, staff members, and students. Admins and staff manage records, while students can submit enquiry and intake forms.

### 5. What is the frontend technology used?

The frontend is built using React.js with Vite.

### 6. Why did you use React.js?

React.js was used because it supports reusable components, fast UI updates, and easy state management. It is suitable for building dashboards and form-based applications.

### 7. Why did you use Vite?

Vite was used because it provides fast development server startup and optimized production build.

### 8. Which CSS framework is used?

Tailwind CSS is used for styling.

### 9. Why did you use Tailwind CSS?

Tailwind CSS makes styling faster and consistent. It also helps create responsive designs easily.

### 10. Which database is used?

Supabase PostgreSQL is used as the database.

### 11. Why did you use Supabase?

Supabase provides PostgreSQL database, authentication support, storage support, and Edge Functions. It reduces the need to build a full backend manually.

### 12. What is PostgreSQL?

PostgreSQL is an open-source relational database management system. It stores structured data in tables and supports relationships between records.

### 13. What are the main tables in your database?

The main tables are `profiles`, `students`, `courses`, `enrollments`, `documents`, `email_logs`, and `audit_logs`.

### 14. What does the `students` table store?

It stores student details such as name, email, phone, current activity, place, lead source, photo URL, Aadhaar document URL, and notes.

### 15. What does the `enrollments` table store?

It stores course selection, batch, admission stage, payment plan, original fee, discount, final fee, amount paid, EMI details, due date, payment status, remarks, and student form status.

### 16. What does the `courses` table store?

It stores course name, duration, fee, batch, mode, and active status.

### 17. What does the `documents` table store?

It stores uploaded student documents like student photo and Aadhaar document.

### 18. What does the `email_logs` table store?

It stores email type, status, enrollment ID, and sent date.

### 19. What is the use of `audit_logs`?

Audit logs are used to track important admin actions.

### 20. What is the main feature of the payment module?

The payment module tracks original fee, discount, final payable fee, paid amount, remaining amount, payment type, installments, and due dates.

### 21. How does your system handle discounts?

The system stores original fee, discount type, discount value, discount amount, and final payable fee. If discount is given, the profile and PDF show all three values clearly.

### 22. What happens if a student pays partial amount?

The system marks payment as partial, stores the paid amount, calculates remaining amount, creates payment history, and sends a payment received email.

### 23. What happens if payment is fully cleared?

The system marks payment as paid or cleared and sends a payment cleared email.

### 24. How does EMI payment work?

For EMI payment, the system stores installment count, installments paid, remaining installments, installment amount, payment history, and next due date.

### 25. What is the use of jsPDF?

jsPDF is used to generate the student enrollment agreement PDF.

### 26. What details are included in the PDF?

The PDF includes student details, course details, fee details, discount details, payment details, installment details, placement eligibility, required document, signature, and seal.

### 27. What is the use of React Router?

React Router is used to navigate between pages without reloading the browser.

### 28. Name some routes in your project.

Some routes are `/`, `/enquiry`, `/admin-login`, `/dashboard`, `/records`, `/payments`, `/students/:id`, `/student-intake/:enrollmentId`, and `/ai-copilot`.

### 29. What is the use of the public enquiry page?

The public enquiry page allows students to submit interest in a course.

### 30. What is the use of the student intake page?

The student intake page allows a student to complete admission details and upload documents through a secure link.

### 31. How are emails sent?

Emails are sent through Supabase Edge Functions and mailer service. The system can send admission, payment, follow-up, and reminder emails.

### 32. What is an Edge Function?

An Edge Function is a server-side function hosted by Supabase. It runs backend logic like sending emails and processing submissions.

### 33. What is Vercel used for?

Vercel is used to host and deploy the frontend React application.

### 34. Why did you use GitHub?

GitHub is used for version control, backup, collaboration, and deployment workflow.

### 35. What is authentication in your project?

Authentication is used to protect admin pages. Only logged-in users can access dashboard, records, payments, and student profiles.

### 36. What are protected routes?

Protected routes are pages that require login before access.

### 37. What is the use of environment variables?

Environment variables store sensitive or environment-specific values like Supabase URL, Supabase anon key, public app URL, and email service secrets.

### 38. What is the advantage of using UUID?

UUID provides unique IDs for records and reduces chances of ID collision.

### 39. What is Row Level Security?

Row Level Security is a database security feature that controls which users can access or modify rows.

### 40. What is the role of AI in EnrollEase AI?

AI Copilot supports admins by helping with summaries, next actions, follow-up planning, and student workflow assistance.

### 41. What is the difference between enquiry and enrollment?

An enquiry is an interested student lead. Enrollment means the student has completed admission details and joined a course.

### 42. What is payment status?

Payment status shows whether payment is pending, partial, or paid.

### 43. What is payment history?

Payment history stores each payment entry with paid amount, date, method, pending amount, and installment details.

### 44. Why is document upload needed?

Document upload is needed to store required documents like student photo and Aadhaar proof for admission verification.

### 45. What are future enhancements of this project?

Future enhancements include payment gateway integration, WhatsApp/SMS notifications, attendance tracking, placement tracking, advanced analytics, and mobile app support.

### 46. What are the advantages of your project?

It saves time, reduces errors, improves follow-up, centralizes student records, tracks payments clearly, generates PDFs, and automates communication.

### 47. What are the limitations of your project?

The current system can be improved with payment gateway integration, advanced role permissions, mobile app support, and more analytics.

### 48. How is the project deployed?

The project is deployed on Vercel and the source code is stored on GitHub.

### 49. What command is used to build the project?

The build command is `npm run build`.

### 50. What is the final conclusion of the project?

EnrollEase AI successfully digitizes and simplifies the admission process. It provides a centralized, user-friendly, and scalable solution for enquiry handling, enrollment, payment tracking, document management, email automation, and PDF generation.
export const sampleCourses = [
  { id: "c1", course_name: "Agentic AI", duration: "6 Months", fee: 45000, batch: "Weekend Elite", active_status: true },
  { id: "c2", course_name: "Data Science", duration: "8 Months", fee: 52000, batch: "Morning Pro", active_status: true },
  { id: "c3", course_name: "Full Stack Development", duration: "7 Months", fee: 48000, batch: "Evening Launch", active_status: true },
  { id: "c4", course_name: "Python Programming", duration: "4 Months", fee: 28000, batch: "Fast Track", active_status: true },
  { id: "c5", course_name: "Digital Marketing", duration: "5 Months", fee: 32000, batch: "Career Boost", active_status: true },
];

export const sampleProfiles = [
  { id: "p1", user_id: "u1", full_name: "Aarav Menon", email: "admin@enrollease.ai", role: "admin", created_at: "2026-06-01" },
  { id: "p2", user_id: "u2", full_name: "Maya Singh", email: "staff@enrollease.ai", role: "staff", created_at: "2026-06-01" },
  { id: "p3", user_id: "u3", full_name: "Riya Patel", email: "student@enrollease.ai", role: "student", created_at: "2026-06-01" },
];

export const sampleStudents = [
  { id: "s1", full_name: "Riya Patel", email: "student@enrollease.ai", phone: "9876543210", address: "Bangalore", guardian_name: "Kiran Patel", guardian_phone: "9876500001", created_at: "2026-06-10" },
  { id: "s2", full_name: "Vikram Shah", email: "vikram@example.com", phone: "9988776655", address: "Pune", guardian_name: "Neeta Shah", guardian_phone: "9988776600", created_at: "2026-06-11" },
  { id: "s3", full_name: "Ananya Rao", email: "ananya@example.com", phone: "9123456780", address: "Hyderabad", guardian_name: "Suresh Rao", guardian_phone: "9123456790", created_at: "2026-06-12" },
];

export const sampleEnrollments = [
  { id: "e1", student_id: "s1", course_id: "c1", batch: "Weekend Elite", payment_status: "Paid", enrollment_status: "Verified", verification_status: "Approved", remarks: "Ready for orientation", created_at: "2026-06-12" },
  { id: "e2", student_id: "s2", course_id: "c3", batch: "Evening Launch", payment_status: "Pending", enrollment_status: "Pending", verification_status: "Missing Documents", remarks: "Need payment proof", created_at: "2026-06-15" },
  { id: "e3", student_id: "s3", course_id: "c2", batch: "Morning Pro", payment_status: "Partial", enrollment_status: "Review", verification_status: "Requested Correction", remarks: "Marks card mismatch", created_at: "2026-06-16" },
];

export const sampleDocuments = [
  { id: "d1", enrollment_id: "e1", document_type: "Photo", file_url: "#", verification_status: "Approved", remarks: "", uploaded_at: "2026-06-12" },
  { id: "d2", enrollment_id: "e1", document_type: "Aadhaar / ID proof", file_url: "#", verification_status: "Approved", remarks: "", uploaded_at: "2026-06-12" },
  { id: "d3", enrollment_id: "e2", document_type: "Payment proof", file_url: "#", verification_status: "Missing", remarks: "Student has not uploaded payment receipt", uploaded_at: "2026-06-15" },
  { id: "d4", enrollment_id: "e3", document_type: "Marks card", file_url: "#", verification_status: "Correction Needed", remarks: "Name mismatch with application", uploaded_at: "2026-06-16" },
];

export const sampleEmailTemplates = [
  { id: "t1", template_name: "Enrollment submitted", subject: "Your enrollment has been received", body: "Thank you for submitting your enrollment. Our team is reviewing it." },
  { id: "t2", template_name: "Missing document alert", subject: "Please upload pending documents", body: "We noticed a few documents are still pending. Please upload them to continue verification." },
  { id: "t3", template_name: "Enrollment approved", subject: "Your enrollment is approved", body: "Congratulations. Your enrollment has been approved and you are ready for onboarding." },
  { id: "t4", template_name: "Payment pending", subject: "Payment action required", body: "Your enrollment is on hold until the payment proof is verified." },
  { id: "t5", template_name: "Enrollment completed", subject: "Enrollment completed successfully", body: "Welcome aboard. Your enrollment process is now complete." },
];

export const sampleEmailLogs = [
  { id: "l1", enrollment_id: "e1", email_type: "Enrollment approved", status: "Sent", sent_at: "2026-06-13" },
  { id: "l2", enrollment_id: "e2", email_type: "Missing document alert", status: "Queued", sent_at: "2026-06-16" },
];

export const sampleAgentLogs = [
  {
    id: "a1",
    enrollment_id: "e2",
    user_message: "I want to know why my admission is still pending.",
    agent_response: "Your enrollment is pending because the payment proof has not been uploaded yet. Please add the payment receipt to move to verification.",
    next_action: "Upload payment proof",
    created_at: "2026-06-17 10:30",
  },
];

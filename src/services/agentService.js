export function buildAgentResponse({ message, enrollments, students, courses, activeRole }) {
  const lower = message.toLowerCase();
  const enquiryRecords = enrollments.filter((item) => item.pipeline_stage === "Enquiry");
  const enrolledRecords = enrollments.filter((item) => item.pipeline_stage === "Enrolled");
  const verificationQueue = enrolledRecords.filter(
    (item) => item.verification_status === "Pending" || item.verification_status === "Missing Documents",
  );

  if (lower.includes("pending")) {
    const pending = enquiryRecords;
    return {
      reply:
        pending.length > 0
          ? `There are ${pending.length} active enquiries waiting for conversion. Priority actions: follow up with interested students, complete admission details, and move ready enquiries into enrolled status.`
          : verificationQueue.length > 0
            ? `There are no pending enquiries right now, but ${verificationQueue.length} enrolled record(s) still need verification review.`
            : "There are no pending enquiries right now. You can review completed records or monitor new submissions.",
      nextAction: "Review pending queue",
      readiness: pending.length === 0 && verificationQueue.length === 0 ? "Ready" : "Attention Needed",
    };
  }

  if (lower.includes("enroll") || lower.includes("course")) {
    const featured = courses[0];
    return {
      reply: `Sure. I will help you start an enquiry for ${featured.course_name}. First collect the student's full name, phone number, email, course interest, qualification, college, city, and lead source. Admission documents and payment details are completed during conversion to enrolled status.`,
      nextAction: "Create enquiry",
      readiness: "In Progress",
    };
  }

  if (lower.includes("missing") || lower.includes("document")) {
    const missing = enrolledRecords.filter((item) => item.verification_status === "Missing Documents");
    return {
      reply:
        missing.length > 0
          ? `I found ${missing.length} enrollment record(s) with missing documents. Suggestion: send the missing document email template and hold approval until the uploads are completed.`
          : "No missing document cases were found in the current dataset.",
      nextAction: "Notify students",
      readiness: missing.length ? "Blocked" : "Ready",
    };
  }

  const student = students[0];
  return {
    reply: `I can help as an AI enrollment agent for ${activeRole}. Ask me about enquiries, conversions, missing documents, course guidance, or approval readiness. For example, ${student.full_name}'s timeline can be reviewed from the student profile page.`,
    nextAction: "Ask a targeted enrollment question",
    readiness: "Monitoring",
  };
}

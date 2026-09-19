export function canSendStudentEnrollmentForm(enrollment = {}) {
  const stage = String(enrollment.pipeline_stage || "").trim().toLowerCase();
  return ["enquiry", "dropout", "dropped"].includes(stage)
    && !enrollment.enrolled_date
    && String(enrollment.student_form_status || "").toLowerCase() !== "submitted"
    && !(Number(enrollment.amount_paid) > 0)
    && !(enrollment.payment_history?.length > 0);
}

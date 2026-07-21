import { createClient } from "npm:@supabase/supabase-js@2";

const ENQUIRY_FOLLOW_UP_INTERVAL_DAYS = 3;
const ENQUIRY_MAX_FOLLOW_UP_CYCLES = 2;
const INDIA_TIMEZONE = "Asia/Kolkata";
const JSON_HEADERS = { "Content-Type": "application/json" };
const CERTISURED_PHONE = "8976543209";

type StudentRecord = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
};

type CourseRecord = {
  id: string;
  course_name: string;
  fee: number | null;
  mode: string | null;
};

type EnrollmentRecord = {
  id: string;
  student_id: string;
  course_id: string | null;
  course_name: string | null;
  batch: string | null;
  pipeline_stage: string | null;
  lead_date: string | null;
  enrolled_date: string | null;
  follow_up_date: string | null;
  total_fee: number | null;
  amount_paid: number | null;
  next_due_date: string | null;
  payment_status: string | null;
  verification_status: string | null;
  remarks: string | null;
  dropout_reason: string | null;
  last_payment_date: string | null;
  created_at: string | null;
};

type EmailLogRecord = {
  enrollment_id: string | null;
  email_type: string | null;
  status: string | null;
  sent_at: string | null;
};

type SendResult = {
  ok: boolean;
  message: string;
};

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeEmailAddress(value = "") {
  return String(value || "").trim().toLowerCase();
}

function hasReachableStudentEmail(email = "") {
  const safeEmail = normalizeEmailAddress(email);
  if (!safeEmail || safeEmail.endsWith("@enrollease.local")) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail);
}

function toIsoDate(value: string | Date | null | undefined) {
  if (!value) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.valueOf())) return "";
    return value.toISOString().slice(0, 10);
  }

  const safeValue = String(value).trim();
  if (!safeValue) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(safeValue)) {
    return safeValue;
  }

  const parsed = new Date(safeValue);
  if (Number.isNaN(parsed.valueOf())) {
    return "";
  }

  return parsed.toISOString().slice(0, 10);
}

function addDays(isoDate = "", days = 0) {
  const normalized = toIsoDate(isoDate);
  if (!normalized) return "";
  const nextDate = new Date(`${normalized}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + Number(days || 0));
  return nextDate.toISOString().slice(0, 10);
}

function compareIsoDates(leftValue: string | null | undefined, rightValue: string | null | undefined) {
  const left = toIsoDate(leftValue);
  const right = toIsoDate(rightValue);

  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  return left.localeCompare(right);
}

function getTodayIsoDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getInitialEnquiryFollowUpDate(leadDate = "") {
  return addDays(leadDate, ENQUIRY_FOLLOW_UP_INTERVAL_DAYS);
}

function getFinalEnquiryFollowUpDate(leadDate = "") {
  return addDays(leadDate, ENQUIRY_FOLLOW_UP_INTERVAL_DAYS * ENQUIRY_MAX_FOLLOW_UP_CYCLES);
}

function getNextEnquiryFollowUpDate({ leadDate = "", followUpDate = "" } = {}) {
  const initialFollowUpDate = getInitialEnquiryFollowUpDate(leadDate);
  const finalFollowUpDate = getFinalEnquiryFollowUpDate(leadDate);
  const normalizedFollowUpDate = toIsoDate(followUpDate);

  if (!initialFollowUpDate) return "";
  if (!normalizedFollowUpDate) return initialFollowUpDate;
  if (!finalFollowUpDate) return "";
  if (compareIsoDates(normalizedFollowUpDate, initialFollowUpDate) <= 0) {
    return finalFollowUpDate;
  }

  return "";
}

function getRequiredEnquiryFollowUpCycles({ leadDate = "", today = getTodayIsoDate() } = {}) {
  const initialFollowUpDate = getInitialEnquiryFollowUpDate(leadDate);
  const finalFollowUpDate = getFinalEnquiryFollowUpDate(leadDate);
  const normalizedToday = toIsoDate(today);

  if (!initialFollowUpDate || !normalizedToday || compareIsoDates(normalizedToday, initialFollowUpDate) < 0) {
    return 0;
  }

  if (!finalFollowUpDate || compareIsoDates(normalizedToday, finalFollowUpDate) < 0) {
    return 1;
  }

  return 2;
}

function formatDateLabel(value: string | null | undefined) {
  const iso = toIsoDate(value);
  if (!iso) return "N/A";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: INDIA_TIMEZONE,
  }).format(new Date(`${iso}T00:00:00`));
}

function formatFollowUpDateLabel(value: string | null | undefined) {
  const iso = toIsoDate(value);
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: INDIA_TIMEZONE,
  }).format(new Date(`${iso}T00:00:00`));
}

function formatCurrencyValue(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveRemainingAmount(totalFee: unknown, amountPaid: unknown) {
  const feeValue = toNumberOrNull(totalFee);
  if (feeValue === null) return null;
  return Math.max(feeValue - (toNumberOrNull(amountPaid) || 0), 0);
}

function normalizeEmailLogType(emailType = "") {
  return String(emailType || "").trim().toLowerCase();
}

function normalizeStatus(status = "") {
  return String(status || "").trim().toLowerCase();
}

function isSuccessfulEmailLog(log: EmailLogRecord) {
  const normalizedStatus = normalizeStatus(log.status || "");
  return normalizedStatus === "sent" || normalizedStatus === "queued" || normalizedStatus === "ok";
}

function isFollowUpEmailLog(log: EmailLogRecord) {
  return normalizeEmailLogType(log.email_type || "").includes("follow-up");
}

function isPaymentReminderEmailLog(log: EmailLogRecord) {
  const normalizedType = normalizeEmailLogType(log.email_type || "");
  return normalizedType.includes("emi due reminder") || normalizedType.includes("payment reminder");
}

function isPaymentUpdateEmailLog(log: EmailLogRecord) {
  return normalizeEmailLogType(log.email_type || "").includes("payment update");
}

function isAdmissionConfirmationEmailLog(log: EmailLogRecord) {
  return normalizeEmailLogType(log.email_type || "").includes("admission confirmation");
}

function getEnrollmentLogs(emailLogs: EmailLogRecord[], enrollmentId = "", matcher: (log: EmailLogRecord) => boolean = () => true) {
  return emailLogs
    .filter((log) => log.enrollment_id === enrollmentId)
    .filter(isSuccessfulEmailLog)
    .filter(matcher)
    .sort((left, right) => {
      const leftDate = new Date(left.sent_at || 0).valueOf();
      const rightDate = new Date(right.sent_at || 0).valueOf();
      return rightDate - leftDate;
    });
}

function getSuccessfulFollowUpCount(emailLogs: EmailLogRecord[], enrollmentId = "") {
  return getEnrollmentLogs(emailLogs, enrollmentId, isFollowUpEmailLog).length;
}

function hasSuccessfulEmailOnOrAfter(
  emailLogs: EmailLogRecord[],
  enrollmentId = "",
  matcher: (log: EmailLogRecord) => boolean = () => true,
  startDate = "",
) {
  const normalizedStartDate = toIsoDate(startDate);
  if (!normalizedStartDate) return false;

  return getEnrollmentLogs(emailLogs, enrollmentId, matcher).some((log) => {
    return compareIsoDates(log.sent_at || "", normalizedStartDate) >= 0;
  });
}

function hasFailureLogToday(emailLogs: EmailLogRecord[], enrollmentId = "", emailType = "", today = getTodayIsoDate()) {
  const normalizedType = normalizeEmailLogType(emailType);
  return emailLogs.some((log) => {
    return log.enrollment_id === enrollmentId
      && normalizeEmailLogType(log.email_type || "") === normalizedType
      && normalizeStatus(log.status || "") === "failed"
      && toIsoDate(log.sent_at || "") === today;
  });
}

function isEnquiryStage(stage = "") {
  return String(stage || "").trim().toLowerCase() === "enquiry";
}

function isEnrolledStage(stage = "") {
  return String(stage || "").trim().toLowerCase() === "enrolled";
}

function buildCertisuredHeader({ title, subtitle = "" }: { title: string; subtitle?: string }) {
  const safeTitle = escapeHtml(title || "");
  const safeSubtitle = escapeHtml(subtitle || "");

  return `
    <div style="padding:28px 32px;background:linear-gradient(135deg,#0b3558 0%,#123f73 55%,#1d5ea8 100%);color:#ffffff;">
      <div>
        <div style="font-size:12px;letter-spacing:0.26em;text-transform:uppercase;opacity:0.78;font-weight:700;">CERTISURED</div>
        <div style="margin-top:6px;font-size:26px;font-weight:800;letter-spacing:-0.04em;">${safeTitle}</div>
        ${safeSubtitle ? `<div style="margin-top:2px;font-size:12px;letter-spacing:0.24em;text-transform:uppercase;opacity:0.78;font-weight:700;">${safeSubtitle}</div>` : ""}
      </div>
    </div>
  `;
}

function buildFollowUpEmailHtml({ studentName }: { studentName?: string }) {
  const safeStudentName = escapeHtml(studentName || "Student");

  return `
    <div style="margin:0;padding:24px;background:#eef4fb;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#10233c;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dbe8f7;border-radius:28px;overflow:hidden;box-shadow:0 22px 50px rgba(15,23,42,0.08);">
        ${buildCertisuredHeader({ title: "Admission Follow-up" })}
        <div style="padding:32px;">
          <div style="display:inline-block;padding:10px 14px;border-radius:999px;background:#edf5ff;border:1px solid #d4e5fb;color:#1d5ea8;font-size:12px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;">
            Admission Follow-up
          </div>
          <p style="margin:24px 0 0;font-size:16px;line-height:1.8;">Dear ${safeStudentName},</p>
          <p style="margin:18px 0 0;font-size:15px;line-height:1.85;color:#42556d;">We hope you are doing well.</p>
          <p style="margin:14px 0 0;font-size:15px;line-height:1.85;color:#42556d;">This is a friendly reminder regarding your admission enquiry with CERTISURED.</p>
          <p style="margin:14px 0 0;font-size:15px;line-height:1.85;color:#42556d;">Our admissions team noticed that your enquiry is still pending.</p>
          <div style="margin-top:24px;padding:22px 24px;border-radius:22px;background:#f8fbff;border:1px solid #dce9f7;">
            <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#163459;">If you need any assistance regarding:</p>
            <ul style="margin:0;padding-left:20px;color:#42556d;font-size:15px;line-height:1.9;">
              <li>Course Details</li>
              <li>Fees</li>
              <li>Batch Timing</li>
              <li>Scholarships</li>
              <li>Documents</li>
              <li>Payment</li>
            </ul>
          </div>
          <div style="margin-top:24px;padding:18px 20px;border-radius:20px;background:#fffaf0;border:1px solid #fde7b0;color:#7b5a06;font-size:14px;line-height:1.8;">
            Our admissions team is happy to help. Please contact us at <strong>${CERTISURED_PHONE}</strong> or reply to this email.
          </div>
          <p style="margin:24px 0 0;font-size:15px;line-height:1.85;color:#42556d;">We look forward to welcoming you.</p>
          <div style="margin-top:28px;padding-top:22px;border-top:1px solid #e4edf6;">
            <p style="margin:0;font-size:15px;line-height:1.85;color:#10233c;">Best Regards,<br /><strong>CERTISURED</strong></p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildFollowUpEmailText({ studentName }: { studentName?: string }) {
  return `Dear ${studentName || "Student"},

We hope you are doing well.

This is a friendly reminder regarding your admission enquiry with CERTISURED.
Our admissions team noticed that your enquiry is still pending.

If you need any assistance regarding course details, fees, batch timing, scholarships, documents, or payment, our admissions team is happy to help.

Please contact us at ${CERTISURED_PHONE} or reply to this email.

We look forward to welcoming you.

Best Regards,
CERTISURED`;
}

function buildAdmissionConfirmationEmailHtml({
  studentName,
  courseName,
  batchName,
  enrolledDate,
}: {
  studentName?: string;
  courseName?: string;
  batchName?: string | null;
  enrolledDate?: string | null;
}) {
  const safeStudentName = escapeHtml(studentName || "Student");
  const safeCourseName = escapeHtml(courseName || "Selected Course");
  const safeBatchName = escapeHtml(batchName || "Batch details will be shared soon");
  const safeEnrolledDate = escapeHtml(formatDateLabel(enrolledDate));

  return `
    <div style="margin:0;padding:24px;background:#eef4fb;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#10233c;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dbe8f7;border-radius:28px;overflow:hidden;box-shadow:0 22px 50px rgba(15,23,42,0.08);">
        ${buildCertisuredHeader({ title: "Admission Confirmation", subtitle: "Student Onboarding" })}
        <div style="padding:32px;">
          <p style="margin:0;font-size:16px;line-height:1.8;">Dear ${safeStudentName},</p>
          <p style="margin:18px 0 0;font-size:15px;line-height:1.85;color:#42556d;">Your admission has been successfully confirmed with <strong>CERTISURED</strong>.</p>
          <div style="margin-top:24px;padding:22px 24px;border-radius:22px;background:#f8fbff;border:1px solid #dce9f7;">
            <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#163459;">Admission summary</p>
            <div style="font-size:15px;line-height:1.9;color:#42556d;">
              <strong>Name:</strong> ${safeStudentName}<br />
              <strong>Course:</strong> ${safeCourseName}<br />
              <strong>Batch:</strong> ${safeBatchName}<br />
              <strong>Admission date:</strong> ${safeEnrolledDate}
            </div>
          </div>
          <div style="margin-top:24px;padding:18px 20px;border-radius:20px;background:#f3fcf6;border:1px solid #cfeeda;color:#167647;font-size:14px;line-height:1.8;">
            Welcome aboard. Our team will contact you with onboarding details shortly.
          </div>
          <div style="margin-top:28px;padding-top:22px;border-top:1px solid #e4edf6;">
            <p style="margin:0;font-size:15px;line-height:1.85;color:#10233c;">Best Regards,<br /><strong>CERTISURED</strong></p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildAdmissionConfirmationEmailText({
  studentName,
  courseName,
  batchName,
  enrolledDate,
}: {
  studentName?: string;
  courseName?: string;
  batchName?: string | null;
  enrolledDate?: string | null;
}) {
  return `Dear ${studentName || "Student"},

Your admission has been successfully confirmed with CERTISURED.

Admission summary
Name: ${studentName || "Student"}
Course: ${courseName || "Selected Course"}
Batch: ${batchName || "Batch details will be shared soon"}
Admission date: ${formatDateLabel(enrolledDate)}

Welcome aboard. Our team will contact you with onboarding details shortly.

Best Regards,
CERTISURED`;
}

function buildRelatedCoursesTableHtml(relatedCourses: CourseRecord[]) {
  if (!relatedCourses.length) return "";

  const rows = relatedCourses
    .map((course) => `
      <tr>
        <td style="padding:10px 12px;border:1px solid #dbe8f7;font-size:14px;color:#163459;">${escapeHtml(course.course_name || "Course")}</td>
        <td style="padding:10px 12px;border:1px solid #dbe8f7;font-size:14px;color:#163459;">${escapeHtml(formatCurrencyValue(course.fee || 0))}</td>
      </tr>
    `)
    .join("");

  return `
    <div style="margin-top:24px;padding:22px 24px;border-radius:22px;background:#f8fbff;border:1px solid #dce9f7;">
      <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#163459;">You may also like these related CERTISURED courses:</p>
      <table style="width:100%;border-collapse:collapse;background:#ffffff;border-radius:14px;overflow:hidden;">
        <thead>
          <tr style="background:#edf5ff;">
            <th style="padding:10px 12px;border:1px solid #dbe8f7;font-size:13px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#1d5ea8;text-align:left;">Course</th>
            <th style="padding:10px 12px;border:1px solid #dbe8f7;font-size:13px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#1d5ea8;text-align:left;">Fee</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function buildRelatedCoursesText(relatedCourses: CourseRecord[]) {
  if (!relatedCourses.length) return "";
  const lines = relatedCourses.map((course) => `- ${course.course_name || "Course"}: ${formatCurrencyValue(course.fee || 0)}`);
  return `\nRelated CERTISURED courses:\n${lines.join("\n")}`;
}

function buildPaymentStatusEmailHtml({
  studentName,
  courseName,
  paidAmount,
  paymentDate,
  isCleared,
  remainingAmount,
  nextDueDate,
  relatedCourses,
  emailVariant,
}: {
  studentName?: string;
  courseName?: string;
  paidAmount?: number | null;
  paymentDate?: string | null;
  isCleared: boolean;
  remainingAmount?: number | null;
  nextDueDate?: string | null;
  relatedCourses: CourseRecord[];
  emailVariant: "payment_update" | "due_reminder";
}) {
  const safeStudentName = escapeHtml(studentName || "Student");
  const safeCourseName = escapeHtml(courseName || "Selected Course");
  const isReminder = emailVariant === "due_reminder";
  const clearedLabel = isCleared ? "Cleared" : (isReminder ? "Due Reminder" : "Payment Received");
  const statusNote = isCleared
    ? "Your payment record is now fully cleared."
    : isReminder
      ? "This is a reminder for your upcoming payment due date."
      : "We have recorded your latest payment successfully.";
  const pendingPanel = !isCleared
    ? `
      <div style="margin-top:18px;padding:18px 20px;border-radius:20px;background:#fffaf0;border:1px solid #fde7b0;color:#7b5a06;font-size:14px;line-height:1.8;">
        <strong>Next pending amount:</strong> ${escapeHtml(formatCurrencyValue(remainingAmount || 0))}<br />
        <strong>Due date:</strong> ${escapeHtml(formatDateLabel(nextDueDate))}
      </div>
    `
    : `
      <div style="margin-top:18px;padding:18px 20px;border-radius:20px;background:#f3fcf6;border:1px solid #cfeeda;color:#167647;font-size:14px;line-height:1.8;">
        Your payment plan is marked as <strong>Cleared</strong>.
      </div>
    `;

  return `
    <div style="margin:0;padding:24px;background:#eef4fb;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#10233c;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dbe8f7;border-radius:28px;overflow:hidden;box-shadow:0 22px 50px rgba(15,23,42,0.08);">
        ${buildCertisuredHeader({ title: "Payment Update", subtitle: clearedLabel })}
        <div style="padding:32px;">
          <p style="margin:0;font-size:16px;line-height:1.8;">Dear ${safeStudentName},</p>
          <p style="margin:18px 0 0;font-size:15px;line-height:1.85;color:#42556d;">
            ${isReminder ? `This is a reminder for your payment plan in <strong>${safeCourseName}</strong>.` : `Thank you for your payment towards <strong>${safeCourseName}</strong>.`}
          </p>
          <p style="margin:14px 0 0;font-size:15px;line-height:1.85;color:#42556d;">${escapeHtml(statusNote)}</p>
          <div style="margin-top:24px;padding:22px 24px;border-radius:22px;background:#f8fbff;border:1px solid #dce9f7;">
            <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#163459;">${isReminder ? "Payment reminder" : "Payment summary"}</p>
            <div style="font-size:15px;line-height:1.9;color:#42556d;">
              <strong>Name:</strong> ${safeStudentName}<br />
              <strong>Course:</strong> ${safeCourseName}<br />
              ${isReminder ? "" : `<strong>Paid amount:</strong> ${escapeHtml(formatCurrencyValue(paidAmount || 0))}<br />
              <strong>Paid date:</strong> ${escapeHtml(formatDateLabel(paymentDate))}`}
            </div>
          </div>
          ${pendingPanel}
          ${isCleared ? buildRelatedCoursesTableHtml(relatedCourses) : ""}
          <div style="margin-top:28px;padding-top:22px;border-top:1px solid #e4edf6;">
            <p style="margin:0;font-size:15px;line-height:1.85;color:#10233c;">Thanks and Regards,<br /><strong>CERTISURED</strong></p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildPaymentStatusEmailText({
  studentName,
  courseName,
  paidAmount,
  paymentDate,
  isCleared,
  remainingAmount,
  nextDueDate,
  relatedCourses,
  emailVariant,
}: {
  studentName?: string;
  courseName?: string;
  paidAmount?: number | null;
  paymentDate?: string | null;
  isCleared: boolean;
  remainingAmount?: number | null;
  nextDueDate?: string | null;
  relatedCourses: CourseRecord[];
  emailVariant: "payment_update" | "due_reminder";
}) {
  const isReminder = emailVariant === "due_reminder";
  return `Dear ${studentName || "Student"},

${isReminder ? `This is a reminder for your payment plan in ${courseName || "your course"}.` : `Thank you for your payment towards ${courseName || "your course"}.`}

Name: ${studentName || "Student"}
Course: ${courseName || "Selected Course"}
${isReminder ? "" : `Paid amount: ${formatCurrencyValue(paidAmount || 0)}
Paid date: ${formatDateLabel(paymentDate)}`}
Status: ${isCleared ? "Cleared" : (isReminder ? "Due Reminder" : "Payment Received")}
${isCleared ? "" : `Next pending amount: ${formatCurrencyValue(remainingAmount || 0)}
Due date: ${formatDateLabel(nextDueDate)}`}

${isCleared ? `Your payment plan is fully cleared.${buildRelatedCoursesText(relatedCourses)}` : ""}

Thanks and Regards,
CERTISURED`;
}

function buildCoursePayload(course: CourseRecord | string | null) {
  if (!course || typeof course === "string") {
    return {
      id: "",
      name: typeof course === "string" ? course : "",
      fee: "",
    };
  }

  return {
    id: course.id || "",
    name: course.course_name || "",
    fee: course.fee || "",
  };
}

function buildEmailAutomationPayload({
  agentType,
  actionType,
  templateKey,
  emailType,
  subject,
  html,
  text,
  enrollment,
  student,
  course,
  currentStage,
  metadata = {},
}: {
  agentType: string;
  actionType: string;
  templateKey: string;
  emailType: string;
  subject: string;
  html: string;
  text: string;
  enrollment: EnrollmentRecord;
  student: StudentRecord;
  course: CourseRecord | string | null;
  currentStage: string;
  metadata?: Record<string, unknown>;
}) {
  const coursePayload = buildCoursePayload(course);

  return {
    agentType,
    actionType,
    templateKey,
    channel: "email",
    provider: "gmail_smtp",
    emailType,
    subject,
    html,
    text,
    htmlMessage: html,
    textMessage: text,
    message: text,
    recipientEmail: normalizeEmailAddress(student.email || ""),
    enrollmentId: enrollment.id || "",
    currentStage: currentStage || enrollment.pipeline_stage || "",
    student: {
      id: student.id || "",
      name: student.full_name || "",
      email: student.email || "",
      phone: student.phone || "",
    },
    course: coursePayload,
    enrollment,
    metadata,
  };
}

function tokenizeName(value = "") {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function findRelatedCoursesForEnrollment(courseRecord: CourseRecord | null, courses: CourseRecord[]) {
  const currentTokens = new Set(tokenizeName(courseRecord?.course_name || ""));
  return courses
    .filter((item) => item.id !== courseRecord?.id)
    .map((item) => {
      const overlap = tokenizeName(item.course_name).reduce((count, token) => count + (currentTokens.has(token) ? 1 : 0), 0);
      const modeBonus = courseRecord?.mode && item.mode === courseRecord.mode ? 1 : 0;
      return { ...item, score: overlap + modeBonus };
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return String(left.course_name || "").localeCompare(String(right.course_name || ""));
    })
    .slice(0, 3)
    .map(({ score: _score, ...course }) => course);
}

function buildFollowUpDispatch(enrollment: EnrollmentRecord, student: StudentRecord) {
  const sentAt = new Date().toISOString();
  const leadDate = enrollment.lead_date || enrollment.created_at || getTodayIsoDate();
  const currentFollowUpDate = toIsoDate(enrollment.follow_up_date || getInitialEnquiryFollowUpDate(leadDate));
  const sentDate = toIsoDate(sentAt);
  const dueDateReached = currentFollowUpDate && compareIsoDates(sentDate, currentFollowUpDate) >= 0;
  const advancedFollowUpDate = dueDateReached
    ? getNextEnquiryFollowUpDate({
      leadDate,
      followUpDate: currentFollowUpDate,
    })
    : "";
  const nextFollowUpDate = advancedFollowUpDate || currentFollowUpDate || getInitialEnquiryFollowUpDate(leadDate);
  const nextFollowUpDateLabel = formatFollowUpDateLabel(nextFollowUpDate || getFinalEnquiryFollowUpDate(leadDate));
  const subject = "Admission Follow-up";
  const html = buildFollowUpEmailHtml({
    studentName: student.full_name,
  });
  const text = buildFollowUpEmailText({
    studentName: student.full_name,
  });

  return {
    logType: "Admission Follow-up",
    logStatus: "Sent",
    sentAt,
    nextFollowUpDate,
    payload: buildEmailAutomationPayload({
      agentType: "follow_up_agent",
      actionType: "send_follow_up_email",
      templateKey: "admission_follow_up",
      emailType: subject,
      subject,
      html,
      text,
      enrollment,
      student,
      course: enrollment.course_name || "",
      currentStage: enrollment.pipeline_stage || "",
      metadata: {
        sentAt,
        nextFollowUpDate,
        nextFollowUpDateLabel,
      },
    }),
    event: "email.follow_up",
    agentType: "follow_up_agent",
    actionType: "send_follow_up_email",
  };
}

function buildAdmissionConfirmationDispatch(enrollment: EnrollmentRecord, student: StudentRecord, courseRecord: CourseRecord | null) {
  const subject = "Admission Confirmation - CERTISURED";
  const html = buildAdmissionConfirmationEmailHtml({
    studentName: student.full_name,
    courseName: courseRecord?.course_name || enrollment.course_name || "",
    batchName: enrollment.batch,
    enrolledDate: enrollment.enrolled_date,
  });
  const text = buildAdmissionConfirmationEmailText({
    studentName: student.full_name,
    courseName: courseRecord?.course_name || enrollment.course_name || "",
    batchName: enrollment.batch,
    enrolledDate: enrollment.enrolled_date,
  });

  return {
    logType: "Admission Confirmation",
    logStatus: "Queued",
    sentAt: new Date().toISOString(),
    payload: buildEmailAutomationPayload({
      agentType: "enrollment_agent",
      actionType: "send_admission_confirmation_email",
      templateKey: "admission_confirmation",
      emailType: "Admission Confirmation",
      subject,
      html,
      text,
      enrollment,
      student,
      course: courseRecord,
      currentStage: enrollment.pipeline_stage || "",
    }),
    event: "email.admission_confirmation",
    agentType: "enrollment_agent",
    actionType: "send_admission_confirmation_email",
  };
}

function buildPaymentDispatch(
  enrollment: EnrollmentRecord,
  student: StudentRecord,
  courseRecord: CourseRecord | null,
  relatedCourses: CourseRecord[],
  emailVariant: "payment_update" | "due_reminder",
) {
  const totalFee = toNumberOrNull(enrollment.total_fee) ?? 0;
  const amountPaid = toNumberOrNull(enrollment.amount_paid) ?? 0;
  const remainingAmount = resolveRemainingAmount(totalFee, amountPaid) ?? 0;
  const isCleared = String(enrollment.payment_status || "").trim() === "Paid" || remainingAmount <= 0;
  const subject = isCleared
    ? "Payment Cleared - CERTISURED"
    : emailVariant === "due_reminder"
      ? "EMI Due Reminder - CERTISURED"
      : "Payment Received - CERTISURED";
  const paymentDate = enrollment.last_payment_date || enrollment.enrolled_date || enrollment.lead_date || "";
  const html = buildPaymentStatusEmailHtml({
    studentName: student.full_name,
    courseName: courseRecord?.course_name || enrollment.course_name || "",
    paidAmount: amountPaid,
    paymentDate,
    isCleared,
    remainingAmount,
    nextDueDate: enrollment.next_due_date,
    relatedCourses,
    emailVariant,
  });
  const text = buildPaymentStatusEmailText({
    studentName: student.full_name,
    courseName: courseRecord?.course_name || enrollment.course_name || "",
    paidAmount: amountPaid,
    paymentDate,
    isCleared,
    remainingAmount,
    nextDueDate: enrollment.next_due_date,
    relatedCourses,
    emailVariant,
  });

  return {
    logType: emailVariant === "due_reminder" ? "EMI Due Reminder" : "Payment Update",
    logStatus: "Queued",
    sentAt: new Date().toISOString(),
    payload: buildEmailAutomationPayload({
      agentType: "payment_agent",
      actionType: emailVariant === "due_reminder" ? "send_payment_reminder_email" : "send_payment_update_email",
      templateKey: emailVariant === "due_reminder" ? "payment_reminder" : "payment_update",
      emailType: subject,
      subject,
      html,
      text,
      enrollment,
      student,
      course: courseRecord,
      currentStage: enrollment.pipeline_stage || "",
      metadata: {
        relatedCourses,
        emailVariant,
        isCleared,
        paidAmount: amountPaid,
        paymentDate,
        remainingAmount,
        nextDueDate: enrollment.next_due_date || "",
      },
    }),
    event: emailVariant === "due_reminder" ? "email.payment_reminder" : "email.payment_update",
    agentType: "payment_agent",
    actionType: emailVariant === "due_reminder" ? "send_payment_reminder_email" : "send_payment_update_email",
  };
}

function readJsonResponse(text: string) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

function resolveSupabaseSecretKey() {
  const directKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || "";
  if (directKey) {
    return directKey;
  }

  const rawSecretKeys = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  if (rawSecretKeys) {
    try {
      const parsed = JSON.parse(rawSecretKeys) as Record<string, string>;
      const firstKey = Object.values(parsed).find((value) => typeof value === "string" && value.trim());
      if (firstKey) {
        return firstKey;
      }
    } catch {
      // Fall through to the error below.
    }
  }

  throw new Error("No Supabase secret key is available in the Edge Function environment.");
}

async function sendAutomationRequest(payload: Record<string, unknown>, event: string, agentType: string, actionType: string): Promise<SendResult> {
  const webhookUrl = String(Deno.env.get("N8N_WEBHOOK_URL") || "").trim();
  const webhookSecret = String(Deno.env.get("N8N_WEBHOOK_SECRET") || "").trim();

  if (!webhookUrl) {
    return {
      ok: false,
      message: "N8N_WEBHOOK_URL is not configured in Edge Function secrets.",
    };
  }

  const requestBody = {
    event,
    agentType,
    actionType,
    flowName: "email_notification",
    source: "EnrollEase AI",
    timestamp: new Date().toISOString(),
    payload,
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-enrollease-event": event,
      "x-enrollease-agent": agentType,
      "x-enrollease-action": actionType,
      ...(webhookSecret ? { "x-enrollease-secret": webhookSecret } : {}),
    },
    body: JSON.stringify(requestBody),
  });

  const rawText = await response.text();
  const data = readJsonResponse(rawText);

  if (!response.ok) {
    const message = typeof data === "object" && data && "message" in data && data.message
      ? String(data.message)
      : `n8n returned ${response.status}`;
    return {
      ok: false,
      message,
    };
  }

  return {
    ok: true,
    message: typeof data === "object" && data && "message" in data && data.message
      ? String(data.message)
      : "Automation workflow completed successfully.",
  };
}

Deno.serve(async (request) => {
  try {
    const expectedSecret = String(Deno.env.get("AUTOMATION_DISPATCH_SECRET") || "").trim();
    const providedSecret = String(
      request.headers.get("x-automation-dispatch-secret")
      || request.headers.get("x-enrollease-cron-secret")
      || "",
    ).trim();

    if (!expectedSecret) {
      return response(500, {
        ok: false,
        message: "AUTOMATION_DISPATCH_SECRET is not configured.",
      });
    }

    if (!providedSecret || providedSecret !== expectedSecret) {
      return response(401, {
        ok: false,
        message: "Invalid automation dispatch secret.",
      });
    }

    const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").trim();
    const supabaseSecretKey = resolveSupabaseSecretKey();
    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const todayIsoDate = getTodayIsoDate();
    const [studentsResult, coursesResult, enrollmentsResult, emailLogsResult] = await Promise.all([
      supabaseAdmin
        .from("students")
        .select("id, full_name, email, phone"),
      supabaseAdmin
        .from("courses")
        .select("id, course_name, fee, mode"),
      supabaseAdmin
        .from("enrollments")
        .select("id, student_id, course_id, course_name, batch, pipeline_stage, lead_date, enrolled_date, follow_up_date, total_fee, amount_paid, next_due_date, payment_status, verification_status, remarks, dropout_reason, last_payment_date, created_at"),
      supabaseAdmin
        .from("email_logs")
        .select("enrollment_id, email_type, status, sent_at")
        .order("sent_at", { ascending: false }),
    ]);

    if (studentsResult.error) throw studentsResult.error;
    if (coursesResult.error) throw coursesResult.error;
    if (enrollmentsResult.error) throw enrollmentsResult.error;
    if (emailLogsResult.error) throw emailLogsResult.error;

    const students = (studentsResult.data || []) as StudentRecord[];
    const courses = (coursesResult.data || []) as CourseRecord[];
    const enrollments = (enrollmentsResult.data || []) as EnrollmentRecord[];
    const emailLogs = (emailLogsResult.data || []) as EmailLogRecord[];

    const studentById = new Map(students.map((student) => [student.id, student]));
    const courseById = new Map(courses.map((course) => [course.id, course]));

    const dispatched: string[] = [];
    const failures: Array<{ enrollmentId: string; emailType: string; message: string }> = [];

    async function persistEmailLog(log: { enrollment_id: string; email_type: string; status: string; sent_at: string }) {
      const { error } = await supabaseAdmin.from("email_logs").insert(log);
      if (error) {
        throw error;
      }
      emailLogs.unshift(log);
    }

    async function persistFailureLogIfNeeded(enrollmentId: string, emailType: string, message: string) {
      if (hasFailureLogToday(emailLogs, enrollmentId, emailType, todayIsoDate)) {
        return;
      }

      try {
        await persistEmailLog({
          enrollment_id: enrollmentId,
          email_type: emailType,
          status: "Failed",
          sent_at: new Date().toISOString(),
        });
      } catch {
        // Avoid failing the whole run if the fallback log cannot be inserted.
      }

      failures.push({ enrollmentId, emailType, message });
    }

    async function dispatchOne(args: {
      enrollment: EnrollmentRecord;
      student: StudentRecord;
      course: CourseRecord | null;
      kind: "follow_up" | "admission_confirmation" | "payment_update" | "payment_reminder";
    }) {
      const { enrollment, student, course, kind } = args;
      const relatedCourses = kind === "payment_update" || kind === "payment_reminder"
        ? findRelatedCoursesForEnrollment(course, courses)
        : [];
      const dispatch = kind === "follow_up"
        ? buildFollowUpDispatch(enrollment, student)
        : kind === "admission_confirmation"
          ? buildAdmissionConfirmationDispatch(enrollment, student, course)
          : buildPaymentDispatch(
            enrollment,
            student,
            course,
            relatedCourses,
            kind === "payment_reminder" ? "due_reminder" : "payment_update",
          );

      const sendResult = await sendAutomationRequest(
        dispatch.payload,
        dispatch.event,
        dispatch.agentType,
        dispatch.actionType,
      );

      if (!sendResult.ok) {
        await persistFailureLogIfNeeded(enrollment.id, dispatch.logType, sendResult.message);
        return;
      }

      await persistEmailLog({
        enrollment_id: enrollment.id,
        email_type: dispatch.logType,
        status: dispatch.logStatus,
        sent_at: dispatch.sentAt,
      });

      if (kind === "follow_up" && dispatch.nextFollowUpDate) {
        const { error } = await supabaseAdmin
          .from("enrollments")
          .update({ follow_up_date: dispatch.nextFollowUpDate })
          .eq("id", enrollment.id);
        if (error) {
          throw error;
        }
      }

      dispatched.push(`${dispatch.logType}:${enrollment.id}`);
    }

    for (const enrollment of enrollments) {
      const student = studentById.get(enrollment.student_id);
      if (!student || !hasReachableStudentEmail(student.email || "")) {
        continue;
      }

      const course = (enrollment.course_id ? courseById.get(enrollment.course_id) : null)
        || courses.find((item) => item.course_name === enrollment.course_name)
        || null;

      if (isEnquiryStage(enrollment.pipeline_stage || "")) {
        const leadDate = enrollment.lead_date || enrollment.created_at || "";
        const requiredCycles = getRequiredEnquiryFollowUpCycles({
          leadDate,
          today: todayIsoDate,
        });
        const successfulFollowUpCount = Math.min(
          getSuccessfulFollowUpCount(emailLogs, enrollment.id),
          ENQUIRY_MAX_FOLLOW_UP_CYCLES,
        );

        if (requiredCycles > 0 && successfulFollowUpCount < requiredCycles) {
          await dispatchOne({
            enrollment,
            student,
            course,
            kind: "follow_up",
          });
          continue;
        }
      }

      if (!isEnrolledStage(enrollment.pipeline_stage || "")) {
        continue;
      }

      if (!getEnrollmentLogs(emailLogs, enrollment.id, isAdmissionConfirmationEmailLog).length) {
        await dispatchOne({
          enrollment,
          student,
          course,
          kind: "admission_confirmation",
        });
      }

      const amountPaid = toNumberOrNull(enrollment.amount_paid) ?? 0;
      if (amountPaid > 0) {
        const paymentUpdateAnchorDate = enrollment.last_payment_date || enrollment.enrolled_date || enrollment.lead_date || "";
        if (
          paymentUpdateAnchorDate
          && !hasSuccessfulEmailOnOrAfter(emailLogs, enrollment.id, isPaymentUpdateEmailLog, paymentUpdateAnchorDate)
        ) {
          await dispatchOne({
            enrollment,
            student,
            course,
            kind: "payment_update",
          });
        }
      }

      const nextDueDate = toIsoDate(enrollment.next_due_date || "");
      const remainingAmount = resolveRemainingAmount(enrollment.total_fee, enrollment.amount_paid) ?? 0;
      if (
        nextDueDate
        && compareIsoDates(nextDueDate, todayIsoDate) <= 0
        && remainingAmount > 0
        && String(enrollment.payment_status || "").trim() !== "Paid"
        && !hasSuccessfulEmailOnOrAfter(emailLogs, enrollment.id, isPaymentReminderEmailLog, nextDueDate)
      ) {
        await dispatchOne({
          enrollment,
          student,
          course,
          kind: "payment_reminder",
        });
      }
    }

    return response(200, {
      ok: true,
      dispatchedCount: dispatched.length,
      dispatched,
      failures,
      scannedEnrollments: enrollments.length,
      evaluatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return response(500, {
      ok: false,
      message: error instanceof Error ? error.message : "Unexpected automation dispatch failure.",
    });
  }
});

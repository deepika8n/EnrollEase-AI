import { triggerAutomation } from "./automationService";
import { generateEnrollmentPdfBlob } from "./pdfServiceFixed";
import { toIsoDate } from "../utils/dateMath";
import { inferPaymentPlan, isEmiPlan, resolveRemainingAmount, toNumberOrNull } from "../utils/paymentHelpers";

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

function slugifyFileSegment(value = "", fallback = "student-profile") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function shouldAttachStudentProfilePdf(emailType = "", options = {}) {
  if (typeof options.attachProfilePdf === "boolean") {
    return options.attachProfilePdf;
  }

  const normalizedType = String(emailType || "").trim().toLowerCase();
  return normalizedType === "student profile update" || normalizedType === "profile send mail";
}

async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return window.btoa(binary);
}

async function buildStudentProfilePdfAttachment({ student, course, enrollment, documents = [], instituteName = "CERTISURED" }) {
  const pdfBlob = await generateEnrollmentPdfBlob({
    instituteName,
    student,
    course,
    enrollment,
    documents,
  });

  return {
    fieldName: "student_profile_pdf",
    fileName: `${slugifyFileSegment(student?.full_name, "student-profile")}-profile.pdf`,
    mimeType: "application/pdf",
    contentBase64: await blobToBase64(pdfBlob),
    contentType: "application/pdf",
    encoding: "base64",
  };
}

function buildCertisuredHeader({ title, subtitle = "" }) {
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

function buildFollowUpEmailHtml({ studentName, nextFollowUpDateLabel }) {
  const safeStudentName = escapeHtml(studentName || "Student");
  const safeNextFollowUpDate = escapeHtml(nextFollowUpDateLabel || "");

  return `
    <div style="margin:0;padding:24px;background:#eef4fb;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#10233c;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dbe8f7;border-radius:28px;overflow:hidden;box-shadow:0 22px 50px rgba(15,23,42,0.08);">
        ${buildCertisuredHeader({ title: "Admission Follow-up" })}

        <div style="padding:32px;">
          <div style="display:inline-block;padding:10px 14px;border-radius:999px;background:#edf5ff;border:1px solid #d4e5fb;color:#1d5ea8;font-size:12px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;">
            Admission Follow-up
          </div>

          <p style="margin:24px 0 0;font-size:16px;line-height:1.8;">Dear ${safeStudentName},</p>
          <p style="margin:18px 0 0;font-size:15px;line-height:1.85;color:#42556d;">
            We hope you are doing well.
          </p>
          <p style="margin:14px 0 0;font-size:15px;line-height:1.85;color:#42556d;">
            This is a friendly reminder regarding your admission enquiry with CERTISURED.
          </p>
          <p style="margin:14px 0 0;font-size:15px;line-height:1.85;color:#42556d;">
            Our admissions team noticed that your enquiry is still pending.
          </p>

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
            Our admissions team is happy to help. Please contact us at <strong>8976543209</strong> or reply to this email.
          </div>

          <p style="margin:24px 0 0;font-size:15px;line-height:1.85;color:#42556d;">
            We look forward to welcoming you.
          </p>

          <div style="margin-top:28px;padding-top:22px;border-top:1px solid #e4edf6;">
            <p style="margin:0;font-size:15px;line-height:1.85;color:#10233c;">
              Best Regards,<br />
              <strong>CERTISURED</strong>
            </p>
          </div>
        </div>

      </div>
    </div>
  `;
}

function buildFollowUpEmailText({ studentName, nextFollowUpDateLabel }) {
  return `Dear ${studentName || "Student"},

We hope you are doing well.

This is a friendly reminder regarding your admission enquiry with CERTISURED.
Our admissions team noticed that your enquiry is still pending.

If you need any assistance regarding course details, fees, batch timing, scholarships, documents, or payment, our admissions team is happy to help.

Please contact us at 8976543209 or reply to this email.

We look forward to welcoming you.

Best Regards,
CERTISURED`;
}

function buildGenericProfileEmailHtml({
  studentName,
  courseName,
  batchName,
  currentStage,
}) {
  const safeStudentName = escapeHtml(studentName || "Student");
  const safeCourseName = escapeHtml(courseName || "Selected Course");
  const safeBatchName = escapeHtml(batchName || "Batch details will be shared soon");
  const safeCurrentStage = escapeHtml(currentStage || "Active");

  return `
    <div style="margin:0;padding:24px;background:#eef4fb;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#10233c;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dbe8f7;border-radius:28px;overflow:hidden;box-shadow:0 22px 50px rgba(15,23,42,0.08);">
        ${buildCertisuredHeader({ title: "Student Profile Update", subtitle: "Admissions Communication" })}

        <div style="padding:32px;">
          <p style="margin:0;font-size:16px;line-height:1.8;">Dear ${safeStudentName},</p>
          <p style="margin:18px 0 0;font-size:15px;line-height:1.85;color:#42556d;">
            We are sharing a quick update from CERTISURED regarding your admission journey.
          </p>

          <div style="margin-top:24px;padding:22px 24px;border-radius:22px;background:#f8fbff;border:1px solid #dce9f7;">
            <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#163459;">Current profile summary</p>
            <div style="font-size:15px;line-height:1.9;color:#42556d;">
              <strong>Name:</strong> ${safeStudentName}<br />
              <strong>Course:</strong> ${safeCourseName}<br />
              <strong>Batch:</strong> ${safeBatchName}<br />
              <strong>Status:</strong> ${safeCurrentStage}
            </div>
          </div>

          <div style="margin-top:24px;padding:18px 20px;border-radius:20px;background:#f3fcf6;border:1px solid #cfeeda;color:#167647;font-size:14px;line-height:1.8;">
            If you have any questions about admission, documents, schedule, or payments, simply reply to this email and our team will help you.
          </div>

          <div style="margin-top:28px;padding-top:22px;border-top:1px solid #e4edf6;">
            <p style="margin:0;font-size:15px;line-height:1.85;color:#10233c;">
              Regards,<br />
              <strong>CERTISURED Team</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildGenericProfileEmailText({
  studentName,
  courseName,
  batchName,
  currentStage,
}) {
  return `Dear ${studentName || "Student"},

We are sharing a quick update from CERTISURED regarding your admission journey.

Current profile summary
Name: ${studentName || "Student"}
Course: ${courseName || "Selected Course"}
Batch: ${batchName || "Batch details will be shared soon"}
Status: ${currentStage || "Active"}

If you have any questions about admission, documents, schedule, or payments, simply reply to this email and our team will help you.

Regards,
CERTISURED Team`;
}

function buildAdmissionConfirmationEmailHtml({
  studentName,
  courseName,
  batchName,
  enrolledDate,
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
          <p style="margin:18px 0 0;font-size:15px;line-height:1.85;color:#42556d;">
            Your admission has been successfully confirmed with <strong>CERTISURED</strong>.
          </p>

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
            <p style="margin:0;font-size:15px;line-height:1.85;color:#10233c;">
              Best Regards,<br />
              <strong>CERTISURED</strong>
            </p>
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

function formatCurrencyValue(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDateLabel(value) {
  const iso = toIsoDate(value);
  if (!iso) return "N/A";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(`${iso}T00:00:00`));
}

function buildRelatedCoursesTableHtml(relatedCourses = []) {
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

function buildRelatedCoursesText(relatedCourses = []) {
  if (!relatedCourses.length) return "";
  const lines = relatedCourses.map((course) => `- ${course.course_name || "Course"}: ${formatCurrencyValue(course.fee || 0)}`);
  return `\nRelated CERTISURED courses:\n${lines.join("\n")}`;
}

function buildCoursePayload(course) {
  if (!course || typeof course !== "object") {
    return {
      id: "",
      name: typeof course === "string" ? course : "",
      fee: "",
    };
  }

  return {
    id: course.id || "",
    name: course.course_name || course.name || "",
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
  attachments = [],
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
    recipientEmail: normalizeEmailAddress(student?.email || ""),
    enrollmentId: enrollment?.id || "",
    currentStage: currentStage || enrollment?.pipeline_stage || "",
    student: {
      id: student?.id || "",
      name: student?.full_name || student?.name || "",
      email: student?.email || "",
      phone: student?.phone || "",
    },
    course: coursePayload,
    enrollment,
    metadata,
    attachments,
    hasAttachments: attachments.length > 0,
    attachmentCount: attachments.length,
    attachment: attachments[0] || null,
    profilePdfAttachment: attachments[0] || null,
  };
}

function resolveGenericEmailConfig(emailType, enrollment, options = {}) {
  const normalizedType = String(emailType || "").trim().toLowerCase();
  const studentName = options.student?.full_name || options.student?.name || "Student";
  const courseName = options.course?.course_name || options.course?.name || options.course || enrollment?.course_name || "";
  const batchName = enrollment?.batch || "";
  const currentStage = options.currentStage || enrollment?.pipeline_stage || "Active";

  if (normalizedType === "enrollment confirmed" || normalizedType === "admission confirmation") {
    return {
      agentType: "enrollment_agent",
      actionType: "send_admission_confirmation_email",
      event: "email.admission_confirmation",
      templateKey: "admission_confirmation",
      subject: "Admission Confirmation - CERTISURED",
      html: buildAdmissionConfirmationEmailHtml({
        studentName,
        courseName,
        batchName,
        enrolledDate: enrollment?.enrolled_date || "",
      }),
      text: buildAdmissionConfirmationEmailText({
        studentName,
        courseName,
        batchName,
        enrolledDate: enrollment?.enrolled_date || "",
      }),
    };
  }

  return {
    agentType: "email_agent",
    actionType: "dispatch_email",
    event: "email.notification",
    templateKey: "generic_notification",
    subject: options.subject || `Update from CERTISURED - ${courseName || currentStage}`,
    html: options.html || buildGenericProfileEmailHtml({
      studentName,
      courseName,
      batchName,
      currentStage,
    }),
    text: options.text || buildGenericProfileEmailText({
      studentName,
      courseName,
      batchName,
      currentStage,
    }),
  };
}

function buildPaymentStatusEmailHtml({
  studentName,
  courseName,
  paidAmount,
  paymentDate,
  isCleared,
  remainingAmount,
  nextDueDate,
  relatedCourses = [],
  emailVariant = "payment_update",
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
        <strong>Next pending amount:</strong> ${escapeHtml(formatCurrencyValue(remainingAmount))}<br />
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
          <p style="margin:14px 0 0;font-size:15px;line-height:1.85;color:#42556d;">
            ${escapeHtml(statusNote)}
          </p>

          <div style="margin-top:24px;padding:22px 24px;border-radius:22px;background:#f8fbff;border:1px solid #dce9f7;">
            <p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#163459;">${isReminder ? "Payment reminder" : "Payment summary"}</p>
            <div style="font-size:15px;line-height:1.9;color:#42556d;">
              <strong>Name:</strong> ${safeStudentName}<br />
              <strong>Course:</strong> ${safeCourseName}<br />
              ${isReminder ? "" : `<strong>Paid amount:</strong> ${escapeHtml(formatCurrencyValue(paidAmount))}<br />
              <strong>Paid date:</strong> ${escapeHtml(formatDateLabel(paymentDate))}`}
            </div>
          </div>

          ${pendingPanel}
          ${isCleared ? buildRelatedCoursesTableHtml(relatedCourses) : ""}

          <div style="margin-top:28px;padding-top:22px;border-top:1px solid #e4edf6;">
            <p style="margin:0;font-size:15px;line-height:1.85;color:#10233c;">
              Thanks and Regards,<br />
              <strong>CERTISURED</strong>
            </p>
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
  relatedCourses = [],
  emailVariant = "payment_update",
}) {
  const isReminder = emailVariant === "due_reminder";
  return `Dear ${studentName || "Student"},

${isReminder ? `This is a reminder for your payment plan in ${courseName || "your course"}.` : `Thank you for your payment towards ${courseName || "your course"}.`}

Name: ${studentName || "Student"}
Course: ${courseName || "Selected Course"}
${isReminder ? "" : `Paid amount: ${formatCurrencyValue(paidAmount)}
Paid date: ${formatDateLabel(paymentDate)}`}
Status: ${isCleared ? "Cleared" : (isReminder ? "Due Reminder" : "Payment Received")}
${isCleared ? "" : `Next pending amount: ${formatCurrencyValue(remainingAmount)}
Due date: ${formatDateLabel(nextDueDate)}`}

${isCleared ? `Your payment plan is fully cleared.${buildRelatedCoursesText(relatedCourses)}` : ""}

Thanks and Regards,
CERTISURED`;
}

export async function sendEmailTrigger(emailType, enrollment, options = {}) {
  const student = options.student || {};
  const genericConfig = resolveGenericEmailConfig(emailType, enrollment, options);
  const attachments = shouldAttachStudentProfilePdf(emailType, options)
    ? [await buildStudentProfilePdfAttachment({
      student,
      course: options.course || enrollment?.course_name || "",
      enrollment,
      documents: options.documents || [],
      instituteName: options.instituteName || "CERTISURED",
    })]
    : [];
  const automationPayload = {
    ...buildEmailAutomationPayload({
      agentType: genericConfig.agentType,
      actionType: genericConfig.actionType,
      templateKey: genericConfig.templateKey,
      emailType,
      subject: genericConfig.subject,
      html: genericConfig.html,
      text: genericConfig.text,
      enrollment,
      student,
      course: options.course || enrollment.course_name || "",
      currentStage: options.currentStage || enrollment.pipeline_stage || "",
      attachments,
    }),
    student: {
      id: student?.id || "",
      full_name: student?.full_name || student?.name || "",
      email: student?.email || "",
      phone: student?.phone || "",
    },
  };
  const automationResult = await triggerAutomation("email_notification", automationPayload, {
    event: genericConfig.event,
    agentType: genericConfig.agentType,
    actionType: genericConfig.actionType,
  });

  if (!automationResult.success) {
    return {
      ok: false,
      status: "Failed",
      message: automationResult.message || `Unable to trigger "${emailType}".`,
      automationResult,
    };
  }

  return {
    ok: true,
    status: "Queued",
    message: `Email trigger executed for "${emailType}" and enrollment ${enrollment.id}.`,
    automationResult,
  };
}

export async function sendAdmissionFollowUpEmail({ enrollment, student, sentAt, nextFollowUpDate, nextFollowUpDateLabel }) {
  const subject = "Admission Follow-up";
  const html = buildFollowUpEmailHtml({
    studentName: student?.full_name,
    nextFollowUpDateLabel,
  });
  const text = buildFollowUpEmailText({
    studentName: student?.full_name,
    nextFollowUpDateLabel,
  });

  const automationPayload = buildEmailAutomationPayload({
    agentType: "follow_up_agent",
    actionType: "send_follow_up_email",
    templateKey: "admission_follow_up",
    emailType: subject,
    subject,
    html,
    text,
    enrollment,
    student,
    course: enrollment?.course_name || "",
    currentStage: enrollment?.pipeline_stage || "",
    metadata: {
      sentAt,
      nextFollowUpDate,
      nextFollowUpDateLabel,
    },
  });
  const automationResult = await triggerAutomation("email_notification", automationPayload, {
    event: "email.follow_up",
    agentType: "follow_up_agent",
    actionType: "send_follow_up_email",
  });

  if (automationResult.success === false) {
    return {
      ok: false,
      status: "Failed",
      message: automationResult.message || "Follow-up email could not be sent.",
      automationResult,
    };
  }

  return {
    ok: true,
    status: "Queued",
    subject,
    html,
    text,
    message: "Follow-up email queued successfully.",
    automationResult,
  };
}

export async function sendPaymentStatusEmail({
  enrollment,
  student,
  course,
  relatedCourses = [],
  paidAmount,
  paymentDate,
  emailVariant = "payment_update",
}) {
  const totalFee = toNumberOrNull(enrollment?.total_fee) ?? 0;
  const amountPaid = toNumberOrNull(enrollment?.amount_paid) ?? 0;
  const normalizedPaidAmount = toNumberOrNull(paidAmount) ?? amountPaid;
  const remainingAmount = resolveRemainingAmount(totalFee, amountPaid) ?? 0;
  const paymentPlan = inferPaymentPlan({
    paymentPlan: enrollment?.payment_plan || "",
    installmentsPlanned: enrollment?.installments_planned || 0,
    history: enrollment?.payment_history || [],
    amountPaid,
  });
  const installmentCount = Number(enrollment?.installments_planned) || 0;
  const installmentsPaid = Number(enrollment?.installments_paid) || 0;
  const isCleared =
    String(enrollment?.payment_status || "").trim() === "Paid"
    || (!isEmiPlan(paymentPlan) && remainingAmount <= 0)
    || (isEmiPlan(paymentPlan) && installmentCount > 0 && installmentsPaid >= installmentCount && remainingAmount <= 0);

  const subject = isCleared
    ? "Payment Cleared - CERTISURED"
    : emailVariant === "due_reminder"
      ? "EMI Due Reminder - CERTISURED"
      : "Payment Received - CERTISURED";
  const html = buildPaymentStatusEmailHtml({
    studentName: student?.full_name,
    courseName: course?.course_name || enrollment?.course_name || "",
    paidAmount: normalizedPaidAmount,
    paymentDate: paymentDate || enrollment?.last_payment_date || "",
    isCleared,
    remainingAmount,
    nextDueDate: enrollment?.next_due_date || "",
    relatedCourses,
    emailVariant,
  });
  const text = buildPaymentStatusEmailText({
    studentName: student?.full_name,
    courseName: course?.course_name || enrollment?.course_name || "",
    paidAmount: normalizedPaidAmount,
    paymentDate: paymentDate || enrollment?.last_payment_date || "",
    isCleared,
    remainingAmount,
    nextDueDate: enrollment?.next_due_date || "",
    relatedCourses,
    emailVariant,
  });

  const automationPayload = buildEmailAutomationPayload({
    agentType: "payment_agent",
    actionType: emailVariant === "due_reminder" ? "send_payment_reminder_email" : "send_payment_update_email",
    templateKey: emailVariant === "due_reminder" ? "payment_reminder" : "payment_update",
    emailType: subject,
    subject,
    html,
    text,
    enrollment,
    student,
    course: course || enrollment?.course_name || "",
    currentStage: enrollment?.pipeline_stage || "",
    metadata: {
      relatedCourses,
      emailVariant,
      isCleared,
      paidAmount: normalizedPaidAmount,
      paymentDate: paymentDate || enrollment?.last_payment_date || "",
      remainingAmount,
      nextDueDate: enrollment?.next_due_date || "",
    },
  });
  const automationResult = await triggerAutomation("email_notification", automationPayload, {
    event: emailVariant === "due_reminder" ? "email.payment_reminder" : "email.payment_update",
    agentType: "payment_agent",
    actionType: emailVariant === "due_reminder" ? "send_payment_reminder_email" : "send_payment_update_email",
  });

  if (!automationResult.success) {
    return {
      ok: false,
      status: "Failed",
      message: automationResult.message || "Payment email could not be sent.",
      automationResult,
      subject,
    };
  }

  return {
    ok: true,
    status: "Queued",
    message: "Payment email queued successfully.",
    automationResult,
    subject,
  };
}

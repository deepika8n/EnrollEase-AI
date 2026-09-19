function escapeLifecycleHtml(value = "") { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }

export function buildStudentAckEmail({ studentName, courseName }: { studentName: string; courseName: string }) {
  return {
    subject: "We received your enquiry - CERTISURED",
    html: `
      <div style="margin:0;padding:24px;background:#eef4fb;font-family:Arial,sans-serif;color:#10233c;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dbe8f7;border-radius:24px;overflow:hidden;">
          <div style="padding:28px 32px;background:#0b3558;color:#ffffff;">
            <div style="font-size:12px;letter-spacing:0.26em;text-transform:uppercase;font-weight:700;opacity:0.78;">CERTISURED</div>
            <div style="margin-top:8px;font-size:28px;font-weight:800;">Enquiry Received</div>
          </div>
          <div style="padding:32px;">
            <p>Dear ${escapeLifecycleHtml(studentName || "Student")},</p>
            <p>Thank you for your interest in <strong>CERTISURED</strong>.</p>
            <p>We have received your enquiry${courseName ? ` for <strong>${escapeLifecycleHtml(courseName)}</strong>` : ""} and our admissions team will review it shortly.</p>
            <p>Our admissions team will send your student enrollment form after reviewing your enquiry.</p>
            <p style="margin-top:28px;">Regards,<br /><strong>CERTISURED Admissions Team</strong></p>
          </div>
        </div>
      </div>
    `,
    text: `Dear ${studentName || "Student"},

Thank you for your interest in CERTISURED.

We have received your enquiry${courseName ? ` for ${courseName}` : ""} and our admissions team will review it shortly.

Our admissions team will send your student enrollment form after reviewing your enquiry.

Regards,
CERTISURED Admissions Team`,
  };
}

export function buildAdminNotificationEmail({
  studentName,
  email,
  phone,
  courseName,
  remarks,
}: {
  studentName: string;
  email: string;
  phone: string;
  courseName: string;
  remarks: string;
}) {
  return {
    subject: `New enquiry received - ${studentName || "Student"}`,
    html: `
      <div style="margin:0;padding:24px;background:#eef4fb;font-family:Arial,sans-serif;color:#10233c;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dbe8f7;border-radius:24px;overflow:hidden;">
          <div style="padding:28px 32px;background:#0b3558;color:#ffffff;">
            <div style="font-size:12px;letter-spacing:0.26em;text-transform:uppercase;font-weight:700;opacity:0.78;">CERTISURED</div>
            <div style="margin-top:8px;font-size:28px;font-weight:800;">New Enquiry</div>
          </div>
          <div style="padding:32px;">
            <p>A new enquiry has been submitted.</p>
            <p><strong>Name:</strong> ${escapeLifecycleHtml(studentName)}</p>
            <p><strong>Email:</strong> ${escapeLifecycleHtml(email)}</p>
            <p><strong>Phone:</strong> ${escapeLifecycleHtml(phone)}</p>
            <p><strong>Course:</strong> ${escapeLifecycleHtml(courseName || "Not selected")}</p>
            <p><strong>Remarks:</strong> ${escapeLifecycleHtml(remarks || "None")}</p>
          </div>
        </div>
      </div>
    `,
    text: `New enquiry received

Name: ${studentName}
Email: ${email}
Phone: ${phone}
Course: ${courseName || "Not selected"}
Remarks: ${remarks || "None"}`,
  };
}


export function buildStudentSubmissionAckEmail(studentName = "", courseName = "") {
  return {
    subject: "Enrollment form submitted - CERTISURED",
    html: `
      <div style="margin:0;padding:24px;background:#eef4fb;font-family:Arial,sans-serif;color:#10233c;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dbe8f7;border-radius:24px;overflow:hidden;">
          <div style="padding:28px 32px;background:#0b3558;color:#ffffff;">
            <div style="font-size:12px;letter-spacing:0.26em;text-transform:uppercase;font-weight:700;opacity:0.78;">CERTISURED</div>
            <div style="margin-top:8px;font-size:28px;font-weight:800;">Form Submitted</div>
          </div>
          <div style="padding:32px;">
            <p>Dear ${escapeLifecycleHtml(studentName || "Student")},</p>
            <p>Your enrollment form${courseName ? ` for <strong>${escapeLifecycleHtml(courseName)}</strong>` : ""} has been submitted successfully.</p>
            <p>Our admissions team will review your details and uploaded documents, then update you with the next step.</p>
            <p style="margin-top:28px;">Regards,<br /><strong>CERTISURED Admissions Team</strong></p>
          </div>
        </div>
      </div>
    `,
    text: `Dear ${studentName || "Student"},

Your enrollment form${courseName ? ` for ${courseName}` : ""} has been submitted successfully.

Our admissions team will review your details and uploaded documents, then update you with the next step.

Regards,
CERTISURED Admissions Team`,
  };
}

export function buildAdminSubmissionEmail(studentName = "", studentEmail = "", courseName = "") {
  return {
    subject: `Student enrollment form submitted - ${studentName || "Student"}`,
    html: `
      <div style="margin:0;padding:24px;background:#eef4fb;font-family:Arial,sans-serif;color:#10233c;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dbe8f7;border-radius:24px;overflow:hidden;">
          <div style="padding:28px 32px;background:#0b3558;color:#ffffff;">
            <div style="font-size:12px;letter-spacing:0.26em;text-transform:uppercase;font-weight:700;opacity:0.78;">CERTISURED</div>
            <div style="margin-top:8px;font-size:28px;font-weight:800;">Student Form Submitted</div>
          </div>
          <div style="padding:32px;">
            <p>A student has completed the enrollment form.</p>
            <p><strong>Name:</strong> ${escapeLifecycleHtml(studentName || "Student")}</p>
            <p><strong>Email:</strong> ${escapeLifecycleHtml(studentEmail || "")}</p>
            <p><strong>Course:</strong> ${escapeLifecycleHtml(courseName || "Selected Course")}</p>
            <p>Please review the student profile and documents in EnrollEase.</p>
          </div>
        </div>
      </div>
    `,
    text: `Student enrollment form submitted

Name: ${studentName || "Student"}
Email: ${studentEmail || ""}
Course: ${courseName || "Selected Course"}

Please review the student profile and documents in EnrollEase.`,
  };
}

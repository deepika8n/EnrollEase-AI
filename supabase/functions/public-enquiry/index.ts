import { createClient } from "npm:@supabase/supabase-js@2";
import { getAdminNotificationEmail, sendEmail } from "../_shared/email.ts";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function sanitize(value: unknown) {
  return String(value || "").trim();
}

function toIsoDate(value: string | Date | null | undefined) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const safeValue = String(value).trim();
  if (!safeValue) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(safeValue)) return safeValue;
  const parsed = new Date(safeValue);
  return Number.isNaN(parsed.valueOf()) ? "" : parsed.toISOString().slice(0, 10);
}

function addDays(isoDate = "", days = 0) {
  const nextDate = new Date(`${isoDate}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + Number(days || 0));
  return nextDate.toISOString().slice(0, 10);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildStudentAckEmail({ studentName, courseName }: { studentName: string; courseName: string }) {
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
            <p>Dear ${escapeHtml(studentName || "Student")},</p>
            <p>Thank you for your interest in <strong>CERTISURED</strong>.</p>
            <p>We have received your enquiry${courseName ? ` for <strong>${escapeHtml(courseName)}</strong>` : ""} and our admissions team will review it shortly.</p>
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

function buildAdminNotificationEmail({
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
            <p><strong>Name:</strong> ${escapeHtml(studentName)}</p>
            <p><strong>Email:</strong> ${escapeHtml(email)}</p>
            <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
            <p><strong>Course:</strong> ${escapeHtml(courseName || "Not selected")}</p>
            <p><strong>Remarks:</strong> ${escapeHtml(remarks || "None")}</p>
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: JSON_HEADERS });
  }

  try {
    const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").trim();
    const serviceRoleKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
    if (!supabaseUrl || !serviceRoleKey) {
      return response(500, { error: "Supabase server configuration is missing." });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await request.json().catch(() => ({}));
    const studentInput = body?.student && typeof body.student === "object" ? body.student : {};
    const enrollmentInput = body?.enrollment && typeof body.enrollment === "object" ? body.enrollment : {};

    const fullName = sanitize(studentInput.full_name);
    const email = normalizeEmail(studentInput.email);
    const phone = sanitize(studentInput.phone);
    const courseId = sanitize(enrollmentInput.course_id);
    const courseNameInput = sanitize(enrollmentInput.course_name);
    const remarks = sanitize(enrollmentInput.remarks);
    const leadDate = toIsoDate(enrollmentInput.lead_date || new Date());

    if (!fullName || !email || !phone) {
      return response(400, { error: "Full name, email, and phone are required." });
    }

    const followUpDate = addDays(leadDate, 3);
    const { data: courses, error: courseError } = await adminClient
      .from("courses")
      .select("id, course_name, batch")
      .order("course_name", { ascending: true });
    if (courseError) {
      return response(500, { error: courseError.message || "Unable to load courses." });
    }

    const selectedCourse = (courses || []).find((course) => (
      (courseId && course.id === courseId)
      || (courseNameInput && String(course.course_name || "").trim().toLowerCase() === courseNameInput.toLowerCase())
    )) || null;

    const studentPayload = {
      full_name: fullName,
      email,
      phone,
      current_activity: sanitize(studentInput.current_activity),
      place: sanitize(studentInput.place),
      lead_source: "Public Enquiry Form",
    };

    const { data: existingStudent, error: existingStudentError } = await adminClient
      .from("students")
      .select("*")
      .eq("email", email)
      .maybeSingle();
    if (existingStudentError) {
      return response(500, { error: existingStudentError.message || "Unable to verify the student record." });
    }

    let studentRecord = existingStudent;
    if (studentRecord) {
      const { data: updatedStudent, error: updateStudentError } = await adminClient
        .from("students")
        .update(studentPayload)
        .eq("id", studentRecord.id)
        .select()
        .single();
      if (updateStudentError) {
        return response(500, { error: updateStudentError.message || "Unable to update the student record." });
      }
      studentRecord = updatedStudent;
    } else {
      const { data: insertedStudent, error: insertStudentError } = await adminClient
        .from("students")
        .insert(studentPayload)
        .select()
        .single();
      if (insertStudentError) {
        return response(500, { error: insertStudentError.message || "Unable to save the student record." });
      }
      studentRecord = insertedStudent;
    }

    const enrollmentPayload = {
      student_id: studentRecord.id,
      course_id: selectedCourse?.id || null,
      course_name: selectedCourse?.course_name || courseNameInput || null,
      batch: selectedCourse?.batch || "",
      pipeline_stage: "Enquiry",
      lead_date: leadDate,
      follow_up_date: followUpDate,
      payment_status: "Pending",
      enrollment_status: "Follow-up",
      verification_status: "Pending",
      remarks,
      total_fee: selectedCourse ? 0 : 0,
      amount_paid: 0,
      installments_planned: 1,
      installments_paid: 0,
      installment_amount: 0,
      payment_history: [],
      student_form_status: "Not Sent",
      student_form_token_hash: null,
      student_form_sent_at: null,
      student_form_expires_at: null,
    };

    const { data: insertedEnrollment, error: insertEnrollmentError } = await adminClient
      .from("enrollments")
      .insert(enrollmentPayload)
      .select()
      .single();
    if (insertEnrollmentError) {
      return response(500, { error: insertEnrollmentError.message || "Unable to save the enquiry." });
    }

    const studentEmail = buildStudentAckEmail({
      studentName: fullName,
      courseName: selectedCourse?.course_name || courseNameInput,
    });
    const adminEmail = buildAdminNotificationEmail({
      studentName: fullName,
      email,
      phone,
      courseName: selectedCourse?.course_name || courseNameInput,
      remarks,
    });

    await sendEmail({
      to: email,
      subject: studentEmail.subject,
      html: studentEmail.html,
      text: studentEmail.text,
      replyTo: getAdminNotificationEmail(),
    });

    await sendEmail({
      to: getAdminNotificationEmail(),
      subject: adminEmail.subject,
      html: adminEmail.html,
      text: adminEmail.text,
      replyTo: email,
    });

    await adminClient.from("email_logs").insert([
      {
        enrollment_id: insertedEnrollment.id,
        email_type: "Enquiry Acknowledgement",
        status: "Sent",
        sent_at: new Date().toISOString(),
      },
      {
        enrollment_id: insertedEnrollment.id,
        email_type: "Admin New Enquiry Alert",
        status: "Sent",
        sent_at: new Date().toISOString(),
      },
    ]);

    return response(200, {
      ok: true,
      enrollmentId: insertedEnrollment.id,
      formMailSent: false,
    });
  } catch (error) {
    return response(400, {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to submit the enquiry.",
    });
  }
});

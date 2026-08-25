import { createClient } from "npm:@supabase/supabase-js@2";
import { getAdminNotificationEmail, sendEmail } from "../_shared/email.ts";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type StudentRecord = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  current_activity?: string | null;
  place?: string | null;
  notes?: string | null;
  lead_source?: string | null;
};

type CourseRecord = {
  id: string;
  course_name?: string | null;
  batch?: string | null;
  fee?: number | string | null;
};

type EnrollmentRecord = {
  id: string;
  student_id?: string | null;
  course_id?: string | null;
  course_name?: string | null;
  pipeline_stage?: string | null;
  enrollment_status?: string | null;
  verification_status?: string | null;
  created_at?: string | null;
};

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function sanitize(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeEmail(value = "") {
  return sanitize(value).toLowerCase();
}

function normalizePhone(value = "") {
  return sanitize(value).replace(/[^\d+]/g, "");
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

function hasValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function normalizeStageValue(stage = "") {
  const normalizedStage = String(stage || "").trim().toLowerCase().replace(/[^a-z]+/g, "");
  if (normalizedStage === "enquiry" || normalizedStage === "inquiry") return "Enquiry";
  if (normalizedStage === "enrolled") return "Enrolled";
  if (normalizedStage === "dropout" || normalizedStage === "dropped") return "Dropout";
  return String(stage || "").trim();
}

function mergeStudentFields(existingStudent: StudentRecord, incomingStudent: Record<string, unknown>, protectExisting = false) {
  const nextPayload: Record<string, unknown> = {};

  Object.entries(incomingStudent).forEach(([key, value]) => {
    if (!hasValue(value)) {
      return;
    }

    const existingValue = existingStudent?.[key as keyof StudentRecord];
    if (protectExisting && hasValue(existingValue)) {
      return;
    }

    if (!protectExisting || !hasValue(existingValue) || String(existingValue).trim() !== String(value).trim()) {
      nextPayload[key] = value;
    }
  });

  return nextPayload;
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

    if (request.method === "GET") {
      const { data: courses, error: courseError } = await adminClient
        .from("courses")
        .select("id, course_name, duration, fee, batch, mode, active_status")
        .order("course_name", { ascending: true });
      if (courseError) {
        return response(500, { error: courseError.message || "Unable to load courses." });
      }

      return response(200, { courses: courses || [] });
    }

    const body = await request.json().catch(() => ({}));
    const studentInput = body?.student && typeof body.student === "object" ? body.student : {};
    const enrollmentInput = body?.enrollment && typeof body.enrollment === "object" ? body.enrollment : {};

    const fullName = sanitize(studentInput.full_name);
    const email = normalizeEmail(studentInput.email);
    const phone = sanitize(studentInput.phone);
    const normalizedPhone = normalizePhone(phone);
    const currentActivity = sanitize(studentInput.current_activity);
    const place = sanitize(studentInput.place);
    const courseId = sanitize(enrollmentInput.course_id);
    const courseNameInput = sanitize(enrollmentInput.course_name);
    const remarks = sanitize(enrollmentInput.remarks);
    const leadDate = toIsoDate(enrollmentInput.lead_date || new Date());
    const followUpDate = addDays(leadDate, 3);

    if (!fullName || !email || !phone || !courseId) {
      return response(400, { error: "Full name, email, phone, and selected course are required." });
    }

    const { data: courses, error: courseError } = await adminClient
      .from("courses")
      .select("id, course_name, batch, fee")
      .order("course_name", { ascending: true });
    if (courseError) {
      return response(500, { error: courseError.message || "Unable to load courses." });
    }

    const selectedCourse = (courses || []).find((course) => (
      (courseId && course.id === courseId)
      || (courseNameInput && String(course.course_name || "").trim().toLowerCase() === courseNameInput.toLowerCase())
    )) as CourseRecord | undefined;

    if (!selectedCourse?.id) {
      return response(400, { error: "Selected course could not be found." });
    }

    const studentQuery = [];
    if (email) studentQuery.push(`email.eq.${email}`);
    if (normalizedPhone) {
      studentQuery.push(`phone.eq.${phone}`);
      studentQuery.push(`phone.eq.${normalizedPhone}`);
    }

    const { data: matchingStudents, error: studentLookupError } = await adminClient
      .from("students")
      .select("*")
      .or(studentQuery.join(","));
    if (studentLookupError) {
      return response(500, { error: studentLookupError.message || "Unable to verify the student record." });
    }

    const existingStudent = (matchingStudents || []).find((student) => normalizeEmail(student.email || "") === email)
      || (matchingStudents || []).find((student) => normalizePhone(student.phone || "") === normalizedPhone)
      || null;

    let existingEnrollments: EnrollmentRecord[] = [];
    if (existingStudent?.id) {
      const { data: enrollments, error: enrollmentLookupError } = await adminClient
        .from("enrollments")
        .select("*")
        .eq("student_id", existingStudent.id);
      if (enrollmentLookupError) {
        return response(500, { error: enrollmentLookupError.message || "Unable to verify existing enquiries." });
      }
      existingEnrollments = (enrollments || []) as EnrollmentRecord[];
    }

    const duplicateActiveEnquiry = existingEnrollments.find((enrollment) => {
      const sameCourse =
        String(enrollment.course_id || "") === String(selectedCourse.id || "")
        || String(enrollment.course_name || "").trim().toLowerCase() === String(selectedCourse.course_name || "").trim().toLowerCase();
      const stage = normalizeStageValue(enrollment.pipeline_stage || "");
      return sameCourse && stage === "Enquiry";
    });

    if (duplicateActiveEnquiry) {
      return response(409, {
        ok: false,
        error: "An enquiry already exists for this student and course.",
        enrollmentId: duplicateActiveEnquiry.id,
      });
    }

    const hasEnrolledHistory = existingEnrollments.some((enrollment) => normalizeStageValue(enrollment.pipeline_stage || "") === "Enrolled");
    const studentPayload = {
      full_name: fullName,
      email,
      phone,
      current_activity: currentActivity,
      place,
      lead_source: "Online Enquiry",
      notes: remarks,
    };

    let studentRecord = existingStudent;
    if (studentRecord) {
      const nextStudentPayload = mergeStudentFields(studentRecord, studentPayload, hasEnrolledHistory);
      if (Object.keys(nextStudentPayload).length) {
        const { data: updatedStudent, error: updateStudentError } = await adminClient
          .from("students")
          .update(nextStudentPayload)
          .eq("id", studentRecord.id)
          .select()
          .single();
        if (updateStudentError) {
          return response(500, { error: updateStudentError.message || "Unable to update the student record." });
        }
        studentRecord = updatedStudent as StudentRecord;
      }
    } else {
      const { data: insertedStudent, error: insertStudentError } = await adminClient
        .from("students")
        .insert(studentPayload)
        .select()
        .single();
      if (insertStudentError) {
        return response(500, { error: insertStudentError.message || "Unable to save the student record." });
      }
      studentRecord = insertedStudent as StudentRecord;
    }

    if (!studentRecord?.id) {
      return response(500, { error: "Student record could not be resolved." });
    }

    const enrollmentPayload = {
      student_id: studentRecord.id,
      course_id: selectedCourse.id,
      course_name: selectedCourse.course_name || courseNameInput || null,
      batch: selectedCourse.batch || "",
      pipeline_stage: "Enquiry",
      lead_date: leadDate,
      follow_up_date: followUpDate,
      payment_method: "",
      payment_plan: "",
      total_fee: Number(selectedCourse.fee || 0),
      amount_paid: 0,
      installments_planned: 0,
      installments_paid: 0,
      installment_amount: 0,
      payment_status: "Pending",
      enrollment_status: "Follow-up",
      verification_status: "Pending",
      remarks,
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
      courseName: selectedCourse.course_name || courseNameInput,
    });
    const adminEmail = buildAdminNotificationEmail({
      studentName: fullName,
      email,
      phone,
      courseName: selectedCourse.course_name || courseNameInput,
      remarks,
    });

    const emailLogRows = [];
    const emailWarnings = [];

    try {
      await sendEmail({
        to: email,
        subject: studentEmail.subject,
        html: studentEmail.html,
        text: studentEmail.text,
        replyTo: getAdminNotificationEmail(),
      });
      emailLogRows.push({
        enrollment_id: insertedEnrollment.id,
        email_type: "Enquiry Acknowledgement",
        status: "Sent",
        sent_at: new Date().toISOString(),
      });
    } catch (error) {
      emailWarnings.push("Student acknowledgement email could not be sent.");
      emailLogRows.push({
        enrollment_id: insertedEnrollment.id,
        email_type: "Enquiry Acknowledgement",
        status: "Failed",
        sent_at: new Date().toISOString(),
      });
      console.error("Failed to send student acknowledgement email:", error);
    }

    try {
      await sendEmail({
        to: getAdminNotificationEmail(),
        subject: adminEmail.subject,
        html: adminEmail.html,
        text: adminEmail.text,
        replyTo: email,
      });
      emailLogRows.push({
        enrollment_id: insertedEnrollment.id,
        email_type: "Admin New Enquiry Alert",
        status: "Sent",
        sent_at: new Date().toISOString(),
      });
    } catch (error) {
      emailWarnings.push("Admin notification email could not be sent.");
      emailLogRows.push({
        enrollment_id: insertedEnrollment.id,
        email_type: "Admin New Enquiry Alert",
        status: "Failed",
        sent_at: new Date().toISOString(),
      });
      console.error("Failed to send admin enquiry notification email:", error);
    }

    if (emailLogRows.length) {
      const { error: emailLogError } = await adminClient.from("email_logs").insert(emailLogRows);
      if (emailLogError) {
        console.error("Failed to save public enquiry email logs:", emailLogError);
      }
    }

    return response(200, {
      ok: true,
      enrollmentId: insertedEnrollment.id,
      pipeline_stage: "Enquiry",
      enrollment_status: "Follow-up",
      notificationWarning: emailWarnings.length ? emailWarnings.join(" ") : null,
    });
  } catch (error) {
    return response(400, {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to submit the enquiry.",
    });
  }
});

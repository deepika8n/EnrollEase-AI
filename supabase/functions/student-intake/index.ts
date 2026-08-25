import { createClient } from "npm:@supabase/supabase-js@2";
import { getAdminNotificationEmail, sendEmail } from "../_shared/email.ts";

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;

};

type SubmissionDocument = {
  document_type?: string | null;
  file_url?: string | null;
  remarks?: string | null;
  [key: string]: unknown;
};

type EnrollmentStatusRow = {
  student_id?: string | null;
  pipeline_stage?: string | null;
};

type StudentCodeRow = {
  id?: string | null;
  student_code?: string | null;
};

type StudentRecord = {
  student_code?: string | null;
  [key: string]: unknown;
};

type CourseRecord = {
  course_name?: string | null;
  [key: string]: unknown;
};

type EnrollmentWithRelations = {
  id: string;
  student_id?: string | null;
  lead_date?: string | null;
  enrolled_date?: string | null;
  batch?: string | null;
  payment_plan?: string | null;
  payment_method?: string | null;
  original_fee?: number | string | null;
  discount_type?: string | null;
  discount_value?: number | string | null;
  discount_amount?: number | string | null;
  total_fee?: number | string | null;
  amount_paid?: number | string | null;
  installments_planned?: number | string | null;
  installment_amount?: number | string | null;
  last_payment_date?: string | null;
  next_due_date?: string | null;
  remarks?: string | null;
  course_name?: string | null;
  student_form_status?: string | null;
  student_form_expires_at?: string | null;
  student_form_token_hash?: string | null;
  students?: StudentRecord | null;
  courses?: CourseRecord | null;
  [key: string]: unknown;
};

type SupabaseClientAny = any;

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

function normalizeEmail(value: unknown = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizeToken(value: unknown = "") {
  return String(value || "").trim();
}

function normalizeNoteSegment(value: unknown = "") {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function mergeUniqueNoteSegments(segments: Array<string | null | undefined>) {
  const seenSegments = new Set<string>();

  return segments
    .flatMap((segment) => String(segment || "").split("|"))
    .map((segment) => segment.trim())
    .filter((segment) => {
      if (!segment) return false;

      const normalizedSegment = normalizeNoteSegment(segment);
      if (seenSegments.has(normalizedSegment)) return false;

      seenSegments.add(normalizedSegment);
      return true;
    })
    .join(" | ");
}

function toIsoDate(value: string | Date | null | undefined) {
  if (!value) return "";
  if (value instanceof Date) {
    return Number.isNaN(value.valueOf()) ? "" : value.toISOString().slice(0, 10);
  }

  const safeValue = String(value).trim();
  if (!safeValue) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(safeValue)) return safeValue;
  const parsed = new Date(safeValue);
  return Number.isNaN(parsed.valueOf()) ? "" : parsed.toISOString().slice(0, 10);
}

async function sha256(value = "") {
  const bytes = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((item) => item.toString(16).padStart(2, "0")).join("");
}

function sanitizeString(value: unknown) {
  return String(value || "").trim();
}

function pickStudentDbColumns(student: Record<string, unknown>) {
  return {
    student_code: sanitizeString(student.student_code),
    full_name: sanitizeString(student.full_name),
    email: normalizeEmail(student.email),
    phone: sanitizeString(student.phone),
    current_activity: sanitizeString(student.current_activity),
    place: sanitizeString(student.place),
    photo_url: sanitizeString(student.photo_url),
    aadhaar_document_url: sanitizeString(student.aadhaar_document_url),
    lead_source: sanitizeString(student.lead_source),
    notes: sanitizeString(student.notes),
  };
}

function getMissingSchemaColumn(error: { message?: string } | null | undefined, tableName = "") {
  const message = String(error?.message || "");
  const schemaCacheMatch = message.match(/Could not find the '([^']+)' column of '([^']+)' in the schema cache/i);
  if (schemaCacheMatch) {
    const [, columnName, failedTableName] = schemaCacheMatch;
    if (tableName && failedTableName !== tableName) return "";
    return columnName;
  }

  const relationColumnMatch = message.match(/column\s+([a-z0-9_]+)\.([a-z0-9_]+)\s+does not exist/i);
  if (relationColumnMatch) {
    const [, failedTableName, columnName] = relationColumnMatch;
    if (tableName && failedTableName !== tableName) return "";
    return columnName;
  }

  const bareColumnMatch = message.match(/column\s+"?([a-z0-9_]+)"?\s+does not exist/i);
  if (bareColumnMatch) {
    return bareColumnMatch[1];
  }

  return "";
}

function removeColumnFromPayload<T extends Record<string, unknown>>(payload: T, columnName = "") {
  if (!columnName || !Object.prototype.hasOwnProperty.call(payload, columnName)) {
    return { payload, changed: false };
  }

  const { [columnName]: _removed, ...rest } = payload;
  return { payload: rest as T, changed: true };
}

async function updateTableWithSchemaRetry<T extends Record<string, unknown>>({
  adminClient,
  tableName,
  recordId,
  payload,
}: {
  adminClient: SupabaseClientAny;
  tableName: string;
  recordId: string;
  payload: T;
}) {
  let nextPayload = payload;

  while (true) {
    const { error } = await adminClient
      .from(tableName)
      .update(nextPayload as unknown)
      .eq("id", recordId);

    if (!error) {
      return { error: null, payload: nextPayload };
    }

    const missingColumn = getMissingSchemaColumn(error, tableName);
    if (!missingColumn) {
      return { error, payload: nextPayload };
    }

    const { payload: strippedPayload, changed } = removeColumnFromPayload(nextPayload, missingColumn);
    if (!changed) {
      return { error, payload: nextPayload };
    }

    nextPayload = strippedPayload;
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePaymentStatus(totalFee: number, amountPaid: number) {
  if (totalFee <= 0 || amountPaid <= 0) return "Pending";
  if (amountPaid >= totalFee) return "Paid";
  return "Partial";
}

function formatCurrencyValue(value: unknown) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(toNumber(value, 0));
}

function formatDateLabel(value: string | null | undefined) {
  const iso = toIsoDate(value);
  if (!iso) return "N/A";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(`${iso}T00:00:00`));
}

function normalizeDiscountType(value: unknown = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized.includes("percent") || normalized.includes("%")) return "Percentage";
  if (normalized.includes("amount") || normalized.includes("flat")) return "Amount";
  return "";
}

function resolveDiscountAmount(originalFee: number, discountType: unknown = "", discountValue: unknown = 0) {
  const feeValue = Math.max(toNumber(originalFee, 0), 0);
  const value = Math.max(toNumber(discountValue, 0), 0);
  const normalizedType = normalizeDiscountType(discountType);

  if (!feeValue || !value || !normalizedType) return 0;
  if (normalizedType === "Percentage") {
    return Math.min(Math.round((feeValue * Math.min(value, 100)) / 100), feeValue);
  }

  return Math.min(value, feeValue);
}

function resolvePayableFee(originalFee: number, discountType: unknown = "", discountValue: unknown = 0) {
  const feeValue = Math.max(toNumber(originalFee, 0), 0);
  return Math.max(feeValue - resolveDiscountAmount(feeValue, discountType, discountValue), 0);
}

function buildPaymentHistory({
  totalFee,
  amountPaid,
  paymentPlan,
  paymentMethod,
  paymentDate,
  installmentsPlanned,
}: {
  totalFee: number;
  amountPaid: number;
  paymentPlan: string;
  paymentMethod: string;
  paymentDate: string;
  installmentsPlanned: number;
}) {
  if (amountPaid <= 0 || !paymentDate) {
    return [];
  }

  return [
    {
      id: `payment-${paymentDate}`,
      label: paymentPlan === "EMI" ? "Installment 1" : amountPaid >= totalFee ? "Full Payment" : "Part Payment",
      amount: amountPaid,
      paid_amount: amountPaid,
      cumulative_paid: amountPaid,
      course_fee: totalFee,
      pending_amount: Math.max(totalFee - amountPaid, 0),
      payment_type: paymentPlan === "EMI" ? "EMI" : "One Time Payment",
      payment_method: paymentMethod,
      mode: paymentMethod,
      date: paymentDate,
      status: "Paid",
      installments_paid: paymentPlan === "EMI" ? 1 : amountPaid > 0 ? 1 : 0,
      installments_planned: installmentsPlanned,
    },
  ];
}

function buildStudentSubmissionAckEmail(studentName = "", courseName = "") {
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
            <p>Dear ${escapeHtml(studentName || "Student")},</p>
            <p>Your enrollment form${courseName ? ` for <strong>${escapeHtml(courseName)}</strong>` : ""} has been submitted successfully.</p>
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

function buildAdminSubmissionEmail(studentName = "", studentEmail = "", courseName = "") {
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
            <p><strong>Name:</strong> ${escapeHtml(studentName || "Student")}</p>
            <p><strong>Email:</strong> ${escapeHtml(studentEmail || "")}</p>
            <p><strong>Course:</strong> ${escapeHtml(courseName || "Selected Course")}</p>
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

function buildPaymentStatusEmail({
  studentName = "",
  courseName = "",
  amountPaid = 0,
  paymentDate = "",
  remainingAmount = 0,
  nextDueDate = "",
  isCleared = false,
}) {
  const subject = isCleared ? "Payment Cleared - CERTISURED" : "Payment Received - CERTISURED";
  const statusLabel = isCleared ? "Cleared" : "Payment Received";
  const pendingHtml = isCleared
    ? "<p>Your payment plan is marked as <strong>Cleared</strong>.</p>"
    : `<p><strong>Remaining amount:</strong> ${escapeHtml(formatCurrencyValue(remainingAmount))}<br /><strong>Next due date:</strong> ${escapeHtml(formatDateLabel(nextDueDate))}</p>`;
  const pendingText = isCleared
    ? "Your payment plan is marked as Cleared."
    : `Remaining amount: ${formatCurrencyValue(remainingAmount)}
Next due date: ${formatDateLabel(nextDueDate)}`;

  return {
    subject,
    html: `
      <div style="margin:0;padding:24px;background:#eef4fb;font-family:Arial,sans-serif;color:#10233c;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dbe8f7;border-radius:24px;overflow:hidden;">
          <div style="padding:28px 32px;background:#0b3558;color:#ffffff;">
            <div style="font-size:12px;letter-spacing:0.26em;text-transform:uppercase;font-weight:700;opacity:0.78;">CERTISURED</div>
            <div style="margin-top:8px;font-size:28px;font-weight:800;">Payment Update</div>
            <div style="margin-top:4px;font-size:12px;letter-spacing:0.22em;text-transform:uppercase;font-weight:700;opacity:0.78;">${escapeHtml(statusLabel)}</div>
          </div>
          <div style="padding:32px;">
            <p>Dear ${escapeHtml(studentName || "Student")},</p>
            <p>Thank you for your payment towards <strong>${escapeHtml(courseName || "your course")}</strong>.</p>
            <p><strong>Paid amount:</strong> ${escapeHtml(formatCurrencyValue(amountPaid))}<br /><strong>Paid date:</strong> ${escapeHtml(formatDateLabel(paymentDate))}</p>
            ${pendingHtml}
            <p style="margin-top:28px;">Thanks and Regards,<br /><strong>CERTISURED</strong></p>
          </div>
        </div>
      </div>
    `,
    text: `Dear ${studentName || "Student"},

Thank you for your payment towards ${courseName || "your course"}.

Paid amount: ${formatCurrencyValue(amountPaid)}
Paid date: ${formatDateLabel(paymentDate)}
Status: ${statusLabel}
${pendingText}

Thanks and Regards,
CERTISURED`,
  };
}

function parseStudentCode(value = "") {
  const match = String(value || "").trim().toUpperCase().match(/^(.*?)(\d+)$/);
  if (!match) return null;
  return {
    prefix: match[1],
    numericPart: match[2],
    numericValue: Number.parseInt(match[2], 10),
  };
}

function getNextStudentCode(existingCodes: string[] = [], fallbackPrefix = "CT") {
  const parsedCodes = existingCodes.map(parseStudentCode).filter(Boolean) as Array<{
    prefix: string;
    numericPart: string;
    numericValue: number;
  }>;

  if (!parsedCodes.length) {
    return `${fallbackPrefix}${new Date().getFullYear()}00001`;
  }

  const latest = parsedCodes.reduce((highest, current) => {
    if (!highest) return current;
    if (current.numericValue !== highest.numericValue) {
      return current.numericValue > highest.numericValue ? current : highest;
    }
    return current.numericPart.length >= highest.numericPart.length ? current : highest;
  }, null as null | { prefix: string; numericPart: string; numericValue: number });

  if (!latest) {
    return `${fallbackPrefix}${new Date().getFullYear()}00001`;
  }

  return `${latest.prefix}${String(latest.numericValue + 1).padStart(latest.numericPart.length, "0")}`;
}

async function validateRequest(adminClient: SupabaseClientAny, enrollmentId = "", token = "") {
  const { data, error } = await adminClient
    .from("enrollments")
    .select("*, students!inner(*), courses(*)")
    .eq("id", enrollmentId)
    .single();

  if (error || !data) {
    throw new Error("Student form request was not found.");
  }

  const normalizedToken = normalizeToken(token);
  if (!normalizedToken) {
    throw new Error("Student form token is missing.");
  }

  if (String(data.student_form_status || "").trim() === "Submitted") {
    throw new Error("This student form has already been submitted.");
  }

  const expiryTime = data.student_form_expires_at ? new Date(data.student_form_expires_at).valueOf() : 0;
  if (!expiryTime || expiryTime < Date.now()) {
    throw new Error("This student form link has expired. Please contact the admissions team.");
  }

  const hashedToken = await sha256(normalizedToken);
  if (!data.student_form_token_hash || hashedToken !== data.student_form_token_hash) {
    throw new Error("This student form link is invalid.");
  }

  return data;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: JSON_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) {
      return response(500, { error: "Supabase server configuration is missing." });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "").trim();
    const enrollmentId = sanitizeString(body?.enrollmentId);
    const token = normalizeToken(body?.token);

    if (!action || !enrollmentId) {
      return response(400, { error: "Action and enrollmentId are required." });
    }

    if (action === "get_request") {
      const enrollment = await validateRequest(adminClient, enrollmentId, token);
      return response(200, {
        student: enrollment.students,
        enrollment,
        course: enrollment.courses || null,
      });
    }

    if (action === "submit_request") {
      const enrollment = await validateRequest(adminClient, enrollmentId, token);
      const submission = body?.submission && typeof body.submission === "object" ? body.submission : {};
      const studentPatch = submission.student && typeof submission.student === "object" ? submission.student as Record<string, unknown> : {};
      const enrollmentPatch = submission.enrollment && typeof submission.enrollment === "object" ? submission.enrollment as Record<string, unknown> : {};
      const documents = Array.isArray(submission.documents) ? submission.documents as SubmissionDocument[] : [];

      const fullName = sanitizeString(studentPatch.full_name);
      const email = normalizeEmail(studentPatch.email);
      const phone = sanitizeString(studentPatch.phone);
      if (!fullName || !email || !phone) {
        return response(400, { error: "Full name, email, and phone are required." });
      }

      const studentPhoto = documents.find((item: SubmissionDocument) => item?.document_type === "Student Photo");
      const aadhaarDocument = documents.find((item: SubmissionDocument) => item?.document_type === "Aadhaar ID Photo");
      if (!studentPhoto?.file_url || !aadhaarDocument?.file_url) {
        return response(400, { error: "Student photo and Aadhaar upload are required." });
      }

      const leadDate = toIsoDate(enrollmentPatch.lead_date || enrollment.lead_date || new Date());
      const enrolledDate = toIsoDate(enrollmentPatch.enrolled_date || enrollment.enrolled_date || new Date());
      const batch = sanitizeString(enrollmentPatch.batch || enrollment.batch);
      const paymentPlan = sanitizeString(enrollmentPatch.payment_plan || enrollment.payment_plan || "One Time");
      const paymentMethod = sanitizeString(enrollmentPatch.payment_method || enrollment.payment_method || "UPI");
      const originalFee = toNumber(enrollmentPatch.original_fee ?? enrollment.original_fee ?? enrollmentPatch.total_fee ?? enrollment.total_fee, 0);
      const discountType = normalizeDiscountType(enrollmentPatch.discount_type ?? enrollment.discount_type);
      const discountValue = toNumber(enrollmentPatch.discount_value ?? enrollment.discount_value, 0);
      const discountAmount = resolveDiscountAmount(originalFee, discountType, discountValue);
      const totalFee = resolvePayableFee(originalFee, discountType, discountValue);
      const amountPaid = toNumber(enrollmentPatch.amount_paid ?? enrollment.amount_paid, 0);
      const installmentsPlanned = paymentPlan === "EMI"
        ? Math.max(toNumber(enrollmentPatch.installments_planned ?? enrollment.installments_planned, 3), 1)
        : 1;
      const installmentAmount = paymentPlan === "EMI"
        ? toNumber(enrollmentPatch.installment_amount ?? enrollment.installment_amount, 0)
        : 0;
      const lastPaymentDate = amountPaid > 0
        ? toIsoDate(enrollmentPatch.last_payment_date || enrollment.last_payment_date || enrolledDate)
        : "";
      const nextDueDate = paymentPlan === "EMI"
        ? toIsoDate(enrollmentPatch.next_due_date || enrollment.next_due_date)
        : "";
      const paymentStatus = normalizePaymentStatus(totalFee, amountPaid);

      if (!leadDate) {
        return response(400, { error: "Lead date is required." });
      }
      if (!enrolledDate) {
        return response(400, { error: "Enrollment date is required." });
      }
      if (!batch) {
        return response(400, { error: "Batch is required." });
      }
      if (!paymentPlan) {
        return response(400, { error: "Payment plan is required." });
      }
      if (!paymentMethod) {
        return response(400, { error: "Payment method is required." });
      }
      if (totalFee <= 0) {
        return response(400, { error: "Course fee must be greater than 0." });
      }
      if (amountPaid > totalFee) {
        return response(400, { error: "Amount paid cannot exceed the course fee." });
      }
      if (amountPaid > 0 && !lastPaymentDate) {
        return response(400, { error: "Last payment date is required when amount paid is greater than zero." });
      }
      if (paymentPlan === "EMI" && installmentsPlanned <= 0) {
        return response(400, { error: "Number of installments must be greater than zero for EMI payments." });
      }
      if (paymentPlan === "EMI" && amountPaid > 0 && !nextDueDate) {
        return response(400, { error: "Next due date is required after recording an EMI payment." });
      }

      const { data: enrolledRows } = await adminClient
        .from("enrollments")
        .select("student_id, pipeline_stage");
      const enrolledStudentIds = new Set(
        (enrolledRows || [])
          .filter((item) => String(item.pipeline_stage || "").trim().toLowerCase() === "enrolled")
          .map((item) => item.student_id)
          .filter(Boolean),
      );
      const { data: studentRows } = await adminClient
        .from("students")
        .select("id, student_code");
      const existingCodes = (studentRows || [])
        .filter((item) => enrolledStudentIds.has(item.id))
        .map((item) => String(item.student_code || "").trim())
        .filter(Boolean);
      const nextStudentCode = String((enrollment.students as StudentRecord | null)?.student_code || "").trim() || getNextStudentCode(existingCodes);

      const nextStudentPayload = pickStudentDbColumns({
        student_code: nextStudentCode,
        full_name: fullName,
        email,
        phone,
        current_activity: sanitizeString(studentPatch.current_activity),
        place: sanitizeString(studentPatch.place),
        photo_url: String(studentPhoto.file_url || ""),
        aadhaar_document_url: String(aadhaarDocument.file_url || ""),
        lead_source: sanitizeString((enrollment.students as StudentRecord | null)?.lead_source || ""),
        notes: sanitizeString((enrollment.students as StudentRecord | null)?.notes || ""),
      });

      const { error: studentUpdateError } = await updateTableWithSchemaRetry({
        adminClient,
        tableName: "students",
        recordId: String(enrollment.student_id || ""),
        payload: nextStudentPayload,
      });
      if (studentUpdateError) {
        return response(500, { error: studentUpdateError.message || "Unable to update the student profile." });
      }

      const currentRemarks = sanitizeString(enrollment.remarks);
      const submittedRemarks = sanitizeString(enrollmentPatch.remarks);
      const mergedRemarks = mergeUniqueNoteSegments([
        currentRemarks,
        submittedRemarks,
        `Student form submitted on ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
      ]);
      const nextEnrollmentPayload = {
        pipeline_stage: "Enrolled",
        course_name: sanitizeString(enrollmentPatch.course_name || enrollment.course_name || enrollment.courses?.course_name || ""),
        batch,
        lead_date: leadDate,
        enrolled_date: enrolledDate,
        payment_method: paymentMethod,
        payment_plan: paymentPlan,
        original_fee: originalFee,
        discount_type: discountType,
        discount_value: discountValue,
        discount_amount: discountAmount,
        total_fee: totalFee,
        amount_paid: amountPaid,
        installments_planned: installmentsPlanned,
        installment_amount: installmentAmount,
        next_due_date: nextDueDate || null,
        payment_status: paymentStatus,
        verification_status: "Pending",
        enrollment_status: "Active",
        remarks: mergedRemarks,
        last_payment_date: lastPaymentDate || null,
        payment_history: buildPaymentHistory({
          totalFee,
          amountPaid,
          paymentPlan,
          paymentMethod,
          paymentDate: lastPaymentDate,
          installmentsPlanned,
        }),
        student_form_status: "Submitted",
        student_form_submitted_at: new Date().toISOString(),
        student_form_token_hash: null,
      };

      const { error: enrollmentUpdateError } = await adminClient
        .from("enrollments")
        .update(nextEnrollmentPayload)
        .eq("id", enrollmentId);
      if (enrollmentUpdateError) {
        return response(500, { error: enrollmentUpdateError.message || "Unable to update the enrollment record." });
      }

      const documentPayload = documents.map((item: SubmissionDocument) => ({
        enrollment_id: enrollmentId,
        document_type: sanitizeString(item.document_type),
        file_url: String(item.file_url || ""),
        verification_status: "Pending",
        remarks: sanitizeString(item.remarks) || "Student self-submitted document",
      }));
      const { error: documentError } = await adminClient
        .from("documents")
        .insert(documentPayload);
      if (documentError) {
        return response(500, { error: documentError.message || "Unable to save the uploaded documents." });
      }

      const courseName = String(enrollment.courses?.course_name || enrollment.course_name || "").trim();
      const studentAck = buildStudentSubmissionAckEmail(fullName, courseName);
      const adminAlert = buildAdminSubmissionEmail(fullName, email, courseName);
      const remainingAmount = Math.max(totalFee - amountPaid, 0);
      const paymentEmail = amountPaid > 0
        ? buildPaymentStatusEmail({
          studentName: fullName,
          courseName,
          amountPaid,
          paymentDate: lastPaymentDate || enrolledDate || leadDate,
          remainingAmount,
          nextDueDate,
          isCleared: paymentStatus === "Paid" || remainingAmount <= 0,
        })
        : null;

      await sendEmail({
        to: email,
        subject: studentAck.subject,
        html: studentAck.html,
        text: studentAck.text,
        replyTo: getAdminNotificationEmail(),
      });

      await sendEmail({
        to: getAdminNotificationEmail(),
        subject: adminAlert.subject,
        html: adminAlert.html,
        text: adminAlert.text,
        replyTo: email,
      });

      if (paymentEmail) {
        await sendEmail({
          to: email,
          subject: paymentEmail.subject,
          html: paymentEmail.html,
          text: paymentEmail.text,
          replyTo: getAdminNotificationEmail(),
        });
      }

      await adminClient.from("email_logs").insert([
        {
          enrollment_id: enrollmentId,
          email_type: "Student Enrollment Submitted",
          status: "Sent",
          sent_at: new Date().toISOString(),
        },
        {
          enrollment_id: enrollmentId,
          email_type: "Admin Enrollment Submission Alert",
          status: "Sent",
          sent_at: new Date().toISOString(),
        },
        paymentEmail
          ? {
            enrollment_id: enrollmentId,
            email_type: "Payment Update",
            status: "Sent",
            sent_at: new Date().toISOString(),
          }
          : null,
      ].filter(Boolean));

      return response(200, { ok: true });
    }

    return response(400, { error: "Unsupported student intake action." });
  } catch (error) {
    return response(400, { error: error instanceof Error ? error.message : "Student intake request failed." });
  }
}); 

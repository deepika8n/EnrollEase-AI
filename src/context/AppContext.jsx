import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  createDemoPortalState,
  googleAppsScriptSnippet,
  googleFormFields,
} from "../data/demoPortal";
import { canonicalCourseSeeds, decorateCourseRecord, findCourseByReference } from "../data/courseCatalog";
import { hasSupabaseEnv, supabase } from "../lib/supabase";
import { buildAgentResponse } from "../services/agentService";
import { sendEmailTrigger } from "../services/emailService";
import { triggerAutomation } from "../services/automationService";
import { uploadEnrollmentDocument } from "../services/enrollmentService";
import { addDays, toIsoDate } from "../utils/dateMath";
import {
  buildPaymentHistoryEntry,
  getLatestPaymentEntry,
  inferPaymentPlan,
  isEmiEnrollment,
  normalizePaymentHistoryList,
  resolveAmountPaid,
  resolveLastPaymentDate,
  resolveNextDueDate,
  resolveRemainingAmount,
  toNumberOrNull,
} from "../utils/paymentHelpers";

const LOCAL_DB_KEY = "enrollease-demo-db-v2";
const LOCAL_SESSION_KEY = "enrollease-demo-session-v2";
const SUPABASE_SHADOW_KEY = "enrollease-supabase-shadow-v1";
const SUPABASE_BOOT_TIMEOUT_MS = 30000;
const SUPABASE_LOGIN_TIMEOUT_MS = 30000;
const requiredPortalTables = [
  { key: "profiles", table: "profiles", queryBuilder: (query) => query.select("*") },
  { key: "students", table: "students", queryBuilder: (query) => query.select("*") },
  { key: "courses", table: "courses", queryBuilder: (query) => query.select("*").order("course_name", { ascending: true }) },
  {
    key: "enrollments",
    table: "enrollments",
    queryBuilder: (query) => query.select("*").order("created_at", { ascending: false }),
  },
  {
    key: "documents",
    table: "documents",
    queryBuilder: (query) => query.select("*").order("uploaded_at", { ascending: false }),
  },
];
const optionalPortalTables = [
  { key: "emailTemplates", table: "email_templates", queryBuilder: (query) => query.select("*") },
  {
    key: "emailLogs",
    table: "email_logs",
    queryBuilder: (query) => query.select("*").order("sent_at", { ascending: false }),
  },
  {
    key: "agentLogs",
    table: "agent_logs",
    queryBuilder: (query) => query.select("*").order("created_at", { ascending: false }),
  },
  {
    key: "pdfRecords",
    table: "pdf_records",
    queryBuilder: (query) => query.select("*").order("generated_at", { ascending: false }),
  },
  {
    key: "auditLogs",
    table: "audit_logs",
    queryBuilder: (query) => query.select("*").order("created_at", { ascending: false }),
  },
];
const criticalSchemaColumnsByTable = {
  students: new Set([]),
  enrollments: new Set([]),
};

const defaultState = {
  currentUser: null,
  authUser: null,
  profiles: [],
  students: [],
  courses: [],
  enrollments: [],
  documents: [],
  emailTemplates: [],
  emailLogs: [],
  agentLogs: [],
  pdfRecords: [],
  auditLogs: [],
  notifications: [],
  loading: true,
};

const AppContext = createContext(null);

const clone = (value) => JSON.parse(JSON.stringify(value));

const createId = (prefix) =>
  `${prefix}-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;

function withTimeout(promise, milliseconds, label) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.ceil(milliseconds / 1000)} seconds.`));
    }, milliseconds);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId !== undefined) {
      globalThis.clearTimeout(timeoutId);
    }
  });
}

function isCriticalSchemaColumn(tableName, columnName) {
  return criticalSchemaColumnsByTable[tableName]?.has(columnName) || false;
}

function buildMissingSchemaColumnError(tableName, columnName) {
  return new Error(
    `Supabase is missing the \`${columnName}\` column on \`${tableName}\`. Run \`supabase/fix_enrollment_access.sql\` in the Supabase SQL Editor, then save or update the student again.`,
  );
}

function readJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function normalizeEmailKey(email = "") {
  return String(email || "").trim().toLowerCase();
}

function readLocalSessionEmail() {
  const savedSession = readJson(LOCAL_SESSION_KEY);
  return normalizeEmailKey(savedSession?.email || "");
}

function writeLocalSession(email = "") {
  const normalizedEmail = normalizeEmailKey(email);
  if (!normalizedEmail) {
    clearLocalSession();
    return;
  }

  writeJson(LOCAL_SESSION_KEY, { email: normalizedEmail });
}

function buildCurrentUserFallback(sessionUser) {
  if (!sessionUser) return null;

  const normalizedEmail = normalizeEmailKey(sessionUser.email || "");
  const fallbackName =
    sessionUser.user_metadata?.full_name
    || sessionUser.user_metadata?.name
    || sessionUser.user_metadata?.display_name
    || normalizedEmail.split("@")[0]
    || "Admin";

  return {
    id: `profile-fallback-${sessionUser.id}`,
    user_id: sessionUser.id,
    full_name: fallbackName,
    email: sessionUser.email || normalizedEmail,
    role: sessionUser.user_metadata?.role || "admin",
    created_at: sessionUser.created_at || new Date().toISOString(),
  };
}

function normalizeSupabaseShadowState(shadow) {
  return {
    studentsByEmail:
      shadow?.studentsByEmail && typeof shadow.studentsByEmail === "object"
        ? shadow.studentsByEmail
        : {},
    enrollmentsById:
      shadow?.enrollmentsById && typeof shadow.enrollmentsById === "object"
        ? shadow.enrollmentsById
        : {},
  };
}

function readSupabaseShadowState() {
  return normalizeSupabaseShadowState(readJson(SUPABASE_SHADOW_KEY));
}

function writeSupabaseShadowState(shadow) {
  writeJson(SUPABASE_SHADOW_KEY, normalizeSupabaseShadowState(shadow));
}

function updateSupabaseShadowState(mutator) {
  const currentShadow = readSupabaseShadowState();
  const nextShadow = normalizeSupabaseShadowState(mutator(clone(currentShadow)) || currentShadow);
  writeSupabaseShadowState(nextShadow);
  return nextShadow;
}

function pickRemovedPayloadFields(payload, removedColumns = []) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};

  return removedColumns.reduce((result, columnName) => {
    if (Object.prototype.hasOwnProperty.call(payload, columnName)) {
      result[columnName] = payload[columnName];
    }
    return result;
  }, {});
}

function mergeShadowFields(record = {}, shadowFields = {}) {
  const merged = { ...record };

  Object.entries(shadowFields || {}).forEach(([key, value]) => {
    if (!hasValue(record?.[key])) {
      merged[key] = value;
    }
  });

  return merged;
}

function storeShadowStudentPayload(studentRecord, payload, removedColumns = []) {
  const emailKey = normalizeEmailKey(studentRecord?.email || payload?.email || "");
  const shadowFields = pickRemovedPayloadFields(payload, removedColumns);
  if (!emailKey || !Object.keys(shadowFields).length) return;

  updateSupabaseShadowState((shadow) => ({
    ...shadow,
    studentsByEmail: {
      ...shadow.studentsByEmail,
      [emailKey]: {
        ...(shadow.studentsByEmail[emailKey] || {}),
        ...shadowFields,
      },
    },
  }));
}

function storeShadowEnrollmentPayload(enrollmentRecord, payload, removedColumns = []) {
  const enrollmentId = enrollmentRecord?.id || payload?.id || "";
  const shadowFields = pickRemovedPayloadFields(payload, removedColumns);
  if (!enrollmentId || !Object.keys(shadowFields).length) return;

  updateSupabaseShadowState((shadow) => ({
    ...shadow,
    enrollmentsById: {
      ...shadow.enrollmentsById,
      [enrollmentId]: {
        ...(shadow.enrollmentsById[enrollmentId] || {}),
        ...shadowFields,
      },
    },
  }));
}

function mergeRemoteStateWithShadow({ students = [], enrollments = [] }) {
  const shadow = readSupabaseShadowState();

  return {
    students: students.map((student) =>
      mergeShadowFields(student, shadow.studentsByEmail[normalizeEmailKey(student?.email)] || {})),
    enrollments: enrollments.map((enrollment) =>
      mergeShadowFields(enrollment, shadow.enrollmentsById[enrollment?.id] || {})),
  };
}

function dedupeRecordsById(records = []) {
  const seen = new Set();

  return records.filter((record) => {
    const id = record?.id;
    if (!id || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

function clearLocalSession() {
  window.localStorage.removeItem(LOCAL_SESSION_KEY);
}

function ensureLocalDb() {
  const db = readJson(LOCAL_DB_KEY);
  if (db) return db;
  const seeded = createDemoPortalState();
  writeJson(LOCAL_DB_KEY, seeded);
  return seeded;
}

function buildLocalState(db, sessionEmail = "") {
  const normalizedSessionEmail = normalizeEmailKey(sessionEmail || readLocalSessionEmail());
  const profile = normalizedSessionEmail
    ? db.profiles.find((item) => normalizeEmailKey(item.email) === normalizedSessionEmail) || null
    : null;
  return {
    ...defaultState,
    ...db,
    courses: db.courses.map((course) => decorateCourseRecord(course)),
    documents: normalizeDocumentsForDisplay(db.documents, db.enrollments),
    authUser: profile ? { id: profile.user_id, email: profile.email } : null,
    currentUser: profile,
    loading: false,
  };
}

function normalizePaymentStatus(totalFee, amountPaid) {
  if (amountPaid <= 0) return "Pending";
  if (amountPaid >= totalFee) return "Paid";
  return "Partial";
}

function hasValue(value) {
  return value !== null && value !== undefined && (typeof value !== "string" || value.trim() !== "");
}

function preferIncomingValue(incomingValue, existingValue) {
  return hasValue(incomingValue) ? incomingValue : (hasValue(existingValue) ? existingValue : incomingValue);
}

function mergeStoredFields(existingRecord = {}, incomingRecord = {}) {
  return Object.fromEntries(
    Object.keys(incomingRecord).map((key) => [key, preferIncomingValue(incomingRecord[key], existingRecord[key])]),
  );
}

function calculateInstallmentsPaid({ paymentPlan, amountPaid, installmentAmount, installmentsPlanned }) {
  const emiEnrollment = isEmiEnrollment({
    payment_plan: paymentPlan,
    installments_planned: installmentsPlanned,
    amount_paid: amountPaid,
  });
  if (!emiEnrollment || !installmentAmount) return amountPaid > 0 ? 1 : 0;
  return Math.min(installmentsPlanned || 0, Math.floor(amountPaid / installmentAmount));
}

function buildInitialPaymentHistory(enrollment, amountPaid, leadDate) {
  if (!(amountPaid > 0)) return [];

  const emiEnrollment = isEmiEnrollment(enrollment, {
    installmentsPlanned: enrollment.installments_planned || 0,
    amountPaid,
  });
  const installmentsPlanned = enrollment.installments_planned || (emiEnrollment ? 3 : 1);

  return [buildPaymentHistoryEntry({
    entryId: createId("payment"),
    amount: amountPaid,
    amountPaidAfter: amountPaid,
    totalFee: enrollment.total_fee || 0,
    paymentPlan: enrollment.payment_plan || "",
    paymentMethod: enrollment.payment_method || "UPI",
    installmentNumber: 1,
    installmentsPlanned,
    paymentDate: enrollment.last_payment_date || enrollment.enrolled_date || leadDate,
    label: emiEnrollment ? "Installment 1" : "Initial Payment",
    status: "Paid",
  })];
}

function isEnquiryStage(stage = "") {
  return String(stage || "").trim() === "Enquiry";
}

function isEnrolledStage(stage = "") {
  return String(stage || "").trim() === "Enrolled";
}

function isDropoutStage(stage = "") {
  return String(stage || "").trim() === "Dropout";
}

function hasSupportingDocuments(documents = []) {
  return documents.some((item) => !["Student Photo", "Aadhaar ID Photo"].includes(item?.document_type));
}

function buildEnquiryProfileStatus(student, enrollment, course) {
  const requiredFields = [
    { label: "Full Name", value: student?.full_name },
    { label: "Phone", value: student?.phone },
    { label: "Email", value: student?.email },
    { label: "Interested Course", value: course?.course_name || enrollment?.course_name || enrollment?.course_id },
    { label: "Current Qualification", value: student?.current_activity },
    { label: "College", value: student?.college_name },
    { label: "City", value: student?.place },
    { label: "Lead Source", value: student?.lead_source },
  ];

  const completedCount = requiredFields.filter((item) => hasValue(item.value)).length;

  return {
    completion: requiredFields.length ? Math.round((completedCount / requiredFields.length) * 100) : 0,
    missing: requiredFields.filter((item) => !hasValue(item.value)).map((item) => item.label),
  };
}

function inferCurrentStage(enrollment) {
  if (enrollment?.dropout_reason || enrollment?.enrollment_status === "Dropped" || isDropoutStage(enrollment?.pipeline_stage)) {
    return "Dropout";
  }

  if (isEnquiryStage(enrollment?.pipeline_stage)) {
    return "Enquiry";
  }

  if (isEnrolledStage(enrollment?.pipeline_stage)) {
    return "Enrolled";
  }

  const amountPaid = Number(enrollment?.amount_paid || 0);
  const totalFee = Number(enrollment?.total_fee || 0);
  const paymentStatus = enrollment?.payment_status || normalizePaymentStatus(totalFee, amountPaid);
  if (
    enrollment?.enrolled_date
    || enrollment?.enrollment_status === "Active"
    || enrollment?.enrollment_status === "Completed"
    || paymentStatus === "Paid"
    || paymentStatus === "Partial"
    || enrollment?.verification_status === "Approved"
    || amountPaid > 0
  ) {
    return "Enrolled";
  }

  return "Enquiry";
}

function normalizeEnrollmentForDisplay(enrollment, course) {
  const pipelineStage = inferCurrentStage(enrollment);
  const paymentEligible = !isEnquiryStage(pipelineStage);
  const totalFee = paymentEligible
    ? (toNumberOrNull(enrollment?.total_fee) ?? Number(course?.fee || 0))
    : toNumberOrNull(enrollment?.total_fee);
  const leadDate = enrollment?.lead_date || enrollment?.created_at || "";
  const basePaymentHistory = paymentEligible
    ? normalizePaymentHistoryList(enrollment?.payment_history, {
      totalFee,
      paymentPlan: enrollment?.payment_plan || "",
      paymentMethod: enrollment?.payment_method || "",
      installmentsPlanned: enrollment?.installments_planned || 0,
      amountPaid: enrollment?.amount_paid || 0,
    })
    : [];
  const amountPaid = paymentEligible ? resolveAmountPaid(enrollment?.amount_paid, basePaymentHistory) : 0;
  const paymentPlan = paymentEligible
    ? inferPaymentPlan({
      paymentPlan: enrollment?.payment_plan || "",
      installmentsPlanned: enrollment?.installments_planned || 0,
      history: basePaymentHistory,
      amountPaid,
    })
    : "";
  const installmentsPlanned = paymentEligible
    ? (Number(enrollment?.installments_planned) || (paymentPlan === "EMI" ? 3 : paymentPlan ? 1 : 0))
    : 0;
  const installmentAmount = paymentEligible
    ? (
      toNumberOrNull(enrollment?.installment_amount)
      || (paymentPlan === "EMI" && installmentsPlanned ? Math.round((totalFee || 0) / installmentsPlanned) : totalFee || 0)
    )
    : 0;
  const latestPaymentEntry = paymentEligible
    ? getLatestPaymentEntry(basePaymentHistory, {
      totalFee,
      paymentPlan,
      paymentMethod: enrollment?.payment_method || "",
      installmentsPlanned,
      amountPaid,
    })
    : null;
  const installmentsPaid = paymentEligible
    ? (
      Number.isFinite(Number(enrollment?.installments_paid))
        ? Number(enrollment.installments_paid)
        : Math.max(
          latestPaymentEntry?.installments_paid || 0,
          calculateInstallmentsPaid({
            paymentPlan,
            amountPaid,
            installmentAmount,
            installmentsPlanned,
          }),
        )
    )
    : 0;
  const paymentStatus = paymentEligible
    ? (enrollment?.payment_status || normalizePaymentStatus(totalFee, amountPaid))
    : "Pending";
  const enrolledDate = paymentEligible
    ? (enrollment?.enrolled_date || (pipelineStage === "Enrolled" ? (enrollment?.created_at || leadDate || "") : ""))
    : "";
  const paymentMethod = paymentEligible
    ? (
      enrollment?.payment_method
      || latestPaymentEntry?.payment_method
      || latestPaymentEntry?.mode
      || (amountPaid > 0 ? "UPI" : "")
    )
    : "";
  const paymentHistory = paymentEligible
    ? (
      basePaymentHistory.length
        ? normalizePaymentHistoryList(basePaymentHistory, {
          totalFee,
          paymentPlan,
          paymentMethod,
          installmentsPlanned,
          amountPaid,
        })
        : buildInitialPaymentHistory(
          {
            ...enrollment,
            payment_plan: paymentPlan,
            payment_method: paymentMethod,
            enrolled_date: enrolledDate,
            total_fee: totalFee,
            installments_planned: installmentsPlanned,
          },
          amountPaid,
          leadDate,
        )
    )
    : [];
  const lastPaymentDate = paymentEligible
    ? resolveLastPaymentDate({
      lastPaymentDate: enrollment?.last_payment_date || "",
      history: paymentHistory,
      amountPaid,
      enrolledDate,
      leadDate,
    })
    : "";
  const nextDueDate = paymentEligible
    ? resolveNextDueDate({
      paymentStatus,
      lastPaymentDate,
      enrolledDate,
      leadDate,
      fallbackDate: enrollment?.next_due_date || "",
    })
    : "";
  const enrollmentStatus = enrollment?.enrollment_status === "Verified"
    ? "Active"
    : enrollment?.enrollment_status || (pipelineStage === "Enrolled" ? "Active" : pipelineStage === "Dropout" ? "Dropped" : "Follow-up");

  return {
    ...enrollment,
    pipeline_stage: pipelineStage,
    lead_date: leadDate,
    enrolled_date: enrolledDate,
    payment_plan: paymentPlan,
    payment_method: paymentMethod,
    total_fee: totalFee,
    amount_paid: amountPaid,
    installments_planned: installmentsPlanned,
    installments_paid: installmentsPaid,
    installment_amount: installmentAmount,
    next_due_date: nextDueDate,
    payment_status: paymentStatus,
    verification_status: enrollment?.verification_status || "Pending",
    enrollment_status: enrollmentStatus,
    last_payment_date: lastPaymentDate,
    payment_history: paymentHistory,
  };
}

function buildRecordedPaymentState(enrollment, paymentMode = "UPI") {
  const totalFee = toNumberOrNull(enrollment?.total_fee) || 0;
  const currentPaidAmount = resolveAmountPaid(enrollment?.amount_paid, enrollment?.payment_history);
  const dueAmount = resolveRemainingAmount(totalFee, currentPaidAmount) || 0;
  const emiEnrollment = isEmiEnrollment(enrollment, {
    installmentsPlanned: enrollment?.installments_planned || 0,
    history: enrollment?.payment_history || [],
    amountPaid: currentPaidAmount,
  });
  const installmentsPlanned = enrollment?.installments_planned || (emiEnrollment ? 3 : 1);
  const plannedAmount = emiEnrollment
    ? toNumberOrNull(enrollment?.installment_amount) || dueAmount
    : dueAmount;
  const paymentAmount = Math.min(dueAmount, plannedAmount);
  const nextPaidAmount = currentPaidAmount + paymentAmount;
  const nextInstallmentsPaid = emiEnrollment
    ? Math.min((Number(enrollment?.installments_paid) || 0) + 1, Number(installmentsPlanned) || 0)
    : nextPaidAmount > 0
      ? 1
      : 0;
  const nextStatus = normalizePaymentStatus(totalFee, nextPaidAmount);
  const paymentDate = toIsoDate(new Date());
  const paymentMethod = paymentMode || enrollment?.payment_method || "UPI";
  const existingPaymentHistory = normalizePaymentHistoryList(enrollment?.payment_history, {
    totalFee,
    paymentPlan: enrollment?.payment_plan || "",
    paymentMethod,
    installmentsPlanned: enrollment?.installments_planned || 0,
    amountPaid: currentPaidAmount,
  });
  const nextPaymentEntry = buildPaymentHistoryEntry({
    entryId: createId("payment"),
    amount: paymentAmount,
    amountPaidAfter: nextPaidAmount,
    totalFee,
    paymentPlan: enrollment?.payment_plan || "",
    paymentMethod,
    installmentNumber: nextInstallmentsPaid,
    installmentsPlanned,
    paymentDate,
    label: emiEnrollment ? `Installment ${nextInstallmentsPaid}` : "Balance Payment",
    status: "Paid",
  });

  return {
    amount_paid: nextPaidAmount,
    installments_paid: nextInstallmentsPaid,
    payment_status: nextStatus,
    payment_method: paymentMethod,
    last_payment_date: paymentDate,
    next_due_date: resolveNextDueDate({
      paymentStatus: nextStatus,
      lastPaymentDate: paymentDate,
      enrolledDate: enrollment?.enrolled_date || enrollment?.lead_date || "",
      leadDate: enrollment?.lead_date || "",
      fallbackDate: enrollment?.next_due_date || "",
    }),
    payment_history: [nextPaymentEntry, ...existingPaymentHistory],
  };
}

function normalizeDocumentRecord(document, enrollment) {
  const inheritedStatus = enrollment?.verification_status && enrollment.verification_status !== "Pending"
    ? enrollment.verification_status
    : "";

  return {
    ...document,
    verification_status:
      (document?.verification_status && document.verification_status !== "Pending")
      ? document.verification_status
      : inheritedStatus || document?.verification_status || "Pending",
    remarks: document?.remarks || "",
  };
}

function buildDocumentBundle(student, enrollmentId, documents = []) {
  const bundledDocuments = [...documents];

  if (!bundledDocuments.some((item) => item.document_type === "Student Photo") && student?.photo_url) {
    bundledDocuments.push({
      id: `${enrollmentId}-student-photo`,
      enrollment_id: enrollmentId,
      document_type: "Student Photo",
      file_url: student.photo_url,
      verification_status: "Pending",
      remarks: "Stored with student profile",
      uploaded_at: student.created_at || "",
    });
  }

  if (!bundledDocuments.some((item) => item.document_type === "Aadhaar ID Photo") && student?.aadhaar_document_url) {
    bundledDocuments.push({
      id: `${enrollmentId}-aadhaar-photo`,
      enrollment_id: enrollmentId,
      document_type: "Aadhaar ID Photo",
      file_url: student.aadhaar_document_url,
      verification_status: "Pending",
      remarks: "Stored with student profile",
      uploaded_at: student.created_at || "",
    });
  }

  return bundledDocuments;
}

function normalizeDocumentsForDisplay(documents = [], enrollments = []) {
  return documents.map((document) =>
    normalizeDocumentRecord(
      document,
      enrollments.find((item) => item.id === document.enrollment_id),
    ));
}

function normalizeStatusPatch(currentEnrollment, patch) {
  const nextPatch = {
    ...patch,
  };

  if (nextPatch.enrollment_status === "Verified") {
    nextPatch.enrollment_status = "Active";
  }

  if (nextPatch.pipeline_stage === "Dropout" && !hasValue(nextPatch.enrollment_status)) {
    nextPatch.enrollment_status = "Dropped";
  }

  if (nextPatch.verification_status === "Approved") {
    nextPatch.pipeline_stage = nextPatch.pipeline_stage || "Enrolled";
    nextPatch.enrollment_status = nextPatch.enrollment_status || "Active";
    nextPatch.enrolled_date = nextPatch.enrolled_date || currentEnrollment?.enrolled_date || toIsoDate(new Date());
  }

  if (nextPatch.verification_status === "Requested Correction" && !hasValue(nextPatch.enrollment_status)) {
    nextPatch.enrollment_status = "Follow-up";
  }

  if (nextPatch.verification_status === "Rejected" && !hasValue(nextPatch.enrollment_status)) {
    nextPatch.enrollment_status = "Dropped";
  }

  return nextPatch;
}

function toPortalRecords(students, enrollments, courses, documents) {
  return dedupeRecordsById(enrollments)
    .map((enrollment) => {
      const student = students.find((item) => item.id === enrollment.student_id);
      const course = findCourseByReference(courses, [enrollment.course_id, enrollment.course_name]) || null;
      if (!student) return null;

      const normalizedEnrollment = normalizeEnrollmentForDisplay(enrollment, course);
      const recordDocuments = buildDocumentBundle(
        student,
        enrollment.id,
        documents.filter((item) => item.enrollment_id === enrollment.id),
      ).map((item) => normalizeDocumentRecord(item, normalizedEnrollment));
      const normalizedStudent = {
        ...student,
        photo_url: student.photo_url || recordDocuments.find((item) => item.document_type === "Student Photo")?.file_url || "",
        aadhaar_document_url:
          student.aadhaar_document_url
          || recordDocuments.find((item) => item.document_type === "Aadhaar ID Photo")?.file_url
          || "",
      };

      const profileStatus = buildEnquiryProfileStatus(normalizedStudent, normalizedEnrollment, course);
      const paymentEligible = !isEnquiryStage(normalizedEnrollment.pipeline_stage);
      const isEnquiryRecord = isEnquiryStage(normalizedEnrollment.pipeline_stage);
      const isEnrolledRecord = isEnrolledStage(normalizedEnrollment.pipeline_stage);
      const isDropoutRecord = isDropoutStage(normalizedEnrollment.pipeline_stage);

      return {
        id: normalizedEnrollment.id,
        student: normalizedStudent,
        enrollment: normalizedEnrollment,
        course,
        documents: recordDocuments,
        currentStage: normalizedEnrollment.pipeline_stage,
        dueAmount: paymentEligible
          ? Math.max((Number(normalizedEnrollment.total_fee) || 0) - (Number(normalizedEnrollment.amount_paid) || 0), 0)
          : 0,
        paymentEligible,
        isEnquiryRecord,
        isEnrolledRecord,
        isDropoutRecord,
        verificationEligible: isEnrolledRecord,
        documentEligible: isEnrolledRecord,
        profileCompletion: profileStatus.completion,
        missingInformation: profileStatus.missing,
        hasSupportingDocuments: hasSupportingDocuments(recordDocuments),
      };
    })
    .filter(Boolean)
    .sort((left, right) => new Date(right.enrollment.lead_date || right.enrollment.created_at) - new Date(left.enrollment.lead_date || left.enrollment.created_at));
}

function buildDashboardMetrics(records) {
  const totalRecords = records.length;
  const pending = records.filter((record) => record.isEnquiryRecord).length;
  const totalEnquiries = totalRecords;
  const totalEnrolled = records.filter((record) => record.isEnrolledRecord).length;
  const dropouts = records.filter((record) => record.isDropoutRecord).length;
  const conversionRate = totalEnquiries ? Math.round((totalEnrolled / totalEnquiries) * 100) : 0;
  const emiStudents = records.filter((record) => isEmiEnrollment(record.enrollment) && record.paymentEligible).length;
  const clearedPayments = records.filter((record) => record.enrollment.payment_status === "Paid").length;

  return {
    totalRecords,
    totalEnquiries,
    totalEnrolled,
    dropouts,
    pending,
    conversionRate,
    emiStudents,
    clearedPayments,
  };
}

function normalizeCourseRecords(courses = []) {
  const activeCourses = courses.filter((course) => course?.active_status !== false);
  const visibleCourses = activeCourses.length ? activeCourses : courses;
  return visibleCourses.map((course) => decorateCourseRecord(course));
}

function formatEnrollmentAccessError(error, operation, tableName) {
  if (error?.message?.includes("row-level security policy")) {
    return new Error(
      `Supabase blocked ${tableName} ${operation}. Run supabase/fix_enrollment_access.sql in the Supabase SQL Editor, then reload the app.`,
    );
  }

  if (error?.message?.includes("permission denied")) {
    return new Error(
      `Supabase denied ${tableName} ${operation}. Run supabase/fix_enrollment_access.sql in the Supabase SQL Editor, then reload the app.`,
    );
  }

  return error;
}

function getMissingSchemaColumn(error, tableName) {
  const message = String(error?.message || "");
  const match = message.match(/Could not find the '([^']+)' column of '([^']+)' in the schema cache/i);
  if (!match) return "";

  const [, columnName, failedTableName] = match;
  if (tableName && failedTableName !== tableName) return "";
  return columnName;
}

function removeColumnFromPayload(payload, columnName) {
  if (!columnName) {
    return { payload, changed: false };
  }

  if (Array.isArray(payload)) {
    let changed = false;
    const nextPayload = payload.map((item) => {
      if (!item || typeof item !== "object" || !Object.prototype.hasOwnProperty.call(item, columnName)) {
        return item;
      }

      const { [columnName]: _removed, ...rest } = item;
      changed = true;
      return rest;
    });

    return { payload: nextPayload, changed };
  }

  if (!payload || typeof payload !== "object" || !Object.prototype.hasOwnProperty.call(payload, columnName)) {
    return { payload, changed: false };
  }

  const { [columnName]: _removed, ...rest } = payload;
  return { payload: rest, changed: true };
}

async function runMutationWithSchemaRetry({ tableName, payload, execute }) {
  let currentPayload = payload;
  const removedColumns = [];

  while (true) {
    const result = await execute(currentPayload);
    if (!result.error) {
      return {
        ...result,
        removedColumns,
      };
    }

    const missingColumn = getMissingSchemaColumn(result.error, tableName);
    if (!missingColumn) {
      return {
        ...result,
        removedColumns,
      };
    }

    if (isCriticalSchemaColumn(tableName, missingColumn)) {
      return {
        ...result,
        removedColumns,
        error: buildMissingSchemaColumnError(tableName, missingColumn),
      };
    }

    const { payload: nextPayload, changed } = removeColumnFromPayload(currentPayload, missingColumn);
    if (!changed) {
      return {
        ...result,
        removedColumns,
      };
    }

    if (!removedColumns.includes(missingColumn)) {
      removedColumns.push(missingColumn);
    }
    currentPayload = nextPayload;
  }
}

async function fetchTable(table, queryBuilder) {
  const builder = queryBuilder ? queryBuilder(supabase.from(table)) : supabase.from(table).select("*");
  const { data, error } = await builder;
  if (error) throw error;
  return data || [];
}

function fetchTableWithTimeout(table, queryBuilder, label) {
  return withTimeout(fetchTable(table, queryBuilder), SUPABASE_BOOT_TIMEOUT_MS, label);
}

function buildOptionalState(optionalState = {}) {
  return {
    emailTemplates: Array.isArray(optionalState.emailTemplates) ? optionalState.emailTemplates : [],
    emailLogs: Array.isArray(optionalState.emailLogs) ? optionalState.emailLogs : [],
    agentLogs: Array.isArray(optionalState.agentLogs) ? optionalState.agentLogs : [],
    pdfRecords: Array.isArray(optionalState.pdfRecords) ? optionalState.pdfRecords : [],
    auditLogs: Array.isArray(optionalState.auditLogs) ? optionalState.auditLogs : [],
  };
}

async function loadRequiredRemoteState(sessionUser) {
  const requiredResults = await Promise.all(
    requiredPortalTables.map(async ({ key, table, queryBuilder }) => [
      key,
      await fetchTableWithTimeout(table, queryBuilder, `Loading ${table}`),
    ]),
  );
  const {
    profiles = [],
    students = [],
    courses = [],
    enrollments = [],
    documents = [],
  } = Object.fromEntries(requiredResults);
  const mergedStudents = dedupeRecordsById(students);
  const mergedEnrollments = dedupeRecordsById(enrollments);
  const mergedDocuments = dedupeRecordsById(documents);
  const currentUser =
    profiles.find((profile) => profile.user_id === sessionUser.id)
    || profiles.find((profile) => normalizeEmailKey(profile.email) === normalizeEmailKey(sessionUser.email))
    || buildCurrentUserFallback(sessionUser);

  return {
    authUser: sessionUser,
    currentUser,
    profiles,
    students: mergedStudents,
    courses: normalizeCourseRecords(courses),
    enrollments: mergedEnrollments,
    documents: normalizeDocumentsForDisplay(mergedDocuments, mergedEnrollments),
    ...buildOptionalState(),
  };
}

async function loadOptionalRemoteState() {
  const optionalResults = await Promise.all(
    optionalPortalTables.map(async ({ key, table, queryBuilder }) => {
      try {
        return [key, await fetchTableWithTimeout(table, queryBuilder, `Loading ${table}`)];
      } catch {
        return [key, []];
      }
    }),
  );

  return buildOptionalState(Object.fromEntries(optionalResults));
}

export function AppProvider({ children }) {
  const [state, setState] = useState(defaultState);
  const refreshTracker = useRef({ key: null, promise: null });

  const pushNotification = (notification) => {
    const item = { id: createId("notification"), ...notification };
    setState((prev) => ({ ...prev, notifications: [...prev.notifications, item] }));
    window.setTimeout(() => {
      setState((prev) => ({
        ...prev,
        notifications: prev.notifications.filter((entry) => entry.id !== item.id),
      }));
    }, 3500);
  };

  const commitLocalDb = (updater, successTitle) => {
    const currentDb = ensureLocalDb();
    const nextDb = typeof updater === "function" ? updater(clone(currentDb)) : updater;
    writeJson(LOCAL_DB_KEY, nextDb);
    const nextState = buildLocalState(nextDb, state.authUser?.email || state.currentUser?.email || readLocalSessionEmail());
    setState((prev) => ({ ...nextState, notifications: prev.notifications }));
    if (successTitle) {
      pushNotification({ type: "success", title: successTitle });
    }
    return nextDb;
  };

  const syncCoursesIntoState = (courses) => {
    const normalizedCourses = normalizeCourseRecords(courses);
    if (!normalizedCourses.length) return normalizedCourses;

    setState((prev) => ({ ...prev, courses: normalizedCourses }));
    return normalizedCourses;
  };

  const fetchRemoteCourses = async () => (
    fetchTable("courses", (query) => query.select("*").order("course_name", { ascending: true }))
  );

  const seedCanonicalCourses = async () => {
    const existingCourses = await fetchRemoteCourses();

    for (const courseSeed of canonicalCourseSeeds) {
      const existingCourse = existingCourses.find(
        (course) => course.course_name === courseSeed.course_name && course.batch === courseSeed.batch,
      );

      if (existingCourse) {
        const { error: updateError } = await supabase
          .from("courses")
          .update({
            duration: courseSeed.duration,
            fee: courseSeed.fee,
            active_status: courseSeed.active_status,
          })
          .eq("id", existingCourse.id);

        if (updateError) {
          throw formatEnrollmentAccessError(updateError, "update", "courses");
        }

        continue;
      }

      const { error: insertError } = await supabase.from("courses").insert(courseSeed);
      if (insertError) {
        throw formatEnrollmentAccessError(insertError, "insert", "courses");
      }
    }

    return fetchRemoteCourses();
  };

  const resolveCourseRecord = async ({ courseId, courseName }) => {
    const currentMatch = findCourseByReference(state.courses, [courseId, courseName]);
    if (currentMatch) {
      return currentMatch;
    }

    let remoteCourses = await fetchRemoteCourses();
    let normalizedCourses = syncCoursesIntoState(remoteCourses);
    let remoteMatch = findCourseByReference(normalizedCourses, [courseId, courseName]);

    if (remoteMatch) {
      return remoteMatch;
    }

    remoteCourses = await seedCanonicalCourses();
    normalizedCourses = syncCoursesIntoState(remoteCourses.length ? remoteCourses : await fetchRemoteCourses());
    remoteMatch = findCourseByReference(normalizedCourses, [courseId, courseName]);

    if (remoteMatch) {
      return remoteMatch;
    }

    throw new Error(
      "Supabase returned courses, but none matched the selected course. Run supabase/fix_enrollment_access.sql in the Supabase SQL Editor, then reload the app.",
    );
  };

  const refreshState = async (sessionUser) => {
    const refreshKey = sessionUser?.id || sessionUser?.email || "guest";

    if (refreshTracker.current.promise && refreshTracker.current.key === refreshKey) {
      return refreshTracker.current.promise;
    }

    const refreshPromise = (async () => {
      if (!hasSupabaseEnv || !supabase) {
        const db = ensureLocalDb();
        const localState = buildLocalState(db, sessionUser?.email || "");
        setState((prev) => ({ ...localState, notifications: prev.notifications }));
        return;
      }

      if (!sessionUser) {
        setState((prev) => ({ ...defaultState, loading: false, notifications: prev.notifications }));
        return;
      }

      try {
        const remoteState = await loadRequiredRemoteState(sessionUser);
        setState((prev) => ({
          ...prev,
          ...remoteState,
          loading: false,
        }));

        void loadOptionalRemoteState().then((optionalState) => {
          setState((prev) => {
            const activeUserKey = prev.authUser?.id || prev.authUser?.email || "guest";
            if (activeUserKey !== refreshKey) {
              return prev;
            }

            return {
              ...prev,
              ...optionalState,
            };
          });
        });
      } catch (error) {
        pushNotification({ type: "warning", title: error.message });
        throw error;
      } finally {
        setState((prev) => ({ ...prev, loading: false }));
      }
    })();

    refreshTracker.current = { key: refreshKey, promise: refreshPromise };

    try {
      await refreshPromise;
    } finally {
      if (refreshTracker.current.promise === refreshPromise) {
        refreshTracker.current = { key: null, promise: null };
      }
    }
  };

  useEffect(() => {
    if (!hasSupabaseEnv || !supabase) {
      const db = ensureLocalDb();
      const localState = buildLocalState(db, readLocalSessionEmail());
      setState(localState);
      return;
    }

    let mounted = true;

    void (async () => {
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          SUPABASE_BOOT_TIMEOUT_MS,
          "Checking your saved session",
        );
        if (error) throw error;
        if (!mounted) return;
        if (data.session?.user) {
          await refreshState(data.session.user);
        } else {
          setState((prev) => ({ ...prev, loading: false }));
        }
      } catch {
        if (!mounted) return;
        setState((prev) => ({ ...prev, loading: false }));
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await refreshState(session.user);
      } else {
        setState((prev) => ({ ...defaultState, loading: false, notifications: prev.notifications }));
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async ({ email, password }) => {
    if (!hasSupabaseEnv || !supabase) {
      const db = ensureLocalDb();
      const adminAccount = db.adminAccount || { email: "admin@enrollease.ai", password: "Admin@123" };
      const safeEmail = email.trim().toLowerCase();
      if (safeEmail !== adminAccount.email.toLowerCase() || password !== adminAccount.password) {
        throw new Error("Use the admin account credentials to access the portal.");
      }

      writeLocalSession(adminAccount.email);
      const nextState = buildLocalState(db, adminAccount.email);
      setState((prev) => ({ ...nextState, notifications: prev.notifications }));
      pushNotification({ type: "success", title: "Signed in as admin" });
      return { user: { email: adminAccount.email, id: nextState.currentUser?.user_id } };
    }

    setState((prev) => ({ ...prev, loading: true }));
    try {
      const safeEmail = email.trim().toLowerCase();
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email: safeEmail, password }),
        SUPABASE_LOGIN_TIMEOUT_MS,
        "Signing in",
      );
      if (error) {
        throw error;
      }

      const signedInUser = data.user || data.session?.user;
      if (!signedInUser) {
        throw new Error("Signed in successfully, but no user was returned by Supabase.");
      }

      await refreshState(signedInUser);
      pushNotification({ type: "success", title: "Signed in successfully" });
      return data;
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  const loginAsRole = async (role) => {
    if (!role) return;

    if (!hasSupabaseEnv || !supabase) {
      const db = ensureLocalDb();
      const nextProfile = db.profiles.find((item) => item.role === role) || db.profiles[0];
      if (!nextProfile?.email) {
        throw new Error("No demo profile is available for this role.");
      }

      writeLocalSession(nextProfile.email);
      const nextState = buildLocalState(db, nextProfile.email);
      setState((prev) => ({ ...nextState, notifications: prev.notifications }));
      pushNotification({ type: "success", title: `Switched to ${nextProfile.role} view` });
      return nextState.currentUser;
    }

    pushNotification({ type: "warning", title: "Role switching is only available in demo mode." });
    return state.currentUser;
  };

  const logout = async () => {
    if (!hasSupabaseEnv || !supabase) {
      clearLocalSession();
      const db = ensureLocalDb();
      const nextState = buildLocalState(db);
      setState((prev) => ({ ...nextState, notifications: prev.notifications }));
      pushNotification({ type: "success", title: "Signed out successfully" });
      return;
    }

    await supabase.auth.signOut();
    setState((prev) => ({ ...defaultState, loading: false, notifications: prev.notifications }));
    pushNotification({ type: "success", title: "Signed out successfully" });
  };

  const resetPassword = async ({ email, currentPassword, newPassword }) => {
    if (!newPassword || newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters.");
    }

    if (!hasSupabaseEnv || !supabase) {
      const db = ensureLocalDb();
      const adminEmail = db.adminAccount?.email || "";
      if (email.trim().toLowerCase() !== adminEmail.toLowerCase()) {
        throw new Error("Only the admin account can reset the password in demo mode.");
      }
      if (currentPassword && currentPassword !== db.adminAccount.password) {
        throw new Error("Current password is incorrect.");
      }

      commitLocalDb((draft) => ({
        ...draft,
        adminAccount: {
          ...draft.adminAccount,
          password: newPassword,
        },
      }), "Admin password updated");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    pushNotification({ type: "success", title: "Password updated successfully" });
  };

  const buildLifecycleEnrollmentState = (enrollment = {}, fallbackLeadDate = toIsoDate(new Date())) => {
    const leadDate = toIsoDate(enrollment.lead_date || fallbackLeadDate || new Date());
    const pipelineStage = isDropoutStage(enrollment.pipeline_stage)
      ? "Dropout"
      : isEnrolledStage(enrollment.pipeline_stage)
        ? "Enrolled"
        : "Enquiry";
    const paymentEligible = !isEnquiryStage(pipelineStage);
    const totalFee = paymentEligible ? Number(enrollment.total_fee || 0) : 0;
    const amountPaid = paymentEligible ? Number(enrollment.amount_paid || 0) : 0;
    const paymentPlan = paymentEligible
      ? inferPaymentPlan({
        paymentPlan: enrollment.payment_plan || "",
        installmentsPlanned: enrollment.installments_planned || 0,
        amountPaid,
      })
      : "";
    const paymentMethod = paymentEligible ? (enrollment.payment_method || (amountPaid > 0 ? "UPI" : "")) : "";
    const installmentsPlanned = paymentEligible ? (Number(enrollment.installments_planned) || (paymentPlan === "EMI" ? 3 : 1)) : 0;
    const installmentAmount = paymentEligible
      ? (
        Number(enrollment.installment_amount || 0)
        || (paymentPlan === "EMI" && installmentsPlanned ? Math.round(totalFee / installmentsPlanned) : totalFee)
      )
      : 0;
    const installmentsPaid = paymentEligible
      ? calculateInstallmentsPaid({
        paymentPlan,
        amountPaid,
        installmentAmount,
        installmentsPlanned,
      })
      : 0;
    const paymentStatus = paymentEligible ? normalizePaymentStatus(totalFee, amountPaid) : "Pending";
    const enrolledDate = paymentEligible ? toIsoDate(enrollment.enrolled_date || leadDate) : "";
    const followUpDate = isEnquiryStage(pipelineStage)
      ? toIsoDate(enrollment.follow_up_date || addDays(leadDate, 3))
      : enrollment.follow_up_date || "";
    const lastPaymentDate = paymentEligible && amountPaid > 0
      ? toIsoDate(enrollment.last_payment_date || enrolledDate || leadDate)
      : "";
    const nextDueDate = paymentEligible
      ? resolveNextDueDate({
        paymentStatus,
        lastPaymentDate,
        enrolledDate,
        leadDate,
        fallbackDate: enrollment.next_due_date || "",
      })
      : "";
    const paymentHistory = paymentEligible
      ? buildInitialPaymentHistory(
        {
          ...enrollment,
          total_fee: totalFee,
          payment_plan: paymentPlan,
          payment_method: paymentMethod,
          installments_planned: installmentsPlanned,
          last_payment_date: lastPaymentDate,
          enrolled_date: enrolledDate,
        },
        amountPaid,
        leadDate,
      )
      : [];
    const verificationStatus = paymentEligible ? (enrollment.verification_status || "Pending") : "Pending";
    const enrollmentStatus = enrollment.enrollment_status
      || (pipelineStage === "Enrolled" ? "Active" : pipelineStage === "Dropout" ? "Dropped" : "Follow-up");

    return {
      leadDate,
      pipelineStage,
      paymentEligible,
      totalFee,
      amountPaid,
      paymentPlan,
      paymentMethod,
      installmentsPlanned,
      installmentAmount,
      installmentsPaid,
      paymentStatus,
      enrolledDate,
      followUpDate,
      lastPaymentDate,
      nextDueDate,
      paymentHistory,
      verificationStatus,
      enrollmentStatus,
    };
  };

  const createEnrollment = async ({ student, enrollment, documents = [] }) => {
    const {
      leadDate,
      pipelineStage,
      totalFee,
      amountPaid,
      paymentPlan,
      paymentMethod,
      installmentsPlanned,
      installmentAmount,
      installmentsPaid,
      paymentStatus,
      enrolledDate,
      followUpDate,
      lastPaymentDate,
      nextDueDate,
      paymentHistory,
      verificationStatus,
      enrollmentStatus,
    } = buildLifecycleEnrollmentState(enrollment, toIsoDate(enrollment.lead_date || new Date()));
    const isEnquiryCreation = pipelineStage === "Enquiry";
    const successTitle = isEnquiryCreation ? "Enquiry saved successfully." : "Enrollment saved successfully.";

    if (!hasSupabaseEnv || !supabase) {
      const studentId = createId("student");
      const enrollmentId = createId("enrollment");

      commitLocalDb((draft) => {
        const newStudent = {
          id: studentId,
          created_at: leadDate,
          ...student,
        };

        const newEnrollment = {
          ...enrollment,
          id: enrollmentId,
          student_id: studentId,
          created_at: leadDate,
          pipeline_stage: pipelineStage,
          lead_date: leadDate,
          enrolled_date: enrolledDate || "",
          joining_date: enrollment.joining_date || "",
          follow_up_date: followUpDate || "",
          verification_status: verificationStatus,
          payment_status: paymentStatus,
          enrollment_status: enrollmentStatus,
          payment_method: paymentMethod,
          payment_plan: paymentPlan,
          installments_planned: installmentsPlanned,
          installments_paid: installmentsPaid,
          installment_amount: installmentAmount,
          next_due_date: nextDueDate,
          last_payment_date: lastPaymentDate,
          payment_history: paymentHistory,
          total_fee: totalFee,
          amount_paid: amountPaid,
        };

        const newDocuments = documents.map((item) => ({
          id: createId("document"),
          enrollment_id: enrollmentId,
          document_type: item.document_type,
          file_url: item.file_url || "",
          verification_status: verificationStatus,
          remarks: item.remarks || "Uploaded from form",
          uploaded_at: leadDate,
        }));

        draft.students.unshift(newStudent);
        draft.enrollments.unshift(newEnrollment);
        draft.documents.unshift(...newDocuments);
        draft.auditLogs.unshift({
          id: createId("audit"),
          user_id: draft.profiles[0]?.user_id || null,
          action: "create_enrollment",
          description: `Created enrollment for ${student.full_name}`,
          created_at: new Date().toISOString(),
        });
        return draft;
      }, successTitle);
      return;
    }

    try {
      const selectedCourse = await resolveCourseRecord({
        courseId: enrollment.course_id,
        courseName: enrollment.course_name,
      });

      const normalizedEmail = student.email.trim().toLowerCase();
      const studentPayload = isEnquiryCreation
        ? {
          full_name: student.full_name,
          email: normalizedEmail,
          phone: student.phone,
          college_name: student.college_name || "",
          current_activity: student.current_activity || "",
          place: student.place || "",
          lead_source: student.lead_source || "Manual Form",
        }
        : {
          full_name: student.full_name,
          email: normalizedEmail,
          phone: student.phone,
          alternate_phone: student.alternate_phone || "",
          college_name: student.college_name || "",
          current_activity: student.current_activity || "",
          place: student.place || "",
          address: student.address,
          guardian_name: student.guardian_name,
          guardian_relation: student.guardian_relation || "",
          guardian_phone: student.guardian_phone,
          aadhaar_id: student.aadhaar_id || "",
          photo_url: student.photo_url || "",
          aadhaar_document_url: student.aadhaar_document_url || "",
          lead_source: student.lead_source || "Manual Form",
          notes: student.notes || "",
        };

      const { data: existingStudent, error: existingStudentError } = await supabase
        .from("students")
        .select("*")
        .eq("email", normalizedEmail)
        .maybeSingle();
      if (existingStudentError) throw formatEnrollmentAccessError(existingStudentError, "read", "students");

      let studentRecord = existingStudent;

      if (studentRecord) {
        const mergedStudentPayload = mergeStoredFields(studentRecord, studentPayload);
        const { data: updatedStudent, error: studentUpdateError, removedColumns: removedStudentColumns = [] } = await runMutationWithSchemaRetry({
          tableName: "students",
          payload: mergedStudentPayload,
          execute: (payload) =>
            supabase
              .from("students")
              .update(payload)
              .eq("id", studentRecord.id)
              .select()
              .single(),
        });
        if (studentUpdateError) throw formatEnrollmentAccessError(studentUpdateError, "update", "students");
        studentRecord = updatedStudent;
      } else {
        const { data: insertedStudent, error: studentInsertError, removedColumns: removedStudentColumns = [] } = await runMutationWithSchemaRetry({
          tableName: "students",
          payload: studentPayload,
          execute: (payload) =>
            supabase
              .from("students")
              .insert(payload)
              .select()
              .single(),
        });
        if (studentInsertError) throw formatEnrollmentAccessError(studentInsertError, "insert", "students");
        studentRecord = insertedStudent;
      }

      const enrollmentPayload = isEnquiryCreation
        ? {
          student_id: studentRecord.id,
          course_id: selectedCourse.id,
          pipeline_stage: pipelineStage,
          lead_date: leadDate,
          follow_up_date: followUpDate || null,
          verification_status: verificationStatus,
          enrollment_status: enrollmentStatus,
          remarks: enrollment.remarks || "",
        }
        : {
          student_id: studentRecord.id,
          course_id: selectedCourse.id,
          batch: enrollment.batch,
          pipeline_stage: pipelineStage,
          lead_date: leadDate,
          enrolled_date: enrolledDate || null,
          joining_date: enrollment.joining_date || null,
          follow_up_date: followUpDate || null,
          payment_method: paymentMethod,
          payment_plan: paymentPlan,
          total_fee: totalFee,
          amount_paid: amountPaid,
          installments_planned: installmentsPlanned,
          installments_paid: installmentsPaid,
          installment_amount: installmentAmount,
          next_due_date: nextDueDate || null,
          payment_status: paymentStatus,
          enrollment_status: enrollmentStatus,
          verification_status: verificationStatus,
          remarks: enrollment.remarks || "",
          dropout_reason: enrollment.dropout_reason || "",
          last_payment_date: lastPaymentDate || null,
          payment_history: paymentHistory,
        };

      const { data: enrollmentRecord, error: enrollmentError, removedColumns: removedEnrollmentColumns = [] } = await runMutationWithSchemaRetry({
        tableName: "enrollments",
        payload: enrollmentPayload,
        execute: (payload) =>
          supabase
            .from("enrollments")
            .insert(payload)
            .select()
            .single(),
      });
      if (enrollmentError) throw formatEnrollmentAccessError(enrollmentError, "insert", "enrollments");

      let documentRecords = [];
      if (documents.length) {
        const payload = documents.map((item) => ({
          enrollment_id: enrollmentRecord.id,
          document_type: item.document_type,
          file_url: item.file_url || "",
          verification_status: verificationStatus,
          remarks: item.remarks || "Uploaded from form",
        }));
        const { data: insertedDocuments, error: documentError } = await runMutationWithSchemaRetry({
          tableName: "documents",
          payload,
          execute: (nextPayload) => supabase.from("documents").insert(nextPayload).select(),
        });
        if (documentError) throw formatEnrollmentAccessError(documentError, "insert", "documents");
        documentRecords = insertedDocuments || [];
      }
      await refreshState(state.authUser);
      pushNotification({ type: "success", title: successTitle });
      void triggerAutomation("enrollment_submitted", { studentRecord, enrollmentRecord });
      return;
    } catch (error) {
      pushNotification({ type: "warning", title: `${isEnquiryCreation ? "Enquiry" : "Enrollment"} save failed: ${error.message}` });
      throw error;
    }
  };

  const convertEnquiryToEnrollment = async ({ enrollmentId, student, enrollment, documents = [] }) => {
    const currentEnrollment = state.enrollments.find((item) => item.id === enrollmentId);
    const currentStudent = state.students.find((item) => item.id === currentEnrollment?.student_id);
    if (!currentEnrollment || !currentStudent) {
      throw new Error("Enquiry record not found.");
    }

    const {
      leadDate,
      pipelineStage,
      totalFee,
      amountPaid,
      paymentPlan,
      paymentMethod,
      installmentsPlanned,
      installmentAmount,
      installmentsPaid,
      paymentStatus,
      enrolledDate,
      followUpDate,
      lastPaymentDate,
      nextDueDate,
      paymentHistory,
      verificationStatus,
      enrollmentStatus,
    } = buildLifecycleEnrollmentState(
      {
        ...currentEnrollment,
        ...enrollment,
        pipeline_stage: "Enrolled",
      },
      currentEnrollment.lead_date || currentEnrollment.created_at || toIsoDate(new Date()),
    );

    if (!hasSupabaseEnv || !supabase) {
      const nextDocuments = documents.map((item) => ({
        id: createId("document"),
        enrollment_id: enrollmentId,
        document_type: item.document_type,
        file_url: item.file_url || "",
        verification_status: verificationStatus,
        remarks: item.remarks || "Uploaded during admission conversion",
        uploaded_at: enrolledDate || leadDate,
      }));

      commitLocalDb((draft) => ({
        ...draft,
        students: draft.students.map((item) => (
          item.id === currentStudent.id
            ? { ...item, ...student }
            : item
        )),
        enrollments: draft.enrollments.map((item) => (
          item.id === enrollmentId
            ? {
              ...item,
              ...enrollment,
              pipeline_stage: pipelineStage,
              lead_date: leadDate,
              enrolled_date: enrolledDate,
              joining_date: enrollment.joining_date || "",
              follow_up_date: followUpDate || "",
              payment_method: paymentMethod,
              payment_plan: paymentPlan,
              total_fee: totalFee,
              amount_paid: amountPaid,
              installments_planned: installmentsPlanned,
              installments_paid: installmentsPaid,
              installment_amount: installmentAmount,
              next_due_date: nextDueDate,
              payment_status: paymentStatus,
              enrollment_status: enrollmentStatus,
              verification_status: verificationStatus,
              last_payment_date: lastPaymentDate,
              payment_history: paymentHistory,
            }
            : item
        )),
        documents: [
          ...nextDocuments,
          ...draft.documents.filter((item) => !nextDocuments.some((doc) => doc.id === item.id)),
        ],
      }), "Enquiry converted to enrolled");
      return;
    }

    const selectedCourse = await resolveCourseRecord({
      courseId: enrollment.course_id || currentEnrollment.course_id,
      courseName: enrollment.course_name || currentEnrollment.course_name,
    });

    const mergedStudentPayload = mergeStoredFields(currentStudent, {
      full_name: student.full_name,
      email: student.email?.trim().toLowerCase() || currentStudent.email,
      phone: student.phone,
      alternate_phone: student.alternate_phone || "",
      college_name: student.college_name || "",
      current_activity: student.current_activity || "",
      place: student.place || "",
      address: student.address || "",
      guardian_name: student.guardian_name || "",
      guardian_relation: student.guardian_relation || "",
      guardian_phone: student.guardian_phone || "",
      aadhaar_id: student.aadhaar_id || "",
      photo_url: student.photo_url || "",
      aadhaar_document_url: student.aadhaar_document_url || "",
      lead_source: student.lead_source || currentStudent.lead_source || "Manual Form",
      notes: student.notes || "",
    });

    const { data: updatedStudent, error: studentUpdateError, removedColumns: removedStudentColumns = [] } = await runMutationWithSchemaRetry({
      tableName: "students",
      payload: mergedStudentPayload,
      execute: (payload) =>
        supabase
          .from("students")
          .update(payload)
          .eq("id", currentStudent.id)
          .select()
          .single(),
    });
    if (studentUpdateError) throw formatEnrollmentAccessError(studentUpdateError, "update", "students");
    if (removedStudentColumns.length) {
      storeShadowStudentPayload(updatedStudent || currentStudent, mergedStudentPayload, removedStudentColumns);
    }

    const enrollmentPayload = {
      course_id: selectedCourse.id,
      batch: enrollment.batch,
      pipeline_stage: pipelineStage,
      lead_date: leadDate,
      enrolled_date: enrolledDate || null,
      joining_date: enrollment.joining_date || null,
      follow_up_date: followUpDate || null,
      payment_method: paymentMethod,
      payment_plan: paymentPlan,
      total_fee: totalFee,
      amount_paid: amountPaid,
      installments_planned: installmentsPlanned,
      installments_paid: installmentsPaid,
      installment_amount: installmentAmount,
      next_due_date: nextDueDate || null,
      payment_status: paymentStatus,
      enrollment_status: enrollmentStatus,
      verification_status: verificationStatus,
      remarks: enrollment.remarks || "",
      dropout_reason: enrollment.dropout_reason || "",
      last_payment_date: lastPaymentDate || null,
      payment_history: paymentHistory,
    };

    const { data: updatedEnrollment, error: enrollmentError, removedColumns: removedEnrollmentColumns = [] } = await runMutationWithSchemaRetry({
      tableName: "enrollments",
      payload: enrollmentPayload,
      execute: (payload) =>
        supabase
          .from("enrollments")
          .update(payload)
          .eq("id", enrollmentId)
          .select()
          .single(),
    });
    if (enrollmentError) throw formatEnrollmentAccessError(enrollmentError, "update", "enrollments");
    if (removedEnrollmentColumns.length) {
      storeShadowEnrollmentPayload(updatedEnrollment || currentEnrollment, enrollmentPayload, removedEnrollmentColumns);
    }

    if (documents.length) {
      const payload = documents.map((item) => ({
        enrollment_id: enrollmentId,
        document_type: item.document_type,
        file_url: item.file_url || "",
        verification_status: verificationStatus,
        remarks: item.remarks || "Uploaded during admission conversion",
      }));
      const { error: documentError } = await runMutationWithSchemaRetry({
        tableName: "documents",
        payload,
        execute: (nextPayload) => supabase.from("documents").insert(nextPayload).select(),
      });
      if (documentError) throw formatEnrollmentAccessError(documentError, "insert", "documents");
    }

    await refreshState(state.authUser);
    pushNotification({ type: "success", title: "Enquiry converted to enrolled" });
  };

  const updateEnrollmentStatus = async (enrollmentId, patch) => {
    if (!hasSupabaseEnv || !supabase) {
      const currentEnrollment = state.enrollments.find((item) => item.id === enrollmentId);
      const normalizedPatch = normalizeStatusPatch(currentEnrollment, patch);

      commitLocalDb((draft) => ({
        ...draft,
        enrollments: draft.enrollments.map((item) => (item.id === enrollmentId ? { ...item, ...normalizedPatch } : item)),
        documents: draft.documents.map((item) => (
          item.enrollment_id === enrollmentId && normalizedPatch.verification_status
            ? { ...item, verification_status: normalizedPatch.verification_status }
            : item
        )),
      }), "Enrollment updated");
      return;
    }

    const currentEnrollment = state.enrollments.find((item) => item.id === enrollmentId);
    const normalizedPatch = normalizeStatusPatch(currentEnrollment, patch);
    const { data: updatedEnrollment, error, removedColumns = [] } = await runMutationWithSchemaRetry({
      tableName: "enrollments",
      payload: normalizedPatch,
      execute: (nextPayload) =>
        supabase
          .from("enrollments")
          .update(nextPayload)
          .eq("id", enrollmentId)
          .select()
          .single(),
    });
    if (error) throw error;
    if (removedColumns.length) {
      storeShadowEnrollmentPayload(updatedEnrollment || currentEnrollment, normalizedPatch, removedColumns);
    }

    if (normalizedPatch.verification_status) {
      const { error: documentError } = await supabase
        .from("documents")
        .update({ verification_status: normalizedPatch.verification_status })
        .eq("enrollment_id", enrollmentId);
      if (documentError) throw formatEnrollmentAccessError(documentError, "update", "documents");
    }

    await triggerAutomation("enrollment_status_updated", { enrollmentId, patch: normalizedPatch });
    await refreshState(state.authUser);
    pushNotification({ type: "success", title: "Enrollment updated" });
  };

  const saveEnrollmentPaymentDetails = async (enrollmentId, patch) => {
    const currentEnrollment = state.enrollments.find((item) => item.id === enrollmentId);
    if (!currentEnrollment) {
      throw new Error("Enrollment not found.");
    }

    const totalFee = Number(patch?.total_fee ?? currentEnrollment.total_fee ?? 0) || 0;
    const amountPaid = Number(patch?.amount_paid ?? resolveAmountPaid(currentEnrollment.amount_paid, currentEnrollment.payment_history) ?? 0) || 0;
    const requestedInstallmentsPlanned = Number(patch?.installments_planned ?? currentEnrollment.installments_planned ?? 0) || 0;
    const paymentPlan = inferPaymentPlan({
      paymentPlan: patch?.payment_plan ?? currentEnrollment.payment_plan ?? "",
      installmentsPlanned: requestedInstallmentsPlanned,
      history: currentEnrollment.payment_history,
      amountPaid,
    }) || (requestedInstallmentsPlanned > 1 ? "EMI" : "One Time");
    const paymentMethod = patch?.payment_method || currentEnrollment.payment_method || (amountPaid > 0 ? "UPI" : "");
    const installmentsPlanned = paymentPlan === "EMI"
      ? Math.max(requestedInstallmentsPlanned || Number(currentEnrollment.installments_planned || 0) || 2, 2)
      : 1;
    const installmentAmount = paymentPlan === "EMI" && installmentsPlanned
      ? Math.round(totalFee / installmentsPlanned)
      : totalFee;
    const installmentsPaid = calculateInstallmentsPaid({
      paymentPlan,
      amountPaid,
      installmentAmount,
      installmentsPlanned,
    });
    const leadDate = toIsoDate(currentEnrollment.lead_date || currentEnrollment.created_at || new Date());
    const enrolledDate = toIsoDate(currentEnrollment.enrolled_date || leadDate);
    const lastPaymentDate = amountPaid > 0
      ? toIsoDate(patch?.last_payment_date || currentEnrollment.last_payment_date || enrolledDate || leadDate)
      : "";
    const normalizedExistingHistory = normalizePaymentHistoryList(currentEnrollment.payment_history, {
      totalFee,
      paymentPlan,
      paymentMethod,
      installmentsPlanned,
      amountPaid,
    });
    const normalizedExistingHistoryAmount = resolveAmountPaid(null, normalizedExistingHistory);
    const paymentHistory = normalizedExistingHistory.length && Math.abs((normalizedExistingHistoryAmount || 0) - amountPaid) < 0.01
      ? normalizedExistingHistory
      : buildInitialPaymentHistory({
        ...currentEnrollment,
        total_fee: totalFee,
        payment_plan: paymentPlan,
        payment_method: paymentMethod,
        installments_planned: installmentsPlanned,
        enrolled_date: enrolledDate,
        last_payment_date: lastPaymentDate,
      }, amountPaid, leadDate);
    const paymentStatus = normalizePaymentStatus(totalFee, amountPaid);
    const nextDueDate = resolveNextDueDate({
      paymentStatus,
      lastPaymentDate,
      enrolledDate,
      leadDate,
      fallbackDate: patch?.next_due_date || currentEnrollment.next_due_date || "",
    });
    const normalizedPatch = {
      total_fee: totalFee,
      amount_paid: amountPaid,
      payment_plan: paymentPlan,
      payment_method: paymentMethod,
      installments_planned: installmentsPlanned,
      installments_paid: installmentsPaid,
      installment_amount: installmentAmount,
      payment_status: paymentStatus,
      last_payment_date: lastPaymentDate,
      next_due_date: nextDueDate,
      payment_history: paymentHistory,
    };

    if (!hasSupabaseEnv || !supabase) {
      commitLocalDb((draft) => ({
        ...draft,
        enrollments: draft.enrollments.map((item) => (
          item.id === enrollmentId
            ? { ...item, ...normalizedPatch }
            : item
        )),
      }), "Payment details updated");
      return;
    }

    const { error, removedColumns = [] } = await runMutationWithSchemaRetry({
      tableName: "enrollments",
      payload: normalizedPatch,
      execute: (nextPayload) => supabase.from("enrollments").update(nextPayload).eq("id", enrollmentId).select().single(),
    });
    if (error) throw formatEnrollmentAccessError(error, "update", "enrollments");
    if (removedColumns.length) {
      storeShadowEnrollmentPayload(currentEnrollment, normalizedPatch, removedColumns);
    }

    await refreshState(state.authUser);
    pushNotification({ type: "success", title: "Payment details updated" });
  };

  const markInstallmentPaid = async (enrollmentId, paymentMode = "UPI") => {
    if (!hasSupabaseEnv || !supabase) {
      commitLocalDb((draft) => {
        draft.enrollments = draft.enrollments.map((item) => {
          if (item.id !== enrollmentId) return item;
          return {
            ...item,
            ...buildRecordedPaymentState(item, paymentMode),
          };
        });
        return draft;
      }, "Payment recorded");
      return;
    }

    const currentEnrollment = state.enrollments.find((item) => item.id === enrollmentId);
    if (!currentEnrollment) {
      throw new Error("Enrollment not found for payment update.");
    }

    const paymentPatch = buildRecordedPaymentState(currentEnrollment, paymentMode);
    const { error, removedColumns = [] } = await runMutationWithSchemaRetry({
      tableName: "enrollments",
      payload: paymentPatch,
      execute: (nextPayload) => supabase.from("enrollments").update(nextPayload).eq("id", enrollmentId).select().single(),
    });
    if (error) throw formatEnrollmentAccessError(error, "update", "enrollments");
    if (removedColumns.length) {
      storeShadowEnrollmentPayload(currentEnrollment, paymentPatch, removedColumns);
    }

    await refreshState(state.authUser);
    pushNotification({ type: "success", title: "Payment recorded" });
  };

  const importStudentsFromCsv = async (rows) => {
    if (!rows?.length) {
      throw new Error("Upload a CSV file with at least one student row.");
    }

    if (!hasSupabaseEnv || !supabase) {
      let imported = 0;

      commitLocalDb((draft) => {
        rows.forEach((row) => {
          if (!row.full_name || !row.email) return;

          const course = draft.courses.find(
            (item) =>
              item.course_name.toLowerCase() === String(row.course_name || "").trim().toLowerCase()
              || item.id === row.course_id,
          ) || draft.courses[0];
          const leadDate = toIsoDate(row.lead_date || new Date());
          const studentId = createId("student");
          const enrollmentId = createId("enrollment");
          const totalFee = Number(row.total_fee || course?.fee || 0);
          const amountPaid = Number(row.amount_paid || 0);
          const paymentPlan = inferPaymentPlan({
            paymentPlan: row.payment_plan || "",
            installmentsPlanned: row.installments_planned || 0,
            amountPaid,
          }) || "One Time";
          const installmentsPlanned = Number(row.installments_planned || (paymentPlan === "EMI" ? 3 : 1));
          const installmentAmount = paymentPlan === "EMI" && installmentsPlanned ? Math.round(totalFee / installmentsPlanned) : totalFee;
          const stage = row.pipeline_stage || (row.enrolled_date ? "Enrolled" : "Enquiry");
          const paymentStatus = normalizePaymentStatus(totalFee, amountPaid);
          const enrolledDate = row.enrolled_date || "";
          const lastPaymentDate = row.last_payment_date || (amountPaid > 0 ? (enrolledDate || leadDate) : "");
          const paymentMethod = row.payment_method || (amountPaid > 0 ? "UPI" : "");
          const paymentHistory = buildInitialPaymentHistory({
            total_fee: totalFee,
            payment_plan: paymentPlan,
            payment_method: paymentMethod,
            installments_planned: installmentsPlanned,
            enrolled_date: enrolledDate,
            last_payment_date: lastPaymentDate,
          }, amountPaid, leadDate);

          draft.students.unshift({
            id: studentId,
            full_name: row.full_name,
            email: row.email,
            phone: row.phone || "",
            alternate_phone: row.alternate_phone || "",
            address: row.address || "",
            place: row.place || "",
            college_name: row.college_name || "",
            current_activity: row.current_activity || "",
            guardian_name: row.guardian_name || "",
            guardian_relation: row.guardian_relation || "",
            guardian_phone: row.guardian_phone || "",
            aadhaar_id: row.aadhaar_id || "",
            photo_url: "",
            aadhaar_document_url: "",
            lead_source: row.lead_source || "CSV Upload",
            notes: row.notes || "",
            created_at: leadDate,
          });

          draft.enrollments.unshift({
            id: enrollmentId,
            student_id: studentId,
            course_id: course?.id || "",
            batch: row.batch || course?.batch || "",
            pipeline_stage: stage,
            lead_date: leadDate,
            enrolled_date: enrolledDate,
            follow_up_date: row.follow_up_date || addDays(leadDate, 3),
            payment_method: paymentMethod,
            payment_plan: paymentPlan,
            total_fee: totalFee,
            amount_paid: amountPaid,
            installments_planned: installmentsPlanned,
            installments_paid: calculateInstallmentsPaid({
              paymentPlan,
              amountPaid,
              installmentAmount,
              installmentsPlanned,
            }),
            installment_amount: installmentAmount,
            next_due_date: resolveNextDueDate({
              paymentStatus,
              lastPaymentDate,
              enrolledDate,
              leadDate,
              fallbackDate: row.next_due_date || "",
            }),
            payment_status: paymentStatus,
            enrollment_status: row.enrollment_status || (stage === "Enrolled" ? "Active" : stage === "Dropout" ? "Dropped" : "Follow-up"),
            verification_status: row.verification_status || (stage === "Enrolled" ? "Approved" : "Pending"),
            remarks: row.remarks || "",
            dropout_reason: row.dropout_reason || "",
            last_payment_date: lastPaymentDate,
            payment_history: paymentHistory,
            created_at: leadDate,
          });

          imported += 1;
        });

        return draft;
      }, `${imported} student records imported`);
      return { imported };
    }

    throw new Error("CSV import is currently available in local demo mode.");
  };

  const saveEmailTemplate = async (template) => {
    if (!hasSupabaseEnv || !supabase) {
      commitLocalDb((draft) => ({
        ...draft,
        emailTemplates: template.id
          ? draft.emailTemplates.map((item) => (item.id === template.id ? { ...item, ...template } : item))
          : [{ id: createId("template"), ...template }, ...draft.emailTemplates],
      }), "Email template saved");
      return;
    }

    const { error } = await supabase.from("email_templates").upsert(template.id ? template : {
      template_name: template.template_name,
      subject: template.subject,
      body: template.body,
    });
    if (error) throw error;
    await refreshState(state.authUser);
    pushNotification({ type: "success", title: "Email template saved" });
  };

  const logEmail = async (emailType, enrollment) => {
    if (!hasSupabaseEnv || !supabase) {
      commitLocalDb((draft) => ({
        ...draft,
        emailLogs: [
          {
            id: createId("email"),
            enrollment_id: enrollment.id,
            email_type: emailType,
            status: "Queued",
            sent_at: new Date().toISOString(),
          },
          ...draft.emailLogs,
        ],
      }), `${emailType} queued`);
      return;
    }

    const result = await sendEmailTrigger(emailType, enrollment);
    const log = {
      enrollment_id: enrollment.id,
      email_type: emailType,
      status: result.status,
    };
    const { error } = await supabase.from("email_logs").insert(log);
    if (error) throw error;
    await refreshState(state.authUser);
    pushNotification({ type: "success", title: `${emailType} email queued` });
  };

  const askAgent = async (message) => {
    const response = buildAgentResponse({
      message,
      enrollments: state.enrollments,
      students: state.students,
      courses: state.courses,
      activeRole: state.currentUser?.role || "admin",
    });

    const log = {
      id: createId("agent"),
      enrollment_id: null,
      user_message: message,
      agent_response: response.reply,
      next_action: response.nextAction,
      created_at: new Date().toISOString(),
    };

    if (!hasSupabaseEnv || !supabase) {
      commitLocalDb((draft) => ({
        ...draft,
        agentLogs: [log, ...draft.agentLogs],
      }));
      return response;
    }

    await supabase.from("agent_logs").insert(log);
    await triggerAutomation("agent_guidance", { message, response });
    await refreshState(state.authUser);
    return response;
  };

  const uploadDocument = async ({ enrollmentId, file, documentType, remarks }) => {
    if (!hasSupabaseEnv || !supabase) {
      const fileUrl = URL.createObjectURL(file);
      const enrollmentRecord = state.enrollments.find((item) => item.id === enrollmentId);
      commitLocalDb((draft) => ({
        ...draft,
        documents: [
          {
            id: createId("document"),
            enrollment_id: enrollmentId,
            document_type: documentType,
            file_url: fileUrl,
            verification_status: enrollmentRecord?.verification_status || "Pending",
            remarks,
            uploaded_at: new Date().toISOString(),
          },
          ...draft.documents,
        ],
      }), `${documentType} uploaded`);
      return;
    }

    const enrollmentRecord = state.enrollments.find((item) => item.id === enrollmentId);
    await uploadEnrollmentDocument({
      enrollmentId,
      file,
      documentType,
      remarks,
      verificationStatus: enrollmentRecord?.verification_status || "Pending",
    });
    await triggerAutomation("document_uploaded", { enrollmentId, documentType, fileName: file.name });
    await refreshState(state.authUser);
    pushNotification({ type: "success", title: `${documentType} uploaded` });
  };

  const portalRecords = useMemo(
    () => toPortalRecords(state.students, state.enrollments, state.courses, state.documents),
    [state.courses, state.documents, state.enrollments, state.students],
  );

  const dashboardMetrics = useMemo(() => buildDashboardMetrics(portalRecords), [portalRecords]);

  const value = useMemo(
    () => ({
      ...state,
      demoMode: !hasSupabaseEnv,
      portalRecords,
      dashboardMetrics,
      googleFormFields,
      googleAppsScriptSnippet,
      login,
      loginAsRole,
      logout,
      resetPassword,
      createEnrollment,
      convertEnquiryToEnrollment,
      updateEnrollmentStatus,
      saveEnrollmentPaymentDetails,
      markInstallmentPaid,
      importStudentsFromCsv,
      saveEmailTemplate,
      logEmail,
      askAgent,
      uploadDocument,
      refreshState,
    }),
    [dashboardMetrics, portalRecords, state],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}

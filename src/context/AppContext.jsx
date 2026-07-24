import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createDemoPortalState } from "../data/demoPortal";
import { canonicalCourseSeeds, decorateCourseRecord, findCourseByReference } from "../data/courseCatalog";
import { hasSupabaseEnv, supabase, supabaseUrl } from "../lib/supabase";
import { sendAdmissionFollowUpEmail, sendEmailTrigger, sendPaymentStatusEmail } from "../services/emailService";
import { triggerAutomation } from "../services/automationService";
import { uploadEnrollmentDocument } from "../services/enrollmentService";
import { addDays, toIsoDate } from "../utils/dateMath";
import {
  ENQUIRY_MAX_FOLLOW_UP_CYCLES,
  compareIsoDates,
  getDisplayEnquiryFollowUpDate,
  getFinalEnquiryFollowUpDate,
  getInitialEnquiryFollowUpDate,
  getNextEnquiryFollowUpDate,
  getTodayIsoDate,
  getDerivedDropoutDate,
  getEnrollmentTimelineValidationMessage,
  shouldAutoDropoutEnquiry,
} from "../utils/enrollmentDateValidation";
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
import { getNextEnrolledStudentCode } from "../utils/studentCode";

const LOCAL_DB_KEY = "enrollease-demo-db-v2";
const LOCAL_SESSION_KEY = "enrollease-demo-session-v2";
const SUPABASE_SHADOW_KEY = "enrollease-supabase-shadow-v1";
const REMOTE_STATE_CACHE_KEY = "enrollease-remote-state-v2";
const LEGACY_BROWSER_CACHE_KEYS = [
  "enrollease-remote-state-v1",
];
const REMOTE_CACHE_MAX_STUDENTS = 250;
const REMOTE_CACHE_MAX_ENROLLMENTS = 250;
const REMOTE_CACHE_MAX_COURSES = 80;
const REMOTE_CACHE_MAX_PROFILES = 20;
const REMOTE_CACHE_MAX_EMAIL_LOGS = 200;
const SUPABASE_BOOT_TIMEOUT_MS = 30000;
const SUPABASE_LOGIN_SOFT_TIMEOUT_MS = 30000;
const SUPABASE_LOGIN_RECOVERY_TIMEOUT_MS = 45000;
const SUPABASE_SESSION_ACTIVATION_TIMEOUT_MS = 8000;
const SUPABASE_LOGIN_POLL_INTERVAL_MS = 1500;
const AUTOMATION_RECHECK_INTERVAL_MS = 60 * 1000;
const CRITICAL_REMOTE_TIMEOUT_MS = 2000;
const DEFERRED_REMOTE_TIMEOUT_MS = 30000;
const SERVER_SIDE_AUTOMATIONS_ENABLED = String(import.meta.env.VITE_SERVER_SIDE_AUTOMATIONS || "").trim().toLowerCase() === "true";
const criticalPortalTables = [
  { key: "profiles", table: "profiles", queryBuilder: (query) => query.select("*") },
  { key: "courses", table: "courses", queryBuilder: (query) => query.select("*").order("course_name", { ascending: true }) },
];
const deferredPortalTables = [
  {
    key: "students",
    table: "students",
    queryBuilder: (query) => query.select("*").order("created_at", { ascending: false }),
  },
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
  {
    key: "emailLogs",
    table: "email_logs",
    queryBuilder: (query) => query.select("*").order("sent_at", { ascending: false }),
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
const GIRL_NAME_PREFIXES = [
  "priya",
  "aditi",
  "neha",
  "kavya",
  "ishita",
  "deepu",
  "deepa",
  "deepika",
  "deepthi",
  "chandana",
  "triveni",
  "trivei",
  "rosy",
  "rose",
  "riya",
  "rhea",
  "roshni",
  "sneha",
  "divya",
  "navya",
];
const BOY_NAME_PREFIXES = [
  "karthik",
  "sameer",
  "rahul",
  "joseph",
  "mehul",
  "dhanu",
  "dhananjaya",
  "rohit",
  "roshan",
  "rakesh",
  "rajesh",
  "raj",
  "arjun",
  "akhil",
  "ajay",
  "nikhil",
  "naveen",
  "vivek",
  "vishal",
  "varun",
  "harsha",
  "tejas",
  "charan",
  "ganesh",
  "sai",
  "manoj",
  "yash",
];
const AUTO_DROPOUT_REASONS = new Set([
  "Automatically moved to dropout after two follow-up cycles.",
  "Automatically moved to dropout after the follow-up date passed.",
]);

const defaultState = {
  currentUser: null,
  authUser: null,
  profiles: [],
  students: [],
  courses: [],
  enrollments: [],
  documents: [],
  emailLogs: [],
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

function sleep(milliseconds) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, milliseconds);
  });
}

async function waitForSupabaseSession(expectedEmail, timeoutMs) {
  const expectedEmailKey = normalizeEmailKey(expectedEmail);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (!error) {
        const sessionUser = data.session?.user || null;
        const sessionEmailKey = normalizeEmailKey(sessionUser?.email || "");
        if (
          sessionUser
          && (!expectedEmailKey || !sessionEmailKey || sessionEmailKey === expectedEmailKey)
        ) {
          return sessionUser;
        }
      }
    } catch {
      // Keep polling for the active session while the original login request is still in flight.
    }

    const remainingMilliseconds = deadline - Date.now();
    if (remainingMilliseconds <= 0) {
      break;
    }

    await sleep(Math.min(SUPABASE_LOGIN_POLL_INTERVAL_MS, remainingMilliseconds));
  }

  return null;
}

async function signInWithSessionRecovery({ email, password }) {
  const safeEmail = normalizeEmailKey(email);
  const signInPromise = supabase.auth
    .signInWithPassword({ email: safeEmail, password })
    .then(async ({ data, error }) => {
      if (error) {
        throw error;
      }

      const signedInUser = data.user || data.session?.user;
      if (!signedInUser) {
        throw new Error("Signed in successfully, but no user was returned by Supabase.");
      }

      const activatedSessionUser = await waitForSupabaseSession(safeEmail, SUPABASE_SESSION_ACTIVATION_TIMEOUT_MS);

      return {
        data,
        signedInUser: activatedSessionUser || signedInUser,
      };
    });

  const recoveredSessionPromise = (async () => {
    await sleep(SUPABASE_LOGIN_SOFT_TIMEOUT_MS);
    const recoveredUser = await waitForSupabaseSession(safeEmail, SUPABASE_LOGIN_RECOVERY_TIMEOUT_MS);

    if (!recoveredUser) {
      throw new Error("Signing in is taking longer than expected. Please check your connection and try again.");
    }

    return {
      data: {
        user: recoveredUser,
        session: { user: recoveredUser },
      },
      signedInUser: recoveredUser,
    };
  })();

  return Promise.race([signInPromise, recoveredSessionPromise]);
}

function isCriticalSchemaColumn(tableName, columnName) {
  return criticalSchemaColumnsByTable[tableName]?.has(columnName) || false;
}

function buildMissingSchemaColumnError(tableName, columnName) {
  return new Error(
    `Supabase is missing the \`${columnName}\` column on \`${tableName}\`. Run the required migration in the Supabase SQL Editor, then try again.`,
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

function isQuotaExceededError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.name === "QuotaExceededError"
    || error?.code === 22
    || message.includes("quota")
    || message.includes("exceeded the quota")
  );
}

function writeJson(key, value, options = {}) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    if (options?.allowFailure || isQuotaExceededError(error)) {
      console.warn(`Skipping localStorage write for ${key}:`, error);
      try {
        if (key === REMOTE_STATE_CACHE_KEY) {
          window.localStorage.removeItem(key);
        }
      } catch {}
      return false;
    }

    throw error;
  }
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

function normalizeRemoteStateCacheEntry(entry = {}) {
  const safeEntry = entry && typeof entry === "object" ? entry : {};
  const safeState = safeEntry.state && typeof safeEntry.state === "object" ? safeEntry.state : {};

  return {
    sessionEmail: normalizeEmailKey(safeEntry.sessionEmail || ""),
    state: {
      profiles: Array.isArray(safeState.profiles) ? safeState.profiles : [],
      students: Array.isArray(safeState.students) ? safeState.students : [],
      courses: normalizeCourseRecords(Array.isArray(safeState.courses) ? safeState.courses : []),
      enrollments: dedupeRecordsById(Array.isArray(safeState.enrollments) ? safeState.enrollments : []),
      documents: Array.isArray(safeState.documents) ? safeState.documents : [],
      emailLogs: Array.isArray(safeState.emailLogs) ? safeState.emailLogs : [],
      auditLogs: Array.isArray(safeState.auditLogs) ? safeState.auditLogs : [],
      currentUser: safeState.currentUser && typeof safeState.currentUser === "object" ? safeState.currentUser : null,
    },
  };
}

function readRemoteStateCache(sessionUser) {
  const cachedEntry = normalizeRemoteStateCacheEntry(readJson(REMOTE_STATE_CACHE_KEY));
  const sessionEmail = normalizeEmailKey(sessionUser?.email || "");
  if (!cachedEntry.sessionEmail || cachedEntry.sessionEmail !== sessionEmail) {
    return null;
  }

  return cachedEntry.state;
}

function sanitizeCacheUrl(value = "") {
  const url = String(value || "").trim();
  if (!url || url.startsWith("data:")) {
    return "";
  }
  return url;
}

function sanitizeStudentForCache(student = {}) {
  return {
    id: student.id || "",
    student_code: student.student_code || "",
    full_name: student.full_name || "",
    email: student.email || "",
    phone: student.phone || "",
    alternate_phone: student.alternate_phone || "",
    address: student.address || "",
    place: student.place || "",
    college_name: student.college_name || "",
    current_activity: student.current_activity || "",
    guardian_name: student.guardian_name || "",
    guardian_relation: student.guardian_relation || "",
    guardian_phone: student.guardian_phone || "",
    aadhaar_id: student.aadhaar_id || "",
    lead_source: student.lead_source || "",
    photo_url: sanitizeCacheUrl(student.photo_url),
    aadhaar_document_url: sanitizeCacheUrl(student.aadhaar_document_url),
    created_at: student.created_at || "",
  };
}

function sanitizeEnrollmentForCache(enrollment = {}) {
  return {
    ...enrollment,
    payment_history: Array.isArray(enrollment.payment_history) ? enrollment.payment_history.slice(0, 12) : [],
    remarks: typeof enrollment.remarks === "string" ? enrollment.remarks.slice(0, 500) : enrollment.remarks,
    notes: typeof enrollment.notes === "string" ? enrollment.notes.slice(0, 500) : enrollment.notes,
  };
}

function sanitizeCourseForCache(course = {}) {
  return {
    id: course.id || "",
    course_name: course.course_name || "",
    batch: course.batch || "",
    fee: course.fee ?? null,
    duration: course.duration || "",
    mode: course.mode || "",
    active_status: course.active_status !== false,
  };
}

function sanitizeProfileForCache(profile = {}) {
  return {
    id: profile.id || "",
    user_id: profile.user_id || "",
    full_name: profile.full_name || "",
    email: profile.email || "",
    role: profile.role || "",
    created_at: profile.created_at || "",
  };
}

function sanitizeEmailLogForCache(log = {}) {
  return {
    id: log.id || "",
    enrollment_id: log.enrollment_id || "",
    email_type: log.email_type || "",
    status: log.status || "",
    sent_at: log.sent_at || "",
  };
}

function writeRemoteStateCache(sessionUser, stateSnapshot) {
  const sessionEmail = normalizeEmailKey(sessionUser?.email || "");
  if (!sessionEmail) return;

  writeJson(REMOTE_STATE_CACHE_KEY, normalizeRemoteStateCacheEntry({
    sessionEmail,
    state: {
      profiles: Array.isArray(stateSnapshot?.profiles)
        ? stateSnapshot.profiles.slice(0, REMOTE_CACHE_MAX_PROFILES).map(sanitizeProfileForCache)
        : [],
      students: Array.isArray(stateSnapshot?.students)
        ? stateSnapshot.students.slice(0, REMOTE_CACHE_MAX_STUDENTS).map(sanitizeStudentForCache)
        : [],
      courses: Array.isArray(stateSnapshot?.courses)
        ? stateSnapshot.courses.slice(0, REMOTE_CACHE_MAX_COURSES).map(sanitizeCourseForCache)
        : [],
      enrollments: Array.isArray(stateSnapshot?.enrollments)
        ? stateSnapshot.enrollments.slice(0, REMOTE_CACHE_MAX_ENROLLMENTS).map(sanitizeEnrollmentForCache)
        : [],
      documents: [],
      emailLogs: Array.isArray(stateSnapshot?.emailLogs)
        ? stateSnapshot.emailLogs.slice(0, REMOTE_CACHE_MAX_EMAIL_LOGS).map(sanitizeEmailLogForCache)
        : [],
      auditLogs: [],
      currentUser: stateSnapshot?.currentUser || null,
    },
  }), { allowFailure: true });
}

function cleanupLegacyBrowserStorage() {
  if (typeof window === "undefined") return;

  LEGACY_BROWSER_CACHE_KEYS.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {}
  });
}

function trimBrowserStorageForSupabaseMode() {
  if (typeof window === "undefined" || !hasSupabaseEnv) return;

  try {
    window.localStorage.removeItem(LOCAL_DB_KEY);
  } catch {}
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

function getSupabaseProjectRef(url = "") {
  const match = String(url || "").match(/^https:\/\/([^.]+)\.supabase\.co/i);
  return match?.[1] || "";
}

function publishRuntimeDebugSnapshot(label, sessionUser, stateSnapshot = {}) {
  if (typeof window === "undefined") return;

  const debugSnapshot = {
    label,
    projectUrl: supabaseUrl || "",
    projectRef: getSupabaseProjectRef(supabaseUrl),
    sessionUser: sessionUser
      ? {
        id: sessionUser.id || "",
        email: sessionUser.email || "",
      }
      : null,
    counts: {
      profiles: stateSnapshot?.profiles?.length || 0,
      students: stateSnapshot?.students?.length || 0,
      courses: stateSnapshot?.courses?.length || 0,
      enrollments: stateSnapshot?.enrollments?.length || 0,
      documents: stateSnapshot?.documents?.length || 0,
      emailLogs: stateSnapshot?.emailLogs?.length || 0,
      auditLogs: stateSnapshot?.auditLogs?.length || 0,
    },
    generatedAt: new Date().toISOString(),
  };

  window.__ENROLLEASE_RUNTIME__ = debugSnapshot;
  console.log("EnrollEase runtime debug:", debugSnapshot);
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

function clearSupabaseModeLocalData() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(LOCAL_DB_KEY);
  window.localStorage.removeItem(SUPABASE_SHADOW_KEY);
}

function hasLinkedPortalRecords(students = [], enrollments = []) {
  if (!Array.isArray(students) || !Array.isArray(enrollments) || !students.length || !enrollments.length) {
    return false;
  }

  const studentIds = new Set(
    students
      .map((student) => student?.id)
      .filter(Boolean),
  );

  return enrollments.some((enrollment) => studentIds.has(enrollment?.student_id));
}

function hasUsableLocalDbSnapshot(db = {}) {
  return Boolean(
    Array.isArray(db?.profiles)
    && db.profiles.length
    && Array.isArray(db?.courses)
    && db.courses.length
    && hasLinkedPortalRecords(db.students, db.enrollments),
  );
}

function hasRemotePortalContent(stateSnapshot = {}) {
  return Boolean(
    stateSnapshot.students?.length
    || stateSnapshot.enrollments?.length
    || stateSnapshot.documents?.length
    || stateSnapshot.emailLogs?.length
    || stateSnapshot.auditLogs?.length,
  );
}

function ensureLocalDb() {
  const db = readJson(LOCAL_DB_KEY);
  if (hasUsableLocalDbSnapshot(db)) return db;
  const seeded = createDemoPortalState();
  writeJson(LOCAL_DB_KEY, seeded);
  return seeded;
}

function buildLocalState(db, sessionEmail = "") {
  const normalizedSessionEmail = normalizeEmailKey(sessionEmail || readLocalSessionEmail());
  const profile = normalizedSessionEmail
    ? db.profiles.find((item) => normalizeEmailKey(item.email) === normalizedSessionEmail) || null
    : null;
  const { agentLogs: _agentLogs, ...localDb } = db;
  return {
    ...defaultState,
    ...localDb,
    courses: db.courses.map((course) => decorateCourseRecord(course)),
    documents: normalizeDocumentsForDisplay(db.documents, db.enrollments),
    authUser: profile ? { id: profile.user_id, email: profile.email } : null,
    currentUser: profile,
    loading: false,
  };
}

function hasMeaningfulPortalData(stateSnapshot = {}) {
  return hasRemotePortalContent(stateSnapshot);
}

function normalizePaymentStatus(totalFee, amountPaid) {
  if (amountPaid <= 0) return "Pending";
  if (amountPaid >= totalFee) return "Paid";
  return "Partial";
}

function hasValue(value) {
  return value !== null && value !== undefined && (typeof value !== "string" || value.trim() !== "");
}

const csvImportFieldAliases = {
  student_code: ["student_code", "student code", "student id", "studentid", "custom id", "custom code", "admission id"],
  full_name: ["full_name", "full name", "student_name", "student name", "candidate name", "candidate_name", "name"],
  first_name: ["first_name", "first name"],
  last_name: ["last_name", "last name", "surname"],
  email: ["email", "email id", "email_id", "mail", "mail id", "e mail"],
  phone: ["phone", "phone number", "mobile", "mobile no", "mobile number", "contact", "contact number"],
  alternate_phone: ["alternate_phone", "alternate phone", "alt phone", "alt_phone", "secondary phone"],
  address: ["address", "student address", "residential address"],
  place: ["place", "city", "location", "district", "town"],
  college_name: ["college_name", "college name", "college", "clg", "institution", "school"],
  current_activity: ["current_activity", "current activity", "current qualification", "qualification", "activity", "status", "i am a"],
  guardian_name: ["guardian_name", "guardian name", "parent name", "father name", "mother name"],
  guardian_relation: ["guardian_relation", "guardian relation", "relation", "parent relation"],
  guardian_phone: ["guardian_phone", "guardian phone", "parent phone", "parent mobile"],
  aadhaar_id: ["aadhaar_id", "aadhaar", "aadhaar number", "aadhar", "aadhar number"],
  lead_source: ["lead_source", "lead source", "source", "source name"],
  course_id: ["course_id", "course id", "course code"],
  course_name: [
    "course_name",
    "course name",
    "course",
    "interested course",
    "interested_course",
    "selected course",
    "choose interested course",
    "choose interested curse",
  ],
  lead_date: ["lead_date", "lead date", "enquiry date", "enquiry_date", "date"],
  follow_up_date: ["follow_up_date", "follow up date", "follow-up date", "next follow up", "next follow-up"],
  batch: ["batch", "batch name"],
  enrolled_date: ["enrolled_date", "enrolled date", "admission date", "joining date"],
  payment_plan: ["payment_plan", "payment plan", "plan"],
  payment_method: ["payment_method", "payment method", "payment mode", "mode of payment"],
  total_fee: ["total_fee", "total fee", "course fee", "fee"],
  amount_paid: ["amount_paid", "amount paid", "paid amount", "advance amount", "advance paid"],
  installments_planned: ["installments_planned", "installments planned", "number of installments", "emi count"],
  next_due_date: ["next_due_date", "next due date", "due date"],
  enrollment_status: ["enrollment_status", "enrollment status", "lead status", "status"],
  verification_status: ["verification_status", "verification status"],
  remarks: ["remarks", "remark", "comments", "comment"],
  notes: ["notes", "note", "description"],
  pipeline_stage: ["pipeline_stage", "pipeline stage", "stage"],
  dropout_reason: ["dropout_reason", "dropout reason"],
};

const normalizedCsvImportAliasEntries = Object.entries(csvImportFieldAliases).map(([fieldName, aliases]) => [
  fieldName,
  aliases.map((alias) => normalizeCsvImportHeader(alias)),
]);

const allNormalizedCsvImportAliases = new Set(normalizedCsvImportAliasEntries.flatMap(([, aliases]) => aliases));

function normalizeCsvImportHeader(header = "") {
  return String(header || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleCaseImportValue(value = "") {
  return String(value || "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getCsvImportValue(normalizedRowEntries, fieldName) {
  const aliases = normalizedCsvImportAliasEntries.find(([name]) => name === fieldName)?.[1] || [];
  for (const alias of aliases) {
    const value = normalizedRowEntries.get(alias);
    if (hasValue(value)) {
      return String(value).trim();
    }
  }
  return "";
}

function buildImportedStudentName({ fullName, email, phone, rowIndex }) {
  if (hasValue(fullName)) return String(fullName).trim();
  if (hasValue(email)) {
    return titleCaseImportValue(String(email).split("@")[0]) || `Imported Student ${rowIndex + 1}`;
  }
  if (hasValue(phone)) {
    const lastDigits = String(phone).replace(/\D/g, "").slice(-4);
    return lastDigits ? `Student ${lastDigits}` : `Imported Student ${rowIndex + 1}`;
  }
  return `Imported Student ${rowIndex + 1}`;
}

function buildImportedPlaceholderEmail(rowIndex) {
  return `imported-student-${Date.now()}-${rowIndex + 1}@enrollease.local`;
}

function normalizeImportedCsvRow(row, rowIndex) {
  const normalizedEntries = new Map();

  Object.entries(row || {}).forEach(([key, value]) => {
    if (!hasValue(value)) return;
    const normalizedKey = normalizeCsvImportHeader(key);
    if (!normalizedKey || normalizedEntries.has(normalizedKey)) return;
    normalizedEntries.set(normalizedKey, String(value).trim());
  });

  const firstName = getCsvImportValue(normalizedEntries, "first_name");
  const lastName = getCsvImportValue(normalizedEntries, "last_name");
  const combinedName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const email = getCsvImportValue(normalizedEntries, "email").toLowerCase();
  const phone = getCsvImportValue(normalizedEntries, "phone");

  const unknownFieldNotes = Object.entries(row || {})
    .filter(([key, value]) => hasValue(value) && !allNormalizedCsvImportAliases.has(normalizeCsvImportHeader(key)))
    .map(([key, value]) => `${String(key).trim()}: ${String(value).trim()}`);

  const hasSourceValues = normalizedEntries.size > 0 || unknownFieldNotes.length > 0;
  const remarks = [
    getCsvImportValue(normalizedEntries, "remarks"),
    ...unknownFieldNotes,
  ].filter(Boolean).join(" | ");

  const notes = getCsvImportValue(normalizedEntries, "notes");
  const fullName = hasSourceValues
    ? buildImportedStudentName({
      fullName: getCsvImportValue(normalizedEntries, "full_name") || combinedName,
      email,
      phone,
      rowIndex,
    })
    : "";

  const mappedRow = {
    student_code: getCsvImportValue(normalizedEntries, "student_code"),
    full_name: fullName,
    email,
    phone,
    alternate_phone: getCsvImportValue(normalizedEntries, "alternate_phone"),
    address: getCsvImportValue(normalizedEntries, "address"),
    place: getCsvImportValue(normalizedEntries, "place"),
    college_name: getCsvImportValue(normalizedEntries, "college_name"),
    current_activity: getCsvImportValue(normalizedEntries, "current_activity"),
    guardian_name: getCsvImportValue(normalizedEntries, "guardian_name"),
    guardian_relation: getCsvImportValue(normalizedEntries, "guardian_relation"),
    guardian_phone: getCsvImportValue(normalizedEntries, "guardian_phone"),
    aadhaar_id: getCsvImportValue(normalizedEntries, "aadhaar_id"),
    lead_source: getCsvImportValue(normalizedEntries, "lead_source"),
    course_id: getCsvImportValue(normalizedEntries, "course_id"),
    course_name: getCsvImportValue(normalizedEntries, "course_name"),
    lead_date: getCsvImportValue(normalizedEntries, "lead_date"),
    follow_up_date: getCsvImportValue(normalizedEntries, "follow_up_date"),
    batch: getCsvImportValue(normalizedEntries, "batch"),
    enrolled_date: getCsvImportValue(normalizedEntries, "enrolled_date"),
    payment_plan: getCsvImportValue(normalizedEntries, "payment_plan"),
    payment_method: getCsvImportValue(normalizedEntries, "payment_method"),
    total_fee: getCsvImportValue(normalizedEntries, "total_fee"),
    amount_paid: getCsvImportValue(normalizedEntries, "amount_paid"),
    installments_planned: getCsvImportValue(normalizedEntries, "installments_planned"),
    next_due_date: getCsvImportValue(normalizedEntries, "next_due_date"),
    enrollment_status: getCsvImportValue(normalizedEntries, "enrollment_status"),
    verification_status: getCsvImportValue(normalizedEntries, "verification_status"),
    pipeline_stage: getCsvImportValue(normalizedEntries, "pipeline_stage"),
    dropout_reason: getCsvImportValue(normalizedEntries, "dropout_reason"),
    remarks,
    notes,
  };

  const hasImportableData = hasSourceValues && (Object.values(mappedRow).some((value) => hasValue(value)) || unknownFieldNotes.length > 0);

  return {
    ...mappedRow,
    _hasImportableData: hasImportableData,
  };
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
  const paymentDate = toIsoDate(enrollment.last_payment_date || "");
  if (!paymentDate) return [];

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
    paymentDate,
    label: emiEnrollment ? "Installment 1" : "Initial Payment",
    status: "Paid",
  })];
}

function normalizeStageValue(stage = "") {
  const normalizedStage = String(stage || "").trim().toLowerCase().replace(/[^a-z]+/g, "");
  if (normalizedStage === "enquiry" || normalizedStage === "inquiry") return "Enquiry";
  if (normalizedStage === "enrolled") return "Enrolled";
  if (normalizedStage === "dropout" || normalizedStage === "dropped") return "Dropout";
  return String(stage || "").trim();
}

function isEnquiryStage(stage = "") {
  return normalizeStageValue(stage) === "Enquiry";
}

function isEnrolledStage(stage = "") {
  return normalizeStageValue(stage) === "Enrolled";
}

function isDropoutStage(stage = "") {
  return normalizeStageValue(stage) === "Dropout";
}

function hasAdmissionLifecycleData(enrollment = {}, pipelineStage = enrollment?.pipeline_stage || "") {
  if (isEnrolledStage(pipelineStage)) {
    return true;
  }

  if (!isDropoutStage(pipelineStage)) {
    return false;
  }

  return Boolean(
    toIsoDate(enrollment?.enrolled_date || "")
    || (Number(enrollment?.amount_paid || 0) || 0) > 0
    || (Number(enrollment?.total_fee || 0) || 0) > 0
    || String(enrollment?.payment_plan || "").trim()
    || String(enrollment?.payment_method || "").trim()
    || toIsoDate(enrollment?.last_payment_date || "")
    || toIsoDate(enrollment?.next_due_date || ""),
  );
}

function extractGenderNameTokens(student = {}) {
  const fullNameTokens = String(student.full_name || "")
    .toLowerCase()
    .split(/[\s._-]+/)
    .map((part) => part.replace(/[^a-z]/g, ""))
    .filter(Boolean);
  const emailTokens = String(student.email || "")
    .toLowerCase()
    .split("@")[0]
    .split(/[\s._-]+/)
    .map((part) => part.replace(/[^a-z]/g, ""))
    .filter(Boolean);

  return [...fullNameTokens, ...emailTokens];
}

function hasSupportingDocuments(documents = []) {
  return documents.some((item) => !["Student Photo", "Aadhaar ID Photo"].includes(item?.document_type));
}

function normalizeEmailLogType(emailType = "") {
  return String(emailType || "").trim().toLowerCase();
}

function isSuccessfulEmailLog(log = {}) {
  const normalizedStatus = String(log?.status || "").trim().toLowerCase();
  return normalizedStatus === "sent" || normalizedStatus === "queued" || normalizedStatus === "ok";
}

function isFollowUpEmailLog(log = {}) {
  return normalizeEmailLogType(log?.email_type).includes("follow-up");
}

function isPaymentReminderEmailLog(log = {}) {
  const normalizedType = normalizeEmailLogType(log?.email_type);
  return normalizedType.includes("due reminder") || normalizedType.includes("payment reminder");
}

function isAdmissionConfirmationEmailLog(log = {}) {
  return normalizeEmailLogType(log?.email_type).includes("admission confirmation");
}

function hasReachableStudentEmail(email = "") {
  const safeEmail = String(email || "").trim().toLowerCase();
  if (!safeEmail || safeEmail.endsWith("@enrollease.local")) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail);
}

function getSuccessfulEnrollmentEmailLogs(emailLogs = [], enrollmentId = "", matcher = () => true) {
  return emailLogs
    .filter((log) => log?.enrollment_id === enrollmentId)
    .filter((log) => matcher(log))
    .filter(isSuccessfulEmailLog)
    .sort((left, right) => new Date(right.sent_at || 0) - new Date(left.sent_at || 0));
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

  return ENQUIRY_MAX_FOLLOW_UP_CYCLES;
}

function hasSuccessfulEmailOnOrAfter(emailLogs = [], enrollmentId = "", matcher = () => true, startDate = "") {
  const normalizedStartDate = toIsoDate(startDate);
  if (!normalizedStartDate) {
    return false;
  }

  return getSuccessfulEnrollmentEmailLogs(emailLogs, enrollmentId, matcher)
    .some((log) => compareIsoDates(log?.sent_at || "", normalizedStartDate) >= 0);
}

function getSuccessfulFollowUpCount(emailLogs = [], enrollmentId = "") {
  return getSuccessfulEnrollmentEmailLogs(emailLogs, enrollmentId, isFollowUpEmailLog).length;
}

function matchesKnownNameToken(token = "", prefixes = []) {
  const normalizedToken = String(token || "").trim().toLowerCase();
  return prefixes.some((name) => normalizedToken.startsWith(name) || normalizedToken.endsWith(name));
}

function inferStudentGenderBucket(student = {}) {
  const rawGender = String(student.gender || student.sex || student.student_gender || "").trim().toLowerCase();
  const genderTokens = extractGenderNameTokens(student);
  const isGirlName = genderTokens.some((token) => matchesKnownNameToken(token, GIRL_NAME_PREFIXES));
  const isBoyName = genderTokens.some((token) => matchesKnownNameToken(token, BOY_NAME_PREFIXES));

  if (["female", "girl", "f", "woman", "lady"].includes(rawGender) || isGirlName) {
    return "girl";
  }

  if (["male", "boy", "m", "man", "gentleman"].includes(rawGender) || isBoyName) {
    return "boy";
  }

  return "unknown";
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

function isAutoDropoutReason(reason = "") {
  return AUTO_DROPOUT_REASONS.has(String(reason || "").trim());
}

function inferCurrentStage(enrollment, options = {}) {
  const leadDate = options.leadDate || enrollment?.lead_date || enrollment?.created_at || "";
  const followUpDate = options.followUpDate || enrollment?.follow_up_date || "";
  const autoDropoutReason = isAutoDropoutReason(enrollment?.dropout_reason || "");

  if (autoDropoutReason) {
    return shouldAutoDropoutEnquiry({
      pipelineStage: "Enquiry",
      leadDate,
      followUpDate,
    })
      ? "Dropout"
      : "Enquiry";
  }

  if (enrollment?.dropout_reason || enrollment?.enrollment_status === "Dropped" || isDropoutStage(enrollment?.pipeline_stage)) {
    return "Dropout";
  }

  if (shouldAutoDropoutEnquiry({
    pipelineStage: enrollment?.pipeline_stage || "",
    leadDate,
    followUpDate,
  })) {
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
  const leadDate = enrollment?.lead_date || enrollment?.created_at || "";
  const normalizedStoredStage = normalizeStageValue(enrollment?.pipeline_stage || "");
  const inferredStageFromStoredFollowUp = inferCurrentStage(enrollment, {
    leadDate,
    followUpDate: enrollment?.follow_up_date || "",
  });
  const shouldUseEnquiryFollowUpDisplay =
    normalizedStoredStage === "Enquiry" || inferredStageFromStoredFollowUp === "Enquiry";
  const effectiveFollowUpDate = shouldUseEnquiryFollowUpDisplay
    ? getDisplayEnquiryFollowUpDate({
      leadDate,
      followUpDate: enrollment?.follow_up_date || "",
      today: getTodayIsoDate(),
    })
    : (enrollment?.follow_up_date || "");
  const pipelineStage = inferCurrentStage(enrollment, {
    leadDate,
    followUpDate: effectiveFollowUpDate,
  });
  const paymentEligible = hasAdmissionLifecycleData(enrollment, pipelineStage);
  const totalFee = paymentEligible
    ? (toNumberOrNull(enrollment?.total_fee) ?? Number(course?.fee || 0))
    : toNumberOrNull(enrollment?.total_fee);
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
  const enrolledDate = paymentEligible ? toIsoDate(enrollment?.enrolled_date || "") : "";
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
      paymentPlan,
      lastPaymentDate,
      history: paymentHistory,
    })
    : "";
  const autoDropoutReason = isAutoDropoutReason(enrollment?.dropout_reason || "");
  const enrollmentStatus = pipelineStage === "Enquiry" && autoDropoutReason
    ? "Follow-up"
    : enrollment?.enrollment_status === "Verified"
      ? "Active"
      : enrollment?.enrollment_status || (pipelineStage === "Enrolled" ? "Active" : pipelineStage === "Dropout" ? "Dropped" : "Follow-up");
  const dropoutDate = getDerivedDropoutDate({
    pipelineStage: enrollment?.pipeline_stage || pipelineStage,
    leadDate,
    followUpDate: effectiveFollowUpDate,
  });

  return {
    ...enrollment,
    pipeline_stage: pipelineStage,
    lead_date: leadDate,
    enrolled_date: enrolledDate,
    follow_up_date: effectiveFollowUpDate,
    payment_eligible: paymentEligible,
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
    enrollment_status: pipelineStage === "Dropout" ? "Dropped" : enrollmentStatus,
    dropout_date: pipelineStage === "Dropout" ? dropoutDate : "",
    dropout_reason:
      pipelineStage === "Dropout"
        ? (enrollment?.dropout_reason || "Automatically moved to dropout after two follow-up cycles.")
        : (enrollment?.dropout_reason || ""),
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
      paymentPlan: enrollment?.payment_plan || "",
      lastPaymentDate: paymentDate,
      history: [nextPaymentEntry, ...existingPaymentHistory],
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
  const uniqueStudents = dedupeRecordsById(students);
  const uniqueEnrollments = dedupeRecordsById(enrollments);
  const safeDocuments = Array.isArray(documents) ? documents : [];
  return uniqueEnrollments
    .map((enrollment) => {
      try {
        const student = uniqueStudents.find((item) => item.id === enrollment.student_id);
        const course = findCourseByReference(courses, [enrollment.course_id, enrollment.course_name]) || null;
        if (!student) return null;

        const normalizedEnrollment = normalizeEnrollmentForDisplay(enrollment, course);
        const recordDocuments = buildDocumentBundle(
          student,
          enrollment.id,
          safeDocuments.filter((item) => item.enrollment_id === enrollment.id),
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
        const paymentEligible = Boolean(normalizedEnrollment.payment_eligible);
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
      } catch (error) {
        console.warn("Skipping malformed portal record:", enrollment?.id || "unknown-enrollment", error);
        return null;
      }
    })
    .filter(Boolean)
    .sort((left, right) => new Date(right.enrollment.lead_date || right.enrollment.created_at) - new Date(left.enrollment.lead_date || left.enrollment.created_at));
}

function buildDashboardMetrics(records) {
  const totalRecords = records.length;
  const pending = records.filter((record) => record.isEnquiryRecord).length;
  const totalEnquiries = new Set(records.map((record) => record.student?.id).filter(Boolean)).size;
  const totalEnrolled = records.filter((record) => record.isEnrolledRecord).length;
  const totalDropouts = records.filter((record) => record.isDropoutRecord).length;
  const conversionRate = totalEnquiries ? Math.round((totalEnrolled / totalEnquiries) * 100) : 0;
  const emiStudents = records.filter((record) => isEmiEnrollment(record.enrollment) && record.paymentEligible).length;
  const clearedPayments = records.filter((record) => record.enrollment.payment_status === "Paid").length;
  const enrolledGirls = records.filter((record) => record.isEnrolledRecord && inferStudentGenderBucket(record.student) === "girl").length;
  const enrolledBoys = records.filter((record) => record.isEnrolledRecord && inferStudentGenderBucket(record.student) === "boy").length;
  const enrolledUnknown = records.filter((record) => record.isEnrolledRecord && inferStudentGenderBucket(record.student) === "unknown").length;

  return {
    totalRecords,
    totalEnquiries,
    totalEnrolled,
    totalDropouts,
    pending,
    conversionRate,
    emiStudents,
    clearedPayments,
    enrolledGirls,
    enrolledBoys,
    enrolledUnknown,
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

  if (error?.code === "23505" && String(error?.message || "").toLowerCase().includes("student_code")) {
    return new Error("Student code already exists. Please use a different custom student ID.");
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
  let nextPayload = payload;
  const removedColumns = [];

  while (true) {
    const result = await execute(nextPayload);
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

    const { payload: strippedPayload, changed } = removeColumnFromPayload(nextPayload, missingColumn);
    if (!changed) {
      return {
        ...result,
        removedColumns,
      };
    }

    removedColumns.push(missingColumn);
    nextPayload = strippedPayload;
  }
}

async function fetchTable(table, queryBuilder) {
  const builder = queryBuilder ? queryBuilder(supabase.from(table)) : supabase.from(table).select("*");
  const { data, error } = await builder;
  if (error) throw error;
  return data || [];
}

function fetchTableWithTimeout(table, queryBuilder, label, milliseconds = SUPABASE_BOOT_TIMEOUT_MS) {
  return withTimeout(fetchTable(table, queryBuilder), milliseconds, label);
}

function buildOptionalState(optionalState = {}) {
  return {
    emailLogs: Array.isArray(optionalState.emailLogs) ? optionalState.emailLogs : [],
    auditLogs: Array.isArray(optionalState.auditLogs) ? optionalState.auditLogs : [],
  };
}

async function loadCriticalRemoteState(sessionUser) {
  const criticalResults = await Promise.all(
    criticalPortalTables.map(async ({ key, table, queryBuilder }) => [
      key,
      await fetchTableWithTimeout(table, queryBuilder, `Loading ${table}`, CRITICAL_REMOTE_TIMEOUT_MS),
    ]),
  );
  const {
    profiles = [],
    courses = [],
  } = Object.fromEntries(criticalResults);
  const currentUser =
    profiles.find((profile) => profile.user_id === sessionUser.id)
    || profiles.find((profile) => normalizeEmailKey(profile.email) === normalizeEmailKey(sessionUser.email))
    || buildCurrentUserFallback(sessionUser);

  return {
    authUser: sessionUser,
    currentUser,
    profiles,
    students: [],
    courses: normalizeCourseRecords(courses),
    enrollments: [],
    documents: [],
    ...buildOptionalState(),
  };
}

async function loadDeferredRemoteState() {
  const deferredResults = await Promise.all(
    deferredPortalTables.map(async ({ key, table, queryBuilder }) => {
      try {
        return [key, await fetchTableWithTimeout(table, queryBuilder, `Loading ${table}`, DEFERRED_REMOTE_TIMEOUT_MS)];
      } catch (error) {
        console.warn(`Deferred Supabase load failed for ${table}:`, error);
        return [key, []];
      }
    }),
  );
  const optionalResults = await Promise.all(
    optionalPortalTables.map(async ({ key, table, queryBuilder }) => {
      try {
        return [key, await fetchTableWithTimeout(table, queryBuilder, `Loading ${table}`, DEFERRED_REMOTE_TIMEOUT_MS)];
      } catch (error) {
        console.warn(`Optional Supabase load failed for ${table}:`, error);
        return [key, []];
      }
    }),
  );

  const {
    students = [],
    enrollments = [],
    documents = [],
  } = Object.fromEntries(deferredResults);
  const mergedEnrollments = dedupeRecordsById(enrollments);
  const mergedDocuments = dedupeRecordsById(documents);

  return {
    students: dedupeRecordsById(students),
    enrollments: mergedEnrollments,
    documents: normalizeDocumentsForDisplay(mergedDocuments, mergedEnrollments),
    ...buildOptionalState(Object.fromEntries(optionalResults)),
  };
}

async function loadFullRemoteState(sessionUser) {
  const criticalState = await loadCriticalRemoteState(sessionUser);
  const deferredState = await loadDeferredRemoteState();

  return {
    ...criticalState,
    ...deferredState,
  };
}

async function loadVerifiedRemoteState(sessionUser) {
  const firstState = await loadFullRemoteState(sessionUser);
  publishRuntimeDebugSnapshot("initial_remote_load", sessionUser, firstState);

  if (hasMeaningfulPortalData(firstState)) {
    return firstState;
  }

  await sleep(1200);
  const recoveredSessionUser = await waitForSupabaseSession(sessionUser?.email || "", 3000) || sessionUser;
  const secondState = await loadFullRemoteState(recoveredSessionUser);
  publishRuntimeDebugSnapshot("retry_remote_load", recoveredSessionUser, secondState);
  return secondState;
}

export function AppProvider({ children }) {
  const [state, setState] = useState(defaultState);
  const [automationTick, setAutomationTick] = useState(() => Date.now());
  const refreshTracker = useRef({ key: null, promise: null });
  const autoEmailTracker = useRef({
    followUp: new Set(),
    paymentReminder: new Set(),
  });
  const serverSideAutomationsEnabled = hasSupabaseEnv && SERVER_SIDE_AUTOMATIONS_ENABLED;

  useEffect(() => {
    cleanupLegacyBrowserStorage();
    trimBrowserStorageForSupabaseMode();
    if (typeof window !== "undefined") {
      window.__ENROLLEASE_RUNTIME_ERROR__ = null;
    }
  }, []);

  useEffect(() => {
    const refreshAutomationClock = () => {
      setAutomationTick(Date.now());
    };

    const intervalId = window.setInterval(refreshAutomationClock, AUTOMATION_RECHECK_INTERVAL_MS);
    const handleWindowFocus = () => {
      refreshAutomationClock();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshAutomationClock();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

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
      "Supabase returned courses, but none matched the selected course. Review the current course rows in Supabase and make sure the schema from supabase/schema.sql has been applied, then reload the app.",
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

      window.localStorage.removeItem(SUPABASE_SHADOW_KEY);

      if (!sessionUser) {
        setState((prev) => ({ ...defaultState, loading: false, notifications: prev.notifications }));
        return;
      }
      const cachedState = readRemoteStateCache(sessionUser);
      const hasUsableCache = Boolean(cachedState && hasRemotePortalContent(cachedState));

      if (!hasUsableCache) {
        try {
          const fullRemoteState = await loadVerifiedRemoteState(sessionUser);
          const nextState = {
            ...fullRemoteState,
            loading: false,
          };
          setState((prev) => ({
            ...prev,
            ...nextState,
          }));
          writeRemoteStateCache(sessionUser, nextState);
          if (!hasMeaningfulPortalData(nextState)) {
            pushNotification({
              type: "warning",
              title: `Supabase returned no student, enrollment, or document rows for this signed-in session on project ${getSupabaseProjectRef(supabaseUrl) || "unknown"}.`,
            });
          }
          return;
        } catch (error) {
          pushNotification({ type: "warning", title: error.message });
          throw error;
        } finally {
          setState((prev) => ({ ...prev, loading: false }));
        }
      }

      const fallbackCurrentUser = cachedState?.currentUser || buildCurrentUserFallback(sessionUser);

      setState((prev) => ({
        ...prev,
        authUser: sessionUser,
        currentUser: fallbackCurrentUser,
        profiles: cachedState?.profiles || prev.profiles || [],
        students: cachedState?.students || prev.students || [],
        courses: cachedState?.courses || prev.courses || [],
        enrollments: cachedState?.enrollments || prev.enrollments || [],
        documents: cachedState?.documents || prev.documents || [],
        emailLogs: cachedState?.emailLogs || prev.emailLogs || [],
        auditLogs: cachedState?.auditLogs || prev.auditLogs || [],
        loading: false,
      }));

      void (async () => {
        try {
          const criticalState = await loadCriticalRemoteState(sessionUser);
          publishRuntimeDebugSnapshot("background_critical_load", sessionUser, criticalState);
          setState((prev) => {
            const activeUserKey = prev.authUser?.id || prev.authUser?.email || "guest";
            if (activeUserKey !== refreshKey) {
              return prev;
            }

            const nextState = {
              ...prev,
              ...criticalState,
              students: prev.students,
              enrollments: prev.enrollments,
              documents: prev.documents,
              emailLogs: prev.emailLogs,
              auditLogs: prev.auditLogs,
              loading: false,
            };
            writeRemoteStateCache(sessionUser, nextState);
            return nextState;
          });

          const deferredState = await loadDeferredRemoteState();
          publishRuntimeDebugSnapshot("background_deferred_load", sessionUser, {
            ...criticalState,
            ...deferredState,
          });
          setState((prev) => {
            const activeUserKey = prev.authUser?.id || prev.authUser?.email || "guest";
            if (activeUserKey !== refreshKey) {
              return prev;
            }

            const mergedState = {
              ...prev,
              ...deferredState,
              loading: false,
            };
            const nextState = mergedState;
            writeRemoteStateCache(sessionUser, nextState);
            return nextState;
          });
        } catch (error) {
          console.warn("Background portal refresh failed:", error);
        }
      })();
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

    clearSupabaseModeLocalData();
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
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        return;
      }

      if (!mounted) {
        return;
      }

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
      const { data, signedInUser } = await signInWithSessionRecovery({ email, password });
      await refreshState(signedInUser);
      pushNotification({ type: "success", title: "Signed in successfully" });
      return data;
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
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
    const paymentEligible = hasAdmissionLifecycleData(enrollment, pipelineStage);
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
    const enrolledDate = paymentEligible ? toIsoDate(enrollment.enrolled_date || "") : "";
    const followUpDate = isEnquiryStage(pipelineStage)
      ? toIsoDate(enrollment.follow_up_date || getInitialEnquiryFollowUpDate(leadDate))
      : enrollment.follow_up_date || "";
    const lastPaymentDate = paymentEligible
      ? resolveLastPaymentDate({
        lastPaymentDate: enrollment.last_payment_date || "",
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
    const nextDueDate = paymentEligible
      ? resolveNextDueDate({
        paymentStatus,
        paymentPlan,
        lastPaymentDate,
        history: paymentHistory,
      })
      : "";
    const verificationStatus = paymentEligible ? (enrollment.verification_status || "Pending") : "Pending";
    const enrollmentStatus = enrollment.enrollment_status
      || (pipelineStage === "Enrolled" ? "Active" : pipelineStage === "Dropout" ? "Dropped" : "Follow-up");
    const timelineValidationMessage = getEnrollmentTimelineValidationMessage({
      leadDate,
      enrolledDate,
      followUpDate,
      lastPaymentDate,
      nextDueDate,
      paymentPlan,
      pipelineStage,
      requireLeadDate: true,
      requireEnrolledDate: pipelineStage === "Enrolled",
    });

    if (timelineValidationMessage) {
      throw new Error(timelineValidationMessage);
    }

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

  const triggerEnrollmentSubmissionAutomation = ({
    studentRecord,
    enrollmentRecord,
    lifecycleStage,
  }) => {
    const isEnquiryLifecycle = lifecycleStage === "enquiry";

    return triggerAutomation("enrollment_submitted", {
      studentRecord,
      enrollmentRecord,
      lifecycleStage,
    }, {
      event: isEnquiryLifecycle ? "enrollment.enquiry_submitted" : "enrollment.admission_submitted",
      agentType: isEnquiryLifecycle ? "welcome_agent" : "enrollment_agent",
      actionType: isEnquiryLifecycle ? "capture_new_enquiry" : "capture_enrollment_submission",
    });
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
    const resolvedStudentCode = isEnquiryCreation
      ? student.student_code || ""
      : student.student_code || getNextEnrolledStudentCode({
        students: state.students,
        enrollments: state.enrollments,
      });

    if (!hasSupabaseEnv || !supabase) {
      const studentId = createId("student");
      const enrollmentId = createId("enrollment");
      const studentRecord = {
        id: studentId,
        created_at: leadDate,
        ...student,
        student_code: resolvedStudentCode,
      };
      const enrollmentRecord = {
        ...enrollment,
        id: enrollmentId,
        student_id: studentId,
        created_at: leadDate,
        pipeline_stage: pipelineStage,
        lead_date: leadDate,
        enrolled_date: enrolledDate || "",
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

      commitLocalDb((draft) => {
        const newDocuments = documents.map((item) => ({
          id: createId("document"),
          enrollment_id: enrollmentId,
          document_type: item.document_type,
          file_url: item.file_url || "",
          verification_status: verificationStatus,
          remarks: item.remarks || "Uploaded from form",
          uploaded_at: leadDate,
        }));

        draft.students.unshift(studentRecord);
        draft.enrollments.unshift(enrollmentRecord);
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
      if (
        !serverSideAutomationsEnabled
        && (
        pipelineStage === "Enrolled"
        && getSuccessfulEnrollmentEmailLogs(state.emailLogs, enrollmentId, isAdmissionConfirmationEmailLog).length === 0
        )
      ) {
        void logEmail("Admission Confirmation", enrollmentRecord, {
          logType: "Admission Confirmation",
          student: studentRecord,
          course: findCourseByReference(state.courses, [enrollmentRecord.course_id, enrollment.course_name]) || enrollment.course_name || "",
          currentStage: pipelineStage,
          silent: true,
        }).catch(() => {});

        if (Number(amountPaid || 0) > 0) {
          void sendPaymentEmail(enrollmentId, {
            enrollment: enrollmentRecord,
            student: studentRecord,
            course: findCourseByReference(state.courses, [enrollmentRecord.course_id, enrollment.course_name]) || null,
            paidAmount: amountPaid,
            paymentDate: lastPaymentDate || enrolledDate || leadDate,
            silent: true,
          }).catch(() => {});
        }
      }
      void triggerEnrollmentSubmissionAutomation({
        studentRecord,
        enrollmentRecord,
        lifecycleStage: isEnquiryCreation ? "enquiry" : "enrolled",
      });
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
          student_code: resolvedStudentCode || null,
          full_name: student.full_name,
          email: normalizedEmail,
          phone: student.phone,
          college_name: student.college_name || "",
          current_activity: student.current_activity || "",
          place: student.place || "",
          lead_source: student.lead_source || "Manual Form",
        }
        : {
          student_code: resolvedStudentCode || null,
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
      if (
        !serverSideAutomationsEnabled
        && (
        pipelineStage === "Enrolled"
        && getSuccessfulEnrollmentEmailLogs(state.emailLogs, enrollmentRecord.id, isAdmissionConfirmationEmailLog).length === 0
        )
      ) {
        void logEmail("Admission Confirmation", {
          ...enrollmentRecord,
          course_name: selectedCourse.course_name || enrollment.course_name || "",
          pipeline_stage: pipelineStage,
        }, {
          logType: "Admission Confirmation",
          student: studentRecord,
          course: selectedCourse,
          currentStage: pipelineStage,
          silent: true,
        }).catch(() => {});

        if (Number(amountPaid || 0) > 0) {
          void sendPaymentEmail(enrollmentRecord.id, {
            enrollment: {
              ...enrollmentRecord,
              course_name: selectedCourse.course_name || enrollment.course_name || "",
              pipeline_stage: pipelineStage,
              amount_paid: amountPaid,
              total_fee: totalFee,
              payment_status: paymentStatus,
              payment_plan: paymentPlan,
              payment_method: paymentMethod,
              installments_planned: installmentsPlanned,
              installments_paid: installmentsPaid,
              installment_amount: installmentAmount,
              last_payment_date: lastPaymentDate || null,
              next_due_date: nextDueDate || null,
              payment_history: paymentHistory,
            },
            student: studentRecord,
            course: selectedCourse,
            paidAmount: amountPaid,
            paymentDate: lastPaymentDate || enrolledDate || leadDate,
            silent: true,
          }).catch(() => {});
        }
      }
      void triggerEnrollmentSubmissionAutomation({
        studentRecord,
        enrollmentRecord,
        lifecycleStage: isEnquiryCreation ? "enquiry" : "enrolled",
      });
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
    const resolvedStudentCode = student.student_code || currentStudent.student_code || getNextEnrolledStudentCode({
      students: state.students,
      enrollments: state.enrollments,
    });

    if (!hasSupabaseEnv || !supabase) {
      const updatedStudentRecord = {
        ...currentStudent,
        ...student,
        student_code: resolvedStudentCode,
      };
      const updatedEnrollmentRecord = {
        ...currentEnrollment,
        ...enrollment,
        course_id: enrollment.course_id || currentEnrollment.course_id,
        course_name: enrollment.course_name || currentEnrollment.course_name || "",
        pipeline_stage: pipelineStage,
        lead_date: leadDate,
        enrolled_date: enrolledDate,
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
      };
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
            ? updatedStudentRecord
            : item
        )),
        enrollments: draft.enrollments.map((item) => (
          item.id === enrollmentId
            ? updatedEnrollmentRecord
            : item
        )),
        documents: [
          ...nextDocuments,
          ...draft.documents.filter((item) => !nextDocuments.some((doc) => doc.id === item.id)),
        ],
      }), "Enquiry converted to enrolled");
      if (
        !serverSideAutomationsEnabled
        && getSuccessfulEnrollmentEmailLogs(state.emailLogs, enrollmentId, isAdmissionConfirmationEmailLog).length === 0
      ) {
        void logEmail("Admission Confirmation", updatedEnrollmentRecord, {
          logType: "Admission Confirmation",
          student: updatedStudentRecord,
          course: findCourseByReference(state.courses, [updatedEnrollmentRecord.course_id, updatedEnrollmentRecord.course_name]) || updatedEnrollmentRecord.course_name || "",
          currentStage: pipelineStage,
          silent: true,
        }).catch(() => {});
      }
      if (Number(amountPaid || 0) > 0) {
        void sendPaymentEmail(enrollmentId, {
          enrollment: updatedEnrollmentRecord,
          student: updatedStudentRecord,
          course: findCourseByReference(state.courses, [updatedEnrollmentRecord.course_id, updatedEnrollmentRecord.course_name]) || null,
          paidAmount: amountPaid,
          paymentDate: lastPaymentDate || enrolledDate || leadDate,
          silent: true,
        }).catch(() => {});
      }
      void triggerEnrollmentSubmissionAutomation({
        studentRecord: updatedStudentRecord,
        enrollmentRecord: updatedEnrollmentRecord,
        lifecycleStage: "enrolled",
      });
      return;
    }

    const selectedCourse = await resolveCourseRecord({
      courseId: enrollment.course_id || currentEnrollment.course_id,
      courseName: enrollment.course_name || currentEnrollment.course_name,
    });

      const mergedStudentPayload = mergeStoredFields(currentStudent, {
        student_code: resolvedStudentCode,
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
    if (
      !serverSideAutomationsEnabled
      && getSuccessfulEnrollmentEmailLogs(state.emailLogs, enrollmentId, isAdmissionConfirmationEmailLog).length === 0
    ) {
      void logEmail("Admission Confirmation", {
        ...currentEnrollment,
        ...updatedEnrollment,
        course_name: selectedCourse.course_name || enrollment.course_name || currentEnrollment.course_name || "",
        pipeline_stage: pipelineStage,
      }, {
        logType: "Admission Confirmation",
        student: updatedStudent || currentStudent,
        course: selectedCourse,
        currentStage: pipelineStage,
        silent: true,
      }).catch(() => {});
    }
    if (Number(amountPaid || 0) > 0) {
      void sendPaymentEmail(enrollmentId, {
        enrollment: {
          ...currentEnrollment,
          ...updatedEnrollment,
          course_name: selectedCourse.course_name || enrollment.course_name || currentEnrollment.course_name || "",
        },
        student: updatedStudent || currentStudent,
        course: selectedCourse,
        paidAmount: amountPaid,
        paymentDate: lastPaymentDate || enrolledDate || leadDate,
        silent: true,
      }).catch(() => {});
    }
    void triggerEnrollmentSubmissionAutomation({
      studentRecord: updatedStudent || currentStudent,
      enrollmentRecord: {
        ...currentEnrollment,
        ...updatedEnrollment,
        course_name: enrollment.course_name || currentEnrollment.course_name || "",
      },
      lifecycleStage: "enrolled",
    });
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

    await triggerAutomation("enrollment_status_updated", { enrollmentId, patch: normalizedPatch }, {
      event: "enrollment.status_updated",
      agentType: "enrollment_agent",
      actionType: "sync_status_update",
    });
    await refreshState(state.authUser);
    pushNotification({ type: "success", title: "Enrollment updated" });
    if (
      !serverSideAutomationsEnabled
      && (
      normalizeStageValue(normalizedPatch.pipeline_stage || "") === "Enrolled"
      && getSuccessfulEnrollmentEmailLogs(state.emailLogs, enrollmentId, isAdmissionConfirmationEmailLog).length === 0
      )
    ) {
      const studentRecord = state.students.find((item) => item.id === currentEnrollment?.student_id);
      const courseRecord = state.courses.find((item) => item.id === (updatedEnrollment?.course_id || currentEnrollment?.course_id))
        || state.courses.find((item) => item.course_name === (updatedEnrollment?.course_name || currentEnrollment?.course_name))
        || null;
      void logEmail("Admission Confirmation", {
        ...currentEnrollment,
        ...updatedEnrollment,
      }, {
        logType: "Admission Confirmation",
        student: studentRecord,
        course: courseRecord,
        currentStage: "Enrolled",
        silent: true,
      }).catch(() => {});
    }
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
    const enrolledDate = toIsoDate(currentEnrollment.enrolled_date || "");
    const lastPaymentDate = amountPaid > 0
      ? toIsoDate(patch?.last_payment_date || currentEnrollment.last_payment_date || "")
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
      paymentPlan,
      lastPaymentDate,
      history: paymentHistory,
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
    const timelineValidationMessage = getEnrollmentTimelineValidationMessage({
      leadDate,
      enrolledDate,
      lastPaymentDate,
      nextDueDate,
      paymentPlan,
      pipelineStage: currentEnrollment.pipeline_stage || "",
      requireLeadDate: true,
      requireEnrolledDate: hasAdmissionLifecycleData({ ...currentEnrollment, ...normalizedPatch }, currentEnrollment.pipeline_stage || ""),
    });
    if (timelineValidationMessage) {
      throw new Error(timelineValidationMessage);
    }

    if (!hasSupabaseEnv || !supabase) {
      commitLocalDb((draft) => ({
        ...draft,
        enrollments: draft.enrollments.map((item) => (
          item.id === enrollmentId
            ? { ...item, ...normalizedPatch }
            : item
        )),
      }), "Payment details updated");
      if (
        !serverSideAutomationsEnabled
        && (
        Number(normalizedPatch.amount_paid || 0) > 0
        && (
          Number(normalizedPatch.amount_paid || 0) !== Number(currentEnrollment.amount_paid || 0)
          || String(normalizedPatch.payment_status || "") !== String(currentEnrollment.payment_status || "")
        )
        )
      ) {
        void sendPaymentEmail(enrollmentId, {
          enrollment: { ...currentEnrollment, ...normalizedPatch },
          paidAmount: Number(normalizedPatch.amount_paid || 0),
          paymentDate: normalizedPatch.last_payment_date || currentEnrollment.last_payment_date || enrolledDate || leadDate,
          silent: true,
        }).catch(() => {});
      }
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
    if (
      !serverSideAutomationsEnabled
      && (
      Number(normalizedPatch.amount_paid || 0) > 0
      && (
        Number(normalizedPatch.amount_paid || 0) !== Number(currentEnrollment.amount_paid || 0)
        || String(normalizedPatch.payment_status || "") !== String(currentEnrollment.payment_status || "")
      )
      )
    ) {
      const studentRecord = state.students.find((item) => item.id === currentEnrollment.student_id);
      const courseRecord = state.courses.find((item) => item.id === currentEnrollment.course_id)
        || state.courses.find((item) => item.course_name === currentEnrollment.course_name)
        || null;
      void sendPaymentEmail(enrollmentId, {
        enrollment: { ...currentEnrollment, ...normalizedPatch },
        student: studentRecord,
        course: courseRecord,
        paidAmount: Number(normalizedPatch.amount_paid || 0),
        paymentDate: normalizedPatch.last_payment_date || currentEnrollment.last_payment_date || enrolledDate || leadDate,
        silent: true,
      }).catch(() => {});
    }
  };

  const updateStudentProfile = async ({ studentId, studentPatch = {}, enrollmentId = "", enrollmentPatch = {} }) => {
    const currentStudent = state.students.find((item) => item.id === studentId);
    if (!currentStudent) {
      throw new Error("Student record not found.");
    }

    const currentEnrollment = enrollmentId
      ? state.enrollments.find((item) => item.id === enrollmentId) || null
      : null;

    const normalizedStudentPatch = { ...studentPatch };
    if (Object.prototype.hasOwnProperty.call(normalizedStudentPatch, "email")) {
      normalizedStudentPatch.email = hasValue(normalizedStudentPatch.email)
        ? String(normalizedStudentPatch.email).trim().toLowerCase()
        : "";
    }
    const normalizedEnrollmentPatch = { ...enrollmentPatch };

    ["lead_date", "enrolled_date", "last_payment_date", "next_due_date", "follow_up_date"].forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(normalizedEnrollmentPatch, key)) return;
      normalizedEnrollmentPatch[key] = hasValue(normalizedEnrollmentPatch[key]) ? toIsoDate(normalizedEnrollmentPatch[key]) : null;
    });

    if (currentEnrollment && Object.keys(normalizedEnrollmentPatch).length) {
      const nextEnrollment = { ...currentEnrollment, ...normalizedEnrollmentPatch };
      const timelineValidationMessage = getEnrollmentTimelineValidationMessage({
        leadDate: nextEnrollment.lead_date || nextEnrollment.created_at || "",
        enrolledDate: nextEnrollment.enrolled_date || "",
        followUpDate: nextEnrollment.follow_up_date || "",
        lastPaymentDate: nextEnrollment.last_payment_date || "",
        nextDueDate: nextEnrollment.next_due_date || "",
        paymentPlan: nextEnrollment.payment_plan || "",
        pipelineStage: nextEnrollment.pipeline_stage || "",
        requireLeadDate: true,
        requireEnrolledDate: hasAdmissionLifecycleData(nextEnrollment, nextEnrollment.pipeline_stage || ""),
      });
      if (timelineValidationMessage) {
        throw new Error(timelineValidationMessage);
      }
    }

    const nextStudentName = Object.prototype.hasOwnProperty.call(normalizedStudentPatch, "full_name")
      ? normalizedStudentPatch.full_name
      : currentStudent.full_name;
    const nextStudentEmail = Object.prototype.hasOwnProperty.call(normalizedStudentPatch, "email")
      ? normalizedStudentPatch.email
      : currentStudent.email;
    const nextStudentPhone = Object.prototype.hasOwnProperty.call(normalizedStudentPatch, "phone")
      ? normalizedStudentPatch.phone
      : currentStudent.phone;

    if (Object.keys(normalizedStudentPatch).length) {
      if (!hasValue(nextStudentName)) {
        throw new Error("Student name is required.");
      }

      if (!hasValue(nextStudentEmail)) {
        throw new Error("Student email is required.");
      }

      if (!hasValue(nextStudentPhone)) {
        throw new Error("Student phone is required.");
      }
    }

    if (!hasSupabaseEnv || !supabase) {
      commitLocalDb((draft) => ({
        ...draft,
        students: draft.students.map((item) => (
          item.id === studentId
            ? { ...item, ...normalizedStudentPatch }
            : item
        )),
        enrollments: enrollmentId
          ? draft.enrollments.map((item) => (
            item.id === enrollmentId
              ? { ...item, ...normalizedEnrollmentPatch }
              : item
          ))
          : draft.enrollments,
      }), "Student profile updated");
      if (currentEnrollment) {
        const nextEnrollment = { ...currentEnrollment, ...normalizedEnrollmentPatch };
        const nextStage = inferCurrentStage(nextEnrollment, {
          leadDate: nextEnrollment.lead_date || nextEnrollment.created_at || "",
          followUpDate: nextEnrollment.follow_up_date || "",
        });
        void logEmail("Student Profile Update", nextEnrollment, {
          logType: "Student Profile Update",
          student: { ...currentStudent, ...normalizedStudentPatch },
          course: findCourseByReference(state.courses, [nextEnrollment.course_id, nextEnrollment.course_name]) || nextEnrollment.course_name || "",
          currentStage: nextStage,
          silent: true,
        }).catch(() => {});
      }
      return;
    }

    if (Object.keys(normalizedStudentPatch).length) {
      const { data: updatedStudent, error: studentUpdateError, removedColumns: removedStudentColumns = [] } = await runMutationWithSchemaRetry({
        tableName: "students",
        payload: normalizedStudentPatch,
        execute: (payload) =>
          supabase
            .from("students")
            .update(payload)
            .eq("id", studentId)
            .select()
            .single(),
      });
      if (studentUpdateError) throw formatEnrollmentAccessError(studentUpdateError, "update", "students");
      if (removedStudentColumns.length) {
        storeShadowStudentPayload(updatedStudent || currentStudent, normalizedStudentPatch, removedStudentColumns);
      }
    }

    if (currentEnrollment && Object.keys(normalizedEnrollmentPatch).length) {
      const { data: updatedEnrollment, error: enrollmentUpdateError, removedColumns = [] } = await runMutationWithSchemaRetry({
        tableName: "enrollments",
        payload: normalizedEnrollmentPatch,
        execute: (payload) =>
          supabase
            .from("enrollments")
            .update(payload)
            .eq("id", enrollmentId)
            .select()
            .single(),
      });
      if (enrollmentUpdateError) throw formatEnrollmentAccessError(enrollmentUpdateError, "update", "enrollments");
      if (removedColumns.length) {
        storeShadowEnrollmentPayload(updatedEnrollment || currentEnrollment, normalizedEnrollmentPatch, removedColumns);
      }
    }

    await refreshState(state.authUser);
    pushNotification({ type: "success", title: "Student profile updated" });
    if (currentEnrollment) {
      const nextStudentRecord = { ...currentStudent, ...normalizedStudentPatch };
      const nextEnrollmentRecord = { ...currentEnrollment, ...normalizedEnrollmentPatch };
      const nextStage = inferCurrentStage(nextEnrollmentRecord, {
        leadDate: nextEnrollmentRecord.lead_date || nextEnrollmentRecord.created_at || "",
        followUpDate: nextEnrollmentRecord.follow_up_date || "",
      });
      const courseRecord = state.courses.find((item) => item.id === nextEnrollmentRecord.course_id)
        || state.courses.find((item) => item.course_name === nextEnrollmentRecord.course_name)
        || null;
      void logEmail("Student Profile Update", nextEnrollmentRecord, {
        logType: "Student Profile Update",
        student: nextStudentRecord,
        course: courseRecord,
        currentStage: nextStage,
        silent: true,
      }).catch(() => {});
    }
  };

  const markInstallmentPaid = async (enrollmentId, paymentMode = "UPI") => {
    const currentEnrollment = state.enrollments.find((item) => item.id === enrollmentId);
    if (!currentEnrollment) {
      throw new Error("Enrollment not found for payment update.");
    }

    const paymentPatch = buildRecordedPaymentState(currentEnrollment, paymentMode);
    const latestPaymentEntry = paymentPatch.payment_history?.[0] || null;

    if (!hasSupabaseEnv || !supabase) {
      commitLocalDb((draft) => {
        draft.enrollments = draft.enrollments.map((item) => {
          if (item.id !== enrollmentId) return item;
          return {
            ...item,
            ...paymentPatch,
          };
        });
        return draft;
      }, "Payment recorded");
      try {
        await sendPaymentEmail(enrollmentId, {
          enrollment: { ...currentEnrollment, ...paymentPatch },
          paidAmount: latestPaymentEntry?.paid_amount ?? latestPaymentEntry?.amount ?? 0,
          paymentDate: paymentPatch.last_payment_date,
        });
      } catch {}
      return;
    }
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
    try {
      await sendPaymentEmail(enrollmentId, {
        enrollment: { ...currentEnrollment, ...paymentPatch },
        paidAmount: latestPaymentEntry?.paid_amount ?? latestPaymentEntry?.amount ?? 0,
        paymentDate: paymentPatch.last_payment_date,
      });
    } catch {}
  };

  const importStudentsFromCsv = async (rows) => {
    if (!rows?.length) {
      throw new Error("Upload a CSV file with at least one student row.");
    }

    const normalizedRows = rows
      .map((row, index) => normalizeImportedCsvRow(row, index))
      .filter((row) => row._hasImportableData);

    if (!normalizedRows.length) {
      throw new Error("No importable student details were found in the uploaded CSV.");
    }

    if (!hasSupabaseEnv || !supabase) {
      let imported = 0;

      commitLocalDb((draft) => {
        normalizedRows.forEach((row, index) => {
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
          const lastPaymentDate = row.last_payment_date || "";
          const paymentMethod = row.payment_method || (amountPaid > 0 ? "UPI" : "");
          const studentEmail = row.email || buildImportedPlaceholderEmail(index);
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
            student_code: row.student_code || "",
            full_name: row.full_name,
            email: studentEmail,
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
            follow_up_date: row.follow_up_date || getInitialEnquiryFollowUpDate(leadDate),
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
              paymentPlan,
              lastPaymentDate,
              history: paymentHistory,
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
      }, `${imported} enquiry records imported`);
      return { imported };
    }

    let imported = 0;
    const importedStudentRecords = [];
    const importedEnrollmentRecords = [];

    const ensureImportCourse = async (row) => {
      if (row.course_id || row.course_name) {
        return resolveCourseRecord({ courseId: row.course_id, courseName: row.course_name });
      }

      if (state.courses.length) {
        return state.courses[0];
      }

      const remoteCourses = await fetchRemoteCourses();
      if (remoteCourses.length) {
        return syncCoursesIntoState(remoteCourses)[0];
      }

      const seededCourses = await seedCanonicalCourses();
      const normalizedSeededCourses = syncCoursesIntoState(seededCourses.length ? seededCourses : await fetchRemoteCourses());
      if (normalizedSeededCourses.length) {
        return normalizedSeededCourses[0];
      }

      throw new Error("No courses are available for CSV import.");
    };

    for (const [index, row] of normalizedRows.entries()) {
      const course = await ensureImportCourse(row);
      const leadDate = toIsoDate(row.lead_date || new Date());
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
      const lastPaymentDate = row.last_payment_date || "";
      const paymentMethod = row.payment_method || (amountPaid > 0 ? "UPI" : "");
      const followUpDate = row.follow_up_date || getInitialEnquiryFollowUpDate(leadDate);
      const verificationStatus = row.verification_status || (stage === "Enrolled" ? "Approved" : "Pending");
      const enrollmentStatus = row.enrollment_status || (stage === "Enrolled" ? "Active" : stage === "Dropout" ? "Dropped" : "Follow-up");
      const studentEmail = row.email || buildImportedPlaceholderEmail(index);
      const paymentHistory = buildInitialPaymentHistory({
        total_fee: totalFee,
        payment_plan: paymentPlan,
        payment_method: paymentMethod,
        installments_planned: installmentsPlanned,
        enrolled_date: enrolledDate,
        last_payment_date: lastPaymentDate,
      }, amountPaid, leadDate);

      let studentRecord = null;
      if (row.email) {
        const { data: existingStudent, error: existingStudentError } = await supabase
          .from("students")
          .select("*")
          .eq("email", studentEmail)
          .maybeSingle();
        if (existingStudentError) throw formatEnrollmentAccessError(existingStudentError, "read", "students");
        studentRecord = existingStudent;
      }

      const studentPayload = {
        student_code: row.student_code || "",
        full_name: row.full_name,
        email: studentEmail,
        phone: row.phone || "",
        alternate_phone: row.alternate_phone || "",
        college_name: row.college_name || "",
        current_activity: row.current_activity || "",
        place: row.place || "",
        address: row.address || "",
        guardian_name: row.guardian_name || "",
        guardian_relation: row.guardian_relation || "",
        guardian_phone: row.guardian_phone || "",
        aadhaar_id: row.aadhaar_id || "",
        photo_url: "",
        aadhaar_document_url: "",
        lead_source: row.lead_source || "CSV Upload",
        notes: row.notes || "",
      };

      if (studentRecord) {
        const mergedStudentPayload = mergeStoredFields(studentRecord, studentPayload);
        const { data: updatedStudent, error: studentUpdateError } = await runMutationWithSchemaRetry({
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
        const { data: insertedStudent, error: studentInsertError } = await runMutationWithSchemaRetry({
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

      importedStudentRecords.push(studentRecord);

      const enrollmentPayload = {
        student_id: studentRecord.id,
        course_id: course?.id || "",
        batch: row.batch || course?.batch || "",
        pipeline_stage: stage,
        lead_date: leadDate,
        enrolled_date: enrolledDate || null,
        follow_up_date: followUpDate || null,
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
          paymentPlan,
          lastPaymentDate,
          history: paymentHistory,
        }) || null,
        payment_status: paymentStatus,
        enrollment_status: enrollmentStatus,
        verification_status: verificationStatus,
        remarks: row.remarks || "",
        dropout_reason: row.dropout_reason || "",
        last_payment_date: lastPaymentDate || null,
        payment_history: paymentHistory,
      };

      const { data: insertedEnrollment, error: enrollmentError } = await runMutationWithSchemaRetry({
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
      if (insertedEnrollment) {
        importedEnrollmentRecords.push(insertedEnrollment);
      }

      imported += 1;
    }

    if (importedStudentRecords.length || importedEnrollmentRecords.length) {
      setState((prev) => ({
        ...prev,
        students: dedupeRecordsById([...importedStudentRecords, ...prev.students]),
        enrollments: dedupeRecordsById([...importedEnrollmentRecords, ...prev.enrollments]),
      }));
    }

    pushNotification({ type: "success", title: `${imported} enquiry records imported.` });
    void refreshState(state.authUser);
    return { imported };
  };

  const logEmail = async (emailType, enrollment, options = {}) => {
    const studentRecord = options.student || state.students.find((item) => item.id === enrollment?.student_id);
    if (!studentRecord?.email) {
      const missingEmailMessage = "Student email address is missing in the profile.";
      if (!options.silent) {
        pushNotification({ type: "warning", title: missingEmailMessage });
      }
      throw new Error(missingEmailMessage);
    }

    const enrollmentRecord = options.enrollment
      || state.enrollments.find((item) => item.id === enrollment?.id)
      || enrollment;
    const enrollmentDocuments = options.documents
      || state.documents.filter((item) => item.enrollment_id === enrollmentRecord?.id);

    const sentAt = new Date().toISOString();
    const result = await sendEmailTrigger(emailType, enrollmentRecord, {
      student: studentRecord,
      course: options.course
        || state.courses.find((course) => course.id === enrollmentRecord?.course_id)
        || state.courses.find((course) => course.course_name === enrollmentRecord?.course_name)
        || enrollmentRecord?.course_name
        || "",
      currentStage: options.currentStage || enrollmentRecord?.pipeline_stage || "",
      subject: options.subject,
      html: options.html,
      text: options.text,
      documents: enrollmentDocuments,
      instituteName: options.instituteName || "CERTISURED",
    });

    if (!result.ok) {
      const failureMessage = result.message || `Unable to trigger "${emailType}".`;
      if (!options.silent) {
        pushNotification({
          type: "warning",
          title: failureMessage,
        });
      }
      throw new Error(failureMessage);
    }

    const log = {
      enrollment_id: enrollmentRecord.id,
      email_type: options.logType || emailType,
      status: result.status || "Queued",
      sent_at: sentAt,
    };

    const emailLogResult = await tryPersistEmailLog(log);
    if (emailLogResult.error && !options.silent) {
      pushNotification({ type: "warning", title: "Email sent, but email_logs could not be saved in Supabase." });
    }

    if (!options.silent) {
      pushNotification({
        type: "success",
        title: options.successTitle || `${emailType} sent successfully.`,
      });
    }

    if (emailLogResult.persisted) {
      void refreshState(state.authUser);
    }

    return result;
  };

  const appendEmailLogLocally = (log) => {
    setState((prev) => ({
      ...prev,
      emailLogs: [{ id: createId("email"), ...log }, ...prev.emailLogs],
    }));
  };

  const tryPersistEmailLog = async (log) => {
    if (!hasSupabaseEnv || !supabase) {
      appendEmailLogLocally(log);
      return { persisted: false };
    }

    const { error } = await supabase.from("email_logs").insert(log);
    if (error) {
      appendEmailLogLocally(log);
      return { persisted: false, error };
    }

    appendEmailLogLocally(log);
    return { persisted: true };
  };

  const findRelatedCoursesForEnrollment = (courseId, currentCourseName = "") => {
    const currentCourse = state.courses.find((item) => item.id === courseId)
      || state.courses.find((item) => item.course_name === currentCourseName)
      || null;
    const currentTokens = new Set(
      String(currentCourse?.course_name || currentCourseName || "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean),
    );

    return state.courses
      .filter((item) => item.id !== currentCourse?.id)
      .map((item) => {
        const tokens = String(item.course_name || "")
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter(Boolean);
        const overlap = tokens.reduce((count, token) => count + (currentTokens.has(token) ? 1 : 0), 0);
        const modeBonus = currentCourse?.mode && item.mode === currentCourse.mode ? 1 : 0;
        return { ...item, score: overlap + modeBonus };
      })
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return String(left.course_name || "").localeCompare(String(right.course_name || ""));
      })
      .slice(0, 3)
      .map(({ score, ...course }) => course);
  };

  const sendPaymentEmail = async (enrollmentId, options = {}) => {
    const enrollmentRecord = options.enrollment || state.enrollments.find((item) => item.id === enrollmentId);
    if (!enrollmentRecord) {
      throw new Error("Enrollment record not found for payment email.");
    }

    const studentRecord = options.student || state.students.find((item) => item.id === enrollmentRecord.student_id);
    if (!studentRecord?.email) {
      throw new Error("Student email address is missing in the profile.");
    }

    const courseRecord = state.courses.find((item) => item.id === enrollmentRecord.course_id)
      || state.courses.find((item) => item.course_name === enrollmentRecord.course_name)
      || null;
    const relatedCourses = findRelatedCoursesForEnrollment(
      courseRecord?.id,
      courseRecord?.course_name || enrollmentRecord.course_name || "",
    );
    const sentAt = new Date().toISOString();
    const emailResult = await sendPaymentStatusEmail({
      enrollment: enrollmentRecord,
      student: studentRecord,
      course: options.course || courseRecord,
      relatedCourses,
      paidAmount: options.paidAmount,
      paymentDate: options.paymentDate || enrollmentRecord.last_payment_date || "",
      emailVariant: options.emailVariant || "payment_update",
    });

    if (!emailResult.ok) {
      if (!options.silent) {
        pushNotification({
          type: "warning",
          title: emailResult.message || "Payment email could not be sent.",
        });
      }
      throw new Error(emailResult.message || "Payment email could not be sent.");
    }

    const log = {
      enrollment_id: enrollmentId,
      email_type: options.emailVariant === "due_reminder" ? "EMI Due Reminder" : "Payment Update",
      status: emailResult.status || "Queued",
      sent_at: sentAt,
    };

    const emailLogResult = await tryPersistEmailLog(log);
    if (emailLogResult.error && !options.silent) {
      pushNotification({ type: "warning", title: "Payment email log could not be saved in Supabase." });
    }

    if (!options.silent) {
      pushNotification({
        type: "success",
        title: "Payment email queued",
      });
    }

    if (emailLogResult.persisted) {
      void refreshState(state.authUser);
    }

    return emailResult;
  };

  const sendDashboardFollowUpEmail = async (enrollmentId, options = {}) => {
    try {
      const enrollmentRecord = state.enrollments.find((item) => item.id === enrollmentId);
      if (!enrollmentRecord) {
        throw new Error("Enrollment record not found for follow-up.");
      }

      const studentRecord = state.students.find((item) => item.id === enrollmentRecord.student_id);
      if (!studentRecord?.email) {
        throw new Error("Student email address is missing.");
      }

      const sentAt = new Date().toISOString();
      const leadDate = enrollmentRecord.lead_date || enrollmentRecord.created_at || toIsoDate(new Date());
      const currentFollowUpDate = toIsoDate(
        enrollmentRecord.follow_up_date || getInitialEnquiryFollowUpDate(leadDate),
      );
      const sentDate = toIsoDate(sentAt);
      const dueDateReached = currentFollowUpDate && compareIsoDates(sentDate, currentFollowUpDate) >= 0;
      const advancedFollowUpDate = dueDateReached
        ? getNextEnquiryFollowUpDate({
          leadDate,
          followUpDate: currentFollowUpDate,
        })
        : "";
      const nextFollowUpDate = advancedFollowUpDate || currentFollowUpDate || getInitialEnquiryFollowUpDate(leadDate);
      const nextFollowUpDateLabel = new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
      }).format(new Date(`${(nextFollowUpDate || getFinalEnquiryFollowUpDate(leadDate))}T00:00:00`));

      const emailResult = await sendAdmissionFollowUpEmail({
        enrollment: enrollmentRecord,
        student: studentRecord,
        sentAt,
        nextFollowUpDate,
        nextFollowUpDateLabel,
      });

      if (!emailResult.ok) {
        const failedLog = {
          enrollment_id: enrollmentId,
          email_type: "Admission Follow-up",
          status: emailResult.status || "Failed",
          sent_at: sentAt,
        };

        const failedLogResult = await tryPersistEmailLog(failedLog);
        if (failedLogResult.error && !options.silent) {
          pushNotification({ type: "warning", title: "Email log could not be saved in Supabase. Check the email_logs RLS policy." });
        }
        throw new Error(emailResult.message || "Follow-up email could not be sent.");
      }

      if (!hasSupabaseEnv || !supabase) {
        commitLocalDb((draft) => ({
          ...draft,
          enrollments: draft.enrollments.map((item) => (
            item.id === enrollmentId
              ? { ...item, follow_up_date: nextFollowUpDate }
              : item
          )),
          emailLogs: [
            {
              id: createId("email"),
              enrollment_id: enrollmentId,
              email_type: "Admission Follow-up",
              status: emailResult.status || "Sent",
              sent_at: sentAt,
            },
            ...draft.emailLogs,
          ],
        }));
        if (!options.silent) {
          pushNotification({ type: "success", title: "Follow-up email sent successfully." });
        }
        return {
          sentAt,
          nextFollowUpDate,
        };
      }

      const followUpPatch = {
        follow_up_date: nextFollowUpDate,
      };
      const { error: enrollmentUpdateError, removedColumns = [] } = await runMutationWithSchemaRetry({
        tableName: "enrollments",
        payload: followUpPatch,
        execute: (nextPayload) =>
          supabase
            .from("enrollments")
            .update(nextPayload)
            .eq("id", enrollmentId)
            .select()
            .single(),
      });
      if (enrollmentUpdateError) {
        throw formatEnrollmentAccessError(enrollmentUpdateError, "update", "enrollments");
      }
      if (removedColumns.length) {
        storeShadowEnrollmentPayload(enrollmentRecord, followUpPatch, removedColumns);
      }

      setState((prev) => ({
        ...prev,
        enrollments: prev.enrollments.map((item) => (
          item.id === enrollmentId
            ? { ...item, ...followUpPatch }
            : item
        )),
      }));

      const emailLogResult = await tryPersistEmailLog({
        enrollment_id: enrollmentId,
        email_type: "Admission Follow-up",
        status: emailResult.status || "Sent",
        sent_at: sentAt,
      });
      if (emailLogResult.error && !options.silent) {
        pushNotification({ type: "warning", title: "Follow-up email sent, but email_logs insert was blocked by Supabase RLS." });
      }

      if (!options.silent) {
        pushNotification({ type: "success", title: "Follow-up email sent successfully." });
      }
      if (emailLogResult.persisted) {
        void refreshState(state.authUser);
      }
      return {
        sentAt,
        nextFollowUpDate,
      };
    } catch (error) {
      if (!options.silent) {
        pushNotification({ type: "warning", title: error.message || "Follow-up email could not be sent." });
      }
      throw error;
    }
  };

  const deleteEnrollmentRecord = async (
    enrollmentId,
    {
      successTitle = "Student record deleted successfully.",
      auditAction = "delete_student_record",
      missingRecordMessage = "Student record not found.",
    } = {},
  ) => {
    const enrollmentRecord = state.enrollments.find((item) => item.id === enrollmentId);
    if (!enrollmentRecord) {
      throw new Error(missingRecordMessage);
    }

    const studentRecord = state.students.find((item) => item.id === enrollmentRecord.student_id);
    if (!studentRecord) {
      throw new Error("Student record not found for this enquiry.");
    }

    if (!hasSupabaseEnv || !supabase) {
      commitLocalDb((draft) => {
        const remainingEnrollments = draft.enrollments.filter((item) => item.id !== enrollmentId);
        const studentStillLinked = remainingEnrollments.some((item) => item.student_id === studentRecord.id);

        return {
          ...draft,
          enrollments: remainingEnrollments,
          students: studentStillLinked ? draft.students : draft.students.filter((item) => item.id !== studentRecord.id),
          documents: draft.documents.filter((item) => item.enrollment_id !== enrollmentId),
          emailLogs: draft.emailLogs.filter((item) => item.enrollment_id !== enrollmentId),
          auditLogs: [
            {
              id: createId("audit"),
              user_id: draft.profiles[0]?.user_id || null,
              action: auditAction,
              description: `Deleted record for ${studentRecord.full_name}`,
              created_at: new Date().toISOString(),
            },
            ...draft.auditLogs,
          ],
        };
      }, successTitle);
      return;
    }

    const { data: relatedEnrollments, error: relatedEnrollmentsError } = await supabase
      .from("enrollments")
      .select("id")
      .eq("student_id", studentRecord.id);
    if (relatedEnrollmentsError) {
      throw formatEnrollmentAccessError(relatedEnrollmentsError, "read", "enrollments");
    }

    const { error: enrollmentDeleteError } = await supabase
      .from("enrollments")
      .delete()
      .eq("id", enrollmentId);
    if (enrollmentDeleteError) {
      throw formatEnrollmentAccessError(enrollmentDeleteError, "delete", "enrollments");
    }

    const otherEnrollmentCount = (relatedEnrollments || []).filter((item) => item.id !== enrollmentId).length;
    if (otherEnrollmentCount === 0) {
      const { error: studentDeleteError } = await supabase
        .from("students")
        .delete()
        .eq("id", studentRecord.id);
      if (studentDeleteError) {
        throw formatEnrollmentAccessError(studentDeleteError, "delete", "students");
      }
    }

    await refreshState(state.authUser);
    pushNotification({ type: "success", title: successTitle });
  };

  const deleteEnquiry = async (enrollmentId) => {
    await deleteEnrollmentRecord(enrollmentId, {
      successTitle: "Enquiry deleted successfully.",
      auditAction: "delete_enquiry",
      missingRecordMessage: "Enquiry record not found.",
    });
  };

  const deleteStudentRecord = async (enrollmentId) => {
    await deleteEnrollmentRecord(enrollmentId, {
      successTitle: "Student record deleted successfully.",
      auditAction: "delete_student_record",
    });
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
    const automationResult = await triggerAutomation("document_verification", { enrollmentId, documentType, fileName: file.name });
    await refreshState(state.authUser);
    pushNotification({ type: "success", title: `${documentType} uploaded` });
    if (!automationResult.success) {
      pushNotification({ type: "warning", title: automationResult.message });
    }
  };

  const portalRecords = useMemo(() => {
    try {
      return toPortalRecords(state.students, state.enrollments, state.courses, state.documents);
    } catch (error) {
      console.error("Failed to build portal records:", error);
      if (typeof window !== "undefined") {
        window.__ENROLLEASE_RUNTIME_ERROR__ = {
          message: error?.message || "Failed to build portal records.",
          stack: error?.stack || "",
          capturedAt: new Date().toISOString(),
        };
      }
      return [];
    }
  }, [state.courses, state.documents, state.enrollments, state.students]);

  const dashboardMetrics = useMemo(() => {
    try {
      return buildDashboardMetrics(portalRecords);
    } catch (error) {
      console.error("Failed to build dashboard metrics:", error);
      return buildDashboardMetrics([]);
    }
  }, [portalRecords]);

  useEffect(() => {
    if (state.loading) {
      return;
    }

    if (serverSideAutomationsEnabled) {
      return;
    }

    const todayIsoDate = getTodayIsoDate();
    const dueFollowUps = portalRecords.filter((record) => {
      if (record.currentStage !== "Enquiry") {
        return false;
      }

      if (!hasReachableStudentEmail(record.student?.email || "")) {
        return false;
      }

      const leadDate = record.enrollment.lead_date || record.enrollment.created_at || "";
      const requiredCycles = getRequiredEnquiryFollowUpCycles({
        leadDate,
        today: todayIsoDate,
      });
      const successfulFollowUpCount = Math.min(
        getSuccessfulFollowUpCount(state.emailLogs, record.enrollment.id),
        ENQUIRY_MAX_FOLLOW_UP_CYCLES,
      );

      return requiredCycles > 0 && successfulFollowUpCount < requiredCycles;
    });

    const duePaymentReminders = portalRecords.filter((record) => {
      if (record.currentStage !== "Enrolled") {
        return false;
      }

      if (!hasReachableStudentEmail(record.student?.email || "")) {
        return false;
      }

      const nextDueDate = toIsoDate(record.enrollment.next_due_date || "");
      if (!nextDueDate || compareIsoDates(nextDueDate, todayIsoDate) > 0) {
        return false;
      }

      const remainingAmount = resolveRemainingAmount(
        record.enrollment.total_fee,
        record.enrollment.amount_paid,
      ) || 0;
      if (remainingAmount <= 0 || String(record.enrollment.payment_status || "").trim() === "Paid") {
        return false;
      }

      return !hasSuccessfulEmailOnOrAfter(
        state.emailLogs,
        record.enrollment.id,
        isPaymentReminderEmailLog,
        nextDueDate,
      );
    });

    if (!dueFollowUps.length && !duePaymentReminders.length) {
      return;
    }

    void (async () => {
      for (const record of dueFollowUps) {
        const successfulFollowUpCount = Math.min(
          getSuccessfulFollowUpCount(state.emailLogs, record.enrollment.id),
          ENQUIRY_MAX_FOLLOW_UP_CYCLES,
        );
        const followUpKey = `${record.enrollment.id}:${todayIsoDate}:follow-up:${successfulFollowUpCount + 1}`;
        if (autoEmailTracker.current.followUp.has(followUpKey)) {
          continue;
        }

        autoEmailTracker.current.followUp.add(followUpKey);
        try {
          await sendDashboardFollowUpEmail(record.enrollment.id, { silent: true });
        } catch {
          autoEmailTracker.current.followUp.delete(followUpKey);
        }
      }

      for (const record of duePaymentReminders) {
        const nextDueDate = toIsoDate(record.enrollment.next_due_date || "");
        const paymentReminderKey = `${record.enrollment.id}:${nextDueDate}:payment-reminder`;
        if (autoEmailTracker.current.paymentReminder.has(paymentReminderKey)) {
          continue;
        }

        autoEmailTracker.current.paymentReminder.add(paymentReminderKey);
        try {
          await sendPaymentEmail(record.enrollment.id, {
            enrollment: record.enrollment,
            student: record.student,
            course: record.course,
            emailVariant: "due_reminder",
            paymentDate: nextDueDate,
            silent: true,
          });
        } catch {
          autoEmailTracker.current.paymentReminder.delete(paymentReminderKey);
        }
      }
    })();
  }, [automationTick, portalRecords, serverSideAutomationsEnabled, state.emailLogs, state.loading]);

  const value = useMemo(
    () => ({
      ...state,
      demoMode: !hasSupabaseEnv,
      portalRecords,
      dashboardMetrics,
      login,
      logout,
      resetPassword,
      createEnrollment,
      convertEnquiryToEnrollment,
      updateEnrollmentStatus,
      saveEnrollmentPaymentDetails,
      updateStudentProfile,
      markInstallmentPaid,
      importStudentsFromCsv,
      logEmail,
      sendPaymentEmail,
      sendDashboardFollowUpEmail,
      deleteEnquiry,
      deleteStudentRecord,
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

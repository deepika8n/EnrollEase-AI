import { hasSupabaseEnv, supabase, supabaseAnonKey, supabaseUrl } from "../lib/supabase";

const STUDENT_INTAKE_FUNCTION_NAME = "student-intake";
const configuredPublicAppUrl = String(import.meta.env.VITE_PUBLIC_APP_URL || "").trim();
const LEGACY_PUBLIC_APP_ORIGINS = new Map([
  ["https://enrollease-ai.vercel.app", "https://enroll-ease-ai.vercel.app"],
]);

function normalizePublicAppOrigin(origin = "") {
  const trimmedOrigin = String(origin || "").trim().replace(/\/+$/, "");
  return LEGACY_PUBLIC_APP_ORIGINS.get(trimmedOrigin) || trimmedOrigin;
}

function getFunctionBaseUrl() {
  const normalizedUrl = String(supabaseUrl || "").trim().replace(/\/+$/, "");
  if (!normalizedUrl) return "";
  return `${normalizedUrl}/functions/v1/${STUDENT_INTAKE_FUNCTION_NAME}`;
}

async function buildFunctionHeaders(includeAuth = false) {
  const headers = {
    "Content-Type": "application/json",
    apikey: supabaseAnonKey,
  };

  if (!includeAuth || !supabase) {
    return headers;
  }

  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token || "";
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

async function callStudentIntakeFunction(payload, { includeAuth = false } = {}) {
  if (!hasSupabaseEnv || !supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase is not configured for student intake forms.");
  }

  const response = await fetch(getFunctionBaseUrl(), {
    method: "POST",
    headers: await buildFunctionHeaders(includeAuth),
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "Student intake request failed.");
  }

  return data;
}

function toBase64Url(bytes) {
  let binary = "";
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });

  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function createStudentIntakeToken() {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export async function hashStudentIntakeToken(token = "") {
  const safeToken = String(token || "").trim();
  const encoded = new TextEncoder().encode(safeToken);
  const digest = await window.crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function buildStudentIntakeUrl({ enrollmentId, token, origin = "" }) {
  const preferredOrigin = String(origin || configuredPublicAppUrl || window.location.origin).trim();
  const safeOrigin = normalizePublicAppOrigin(preferredOrigin);
  const params = new URLSearchParams({ token: String(token || "") });
  return `${safeOrigin}/student-intake/${encodeURIComponent(enrollmentId)}?${params.toString()}`;
}

export async function fetchStudentIntakeRequest({ enrollmentId, token }) {
  return callStudentIntakeFunction({
    action: "get_request",
    enrollmentId,
    token,
  });
}

export async function submitStudentIntakeRequest({ enrollmentId, token, submission }) {
  return callStudentIntakeFunction({
    action: "submit_request",
    enrollmentId,
    token,
    submission,
  });
}

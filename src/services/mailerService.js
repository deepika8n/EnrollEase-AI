import { supabase, supabaseAnonKey, supabaseUrl, hasSupabaseEnv } from "../lib/supabase";

function getFunctionUrl(functionName = "") {
  const normalizedUrl = String(supabaseUrl || "").trim().replace(/\/+$/, "");
  if (!normalizedUrl) {
    throw new Error("Supabase is not configured.");
  }
  return `${normalizedUrl}/functions/v1/${functionName}`;
}

async function buildHeaders(includeAuth = true) {
  const headers = {
    "Content-Type": "application/json",
    apikey: supabaseAnonKey,
  };

  if (!includeAuth || !supabase) {
    return headers;
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token || "";
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

export async function loadPublicCourses() {
  if (!hasSupabaseEnv || !supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("courses")
      .select("id, course_name, duration, fee, batch, mode, active_status")
      .order("course_name", { ascending: true });
    if (error) {
      throw error;
    }
    return Array.isArray(data) ? data : [];
  } catch {
    try {
      const response = await fetch(getFunctionUrl("public-enquiry"), {
        method: "GET",
        headers: await buildHeaders(false),
      });
      const data = await response.json().catch(() => ({}));
      return Array.isArray(data?.courses) ? data.courses : [];
    } catch {
      return [];
    }
  }
}

export async function sendDirectEmail(payload) {
  const response = await fetch(getFunctionUrl("mailer"), {
    method: "POST",
    headers: await buildHeaders(true),
    body: JSON.stringify(payload || {}),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    const error = new Error(data?.error || "Unable to send email.");
    error.logged = Boolean(data?.logged);
    throw error;
  }

  return data;
}

export async function submitPublicEnquiry(payload) {
  const response = await fetch(getFunctionUrl("public-enquiry"), {
    method: "POST",
    headers: await buildHeaders(false),
    body: JSON.stringify(payload || {}),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false || !data?.enrollmentId) {
    throw new Error(data?.error || "Unable to submit enquiry.");
  }

  return data;
}

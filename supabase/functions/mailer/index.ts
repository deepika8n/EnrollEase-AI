import { createClient } from "npm:@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email.ts";

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

function sanitizeString(value: unknown) {
  return String(value || "").trim();
}

async function persistEmailLogIfRequested(body: Record<string, unknown>, status: "Sent" | "Failed") {
  const enrollmentId = sanitizeString(body?.enrollment_id);
  const emailType = sanitizeString(body?.email_type);
  const sentAt = sanitizeString(body?.sent_at) || new Date().toISOString();
  if (!enrollmentId || !emailType) {
    return false;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) {
    return false;
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { error } = await adminClient.from("email_logs").insert({
    enrollment_id: enrollmentId,
    email_type: emailType,
    status,
    sent_at: sentAt,
  });

  if (error) {
    throw error;
  }

  return true;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: JSON_HEADERS });
  }

  if (request.method !== "POST") return response(405, { ok: false, error: "POST required." });
  // A valid anonymous project JWT is public configuration, not a signed-in user.
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const authClient = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_ANON_KEY") || "");
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return response(401, { ok: false, error: "Sign in to send email." });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  try {
    const result = await sendEmail({
      enrollmentId: sanitizeString(body.enrollment_id),
      emailType: sanitizeString(body.email_type),
      to: body?.to,
      cc: body?.cc,
      bcc: body?.bcc,
      replyTo: body?.replyTo,
      subject: String(body?.subject || "").trim(),
      html: String(body?.html || ""),
      text: String(body?.text || ""),
      attachments: Array.isArray(body?.attachments)
        ? body.attachments.map((item) => ({
          fileName: String(item?.fileName || "").trim(),
          mimeType: String(item?.mimeType || "").trim() || "application/octet-stream",
          contentBase64: String(item?.contentBase64 || "").trim(),
        })).filter((item) => item.fileName && item.contentBase64)
        : [],
    });

    const logged = result.skipped || await persistEmailLogIfRequested(body, "Sent").catch(() => false);

    return response(200, {
      ok: true,
      provider: result.provider,
      id: result.id,
      logged,
    });
  } catch (error) {
    const logged = await persistEmailLogIfRequested(body, "Failed").catch(() => false);
    return response(400, {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to send email.",
      logged,
    });
  }
});

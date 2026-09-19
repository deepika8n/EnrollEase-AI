import { createClient } from "npm:@supabase/supabase-js@2";
import type { EmailPayload } from "./email.ts";

async function digest(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))))
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function emailDeliveryKey(payload: EmailPayload, admin: any) {
  if (payload.deliveryKey) return payload.deliveryKey;
  const id = payload.enrollmentId || "";
  const kind = String(payload.emailType || "").toLowerCase();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (id && (kind.includes("due reminder") || kind.includes("payment reminder"))) return `reminder:${id}:${day}`;
  if (id && kind.includes("follow-up")) return `follow-up:${id}:${day}`;
  if (id && kind.includes("payment update")) {
    const { data, error } = await admin.from("enrollments").select("amount_paid,last_payment_date,payment_history").eq("id", id).single();
    if (error) throw error;
    const latest = [...(Array.isArray(data.payment_history) ? data.payment_history : [])]
      .sort((a, b) => String(b.recorded_at || b.date).localeCompare(String(a.recorded_at || a.date)))[0];
    return `payment:${id}:${latest?.id || `balance-${data.amount_paid}-${data.last_payment_date}`}`;
  }
  if (id && ["enquiry acknowledgement", "admin new enquiry alert", "student enrollment submitted", "admin enrollment submission alert"].includes(kind)) return `notice:${id}:${kind}`;
  // Repeated identical button requests share a short window; later intentional sends remain possible.
  return `content:${id}:${kind}:${await digest(JSON.stringify([payload.to, payload.subject, payload.text || payload.html]))}`;
}

export function definitelyRejected(error: any) {
  return error?.deliveryRejected === true || Number(error?.responseCode) >= 400
    || ["EAUTH", "ECONNECTION", "EDNS"].includes(error?.code)
    || String(error?.message || "").startsWith("No email provider is configured");
}

export async function deliverOnce(payload: EmailPayload, transport: (payload: EmailPayload) => Promise<any>, suppliedAdmin?: any) {
  const admin = suppliedAdmin || createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", { auth: { persistSession: false } });
  const key = await emailDeliveryKey(payload, admin);
  const { data: claim, error: claimError } = await admin.rpc("claim_email_delivery", { p_key: key, p_payload: { ...payload, deliveryKey: key } });
  if (claimError) throw claimError;
  if (claim === "sent") return { provider: "deduplicated", id: key, skipped: true };
  if (claim !== "claimed") throw new Error("This email is already pending or requires delivery review.");
  let result;
  try {
    if (payload.enrollmentPatch && payload.enrollmentId) {
      const { data, error } = await admin.from("enrollments").update(payload.enrollmentPatch)
        .eq("id", payload.enrollmentId).eq("pipeline_stage", "Enquiry").select("id").maybeSingle();
      if (error) throw Object.assign(new Error("Unable to prepare enrollment form link."), { deliveryRejected: true });
      if (!data) throw new Error("Enrollment is no longer an enquiry; follow-up delivery cancelled.");
    }
    result = await transport({ ...payload, deliveryKey: key });
  } catch (error) {
    // A timeout after provider acceptance is ambiguous. Never automatically resend it.
    await admin.from("email_deliveries").update({ status: definitelyRejected(error) ? "retry" : "uncertain",
      next_attempt_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), updated_at: new Date().toISOString(),
      last_error: String(error instanceof Error ? error.message : error).slice(0, 1000),
    }).eq("event_key", key);
    throw error;
  }
  const { error } = await admin.from("email_deliveries").update({ status: "sent", payload: {}, updated_at: new Date().toISOString(), last_error: null }).eq("event_key", key);
  if (error) throw new Error("Email was accepted, but delivery confirmation could not be saved. Do not resend automatically.");
  return result;
}

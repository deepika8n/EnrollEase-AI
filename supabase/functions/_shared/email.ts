import nodemailer from "npm:nodemailer@6.9.14";

type MailAddress = string | string[] | undefined;

export type EmailAttachment = {
  fileName: string;
  mimeType?: string;
  contentBase64: string;
};

export type EmailPayload = {
  to: MailAddress;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: MailAddress;
  bcc?: MailAddress;
  attachments?: EmailAttachment[];
};

function normalizeAttachments(value: EmailAttachment[] | undefined) {
  return Array.isArray(value)
    ? value.filter((item) => item && item.fileName && item.contentBase64)
    : [];
}

function base64ToBytes(value = "") {
  const binary = atob(String(value || ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function normalizeAddressList(value: MailAddress) {
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((entry) => String(entry || "").split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getRequiredEnv(name: string) {
  const value = String(Deno.env.get(name) || "").trim();
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function getOptionalEnv(name: string) {
  return String(Deno.env.get(name) || "").trim();
}

async function sendWithResend(payload: EmailPayload) {
  const apiKey = getOptionalEnv("RESEND_API_KEY");
  const from = getOptionalEnv("MAIL_FROM_EMAIL");
  if (!apiKey || !from) {
    return null;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: normalizeAddressList(payload.to),
      cc: normalizeAddressList(payload.cc),
      bcc: normalizeAddressList(payload.bcc),
      reply_to: payload.replyTo ? normalizeAddressList(payload.replyTo) : undefined,
      subject: payload.subject,
      html: payload.html || "",
      text: payload.text || "",
      attachments: normalizeAttachments(payload.attachments).map((item) => ({
        filename: item.fileName,
        content: item.contentBase64,
      })),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = String(data?.message || data?.error || `Resend request failed with ${response.status}.`);
    throw new Error(message);
  }

  return {
    provider: "resend",
    id: String(data?.id || ""),
  };
}

async function sendWithSmtp(payload: EmailPayload) {
  const host = getOptionalEnv("SMTP_HOST");
  const user = getOptionalEnv("SMTP_USER");
  const pass = getOptionalEnv("SMTP_PASS");
  const from = getOptionalEnv("MAIL_FROM_EMAIL");

  if (!host || !user || !pass || !from) {
    return null;
  }

  const port = Number(getOptionalEnv("SMTP_PORT") || "587") || 587;
  const secure = String(getOptionalEnv("SMTP_SECURE") || "").trim().toLowerCase() === "true" || port === 465;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  const info = await transporter.sendMail({
    from,
    to: normalizeAddressList(payload.to).join(", "),
    cc: normalizeAddressList(payload.cc).join(", ") || undefined,
    bcc: normalizeAddressList(payload.bcc).join(", ") || undefined,
    replyTo: normalizeAddressList(payload.replyTo).join(", ") || undefined,
    subject: payload.subject,
    html: payload.html || "",
    text: payload.text || "",
    attachments: normalizeAttachments(payload.attachments).map((item) => ({
      filename: item.fileName,
      content: base64ToBytes(item.contentBase64),
      contentType: item.mimeType || "application/octet-stream",
    })),
  });

  return {
    provider: "smtp",
    id: String(info.messageId || ""),
  };
}

export async function sendEmail(payload: EmailPayload) {
  const recipients = normalizeAddressList(payload.to);
  if (!recipients.length) {
    throw new Error("Email recipient is missing.");
  }

  if (!String(payload.subject || "").trim()) {
    throw new Error("Email subject is missing.");
  }

  const resendResult = await sendWithResend(payload);
  if (resendResult) {
    return resendResult;
  }

  const smtpResult = await sendWithSmtp(payload);
  if (smtpResult) {
    return smtpResult;
  }

  throw new Error(
    "No email provider is configured. Set RESEND_API_KEY and MAIL_FROM_EMAIL, or SMTP_HOST/SMTP_USER/SMTP_PASS/MAIL_FROM_EMAIL.",
  );
}

export function getAdminNotificationEmail() {
  return getRequiredEnv("ADMIN_NOTIFICATION_EMAIL");
}

const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
const webhookSecret = String(import.meta.env.VITE_N8N_WEBHOOK_SECRET || "").trim();

const AUTOMATION_TIMEOUT_MS = 15000;
const flowDefinitions = {
  email_notification: {
    event: "email.notification",
    agentType: "email_agent",
    actionType: "dispatch_email",
  },
  enrollment_submitted: {
    event: "enrollment.submitted",
    agentType: "enrollment_agent",
    actionType: "capture_submission",
  },
  enrollment_status_updated: {
    event: "enrollment.status_updated",
    agentType: "enrollment_agent",
    actionType: "sync_status",
  },
  document_verification: {
    event: "document.verification",
    agentType: "document_agent",
    actionType: "verify_document",
  },
  document_uploaded: {
    event: "document.uploaded",
    agentType: "document_agent",
    actionType: "process_document",
  },
  payment_reminder: {
    event: "payment.reminder",
    agentType: "payment_agent",
    actionType: "send_payment_reminder",
  },
};

function buildWebhookTargets(url = "") {
  const normalizedUrl = String(url || "").trim();
  if (!normalizedUrl) return [];

  const targets = [];
  const isLocalN8n = /localhost:5678|127\.0\.0\.1:5678/i.test(normalizedUrl);
  const hasProductionWebhookPath = /\/webhook\//i.test(normalizedUrl);

  if (isLocalN8n && hasProductionWebhookPath) {
    // In local development, prefer the n8n test listener so `Execute workflow`
    // immediately shows the green execution path in the canvas.
    targets.push(normalizedUrl.replace(/\/webhook\//i, "/webhook-test/"));
  }

  targets.push(normalizedUrl);

  return [...new Set(targets)];
}

function resolveAutomationDefinition(flowName = "", overrides = {}) {
  const baseDefinition = flowDefinitions[flowName] || {
    event: flowName ? flowName.replaceAll("_", ".") : "automation.unknown",
    agentType: "automation_agent",
    actionType: flowName || "run_automation",
  };

  return {
    event: overrides.event || baseDefinition.event,
    agentType: overrides.agentType || baseDefinition.agentType,
    actionType: overrides.actionType || baseDefinition.actionType,
  };
}

function buildAutomationErrorMessage(status = "") {
  const url = String(webhookUrl || "").trim();
  const target = url || "the configured webhook URL";

  if (!url) {
    return "n8n webhook URL is not configured.";
  }

  if (/localhost|127\.0\.0\.1/i.test(url)) {
    return `n8n is not running at ${target}. Start n8n or update VITE_N8N_WEBHOOK_URL.`;
  }

  if (status === "http_error") {
    return `n8n returned an error for ${target}. Check that the webhook path is correct and active.`;
  }

  return `n8n workflow is not reachable at ${target}.`;
}

function extractAutomationErrorDetails(data) {
  if (!data || typeof data !== "object") return "";

  const message = data.message || data.error || data.text || "";
  if (!message) return "";

  return String(message).trim();
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function appendFormValue(formData, key, value) {
  if (value === null || value === undefined) {
    formData.append(key, "");
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      appendFormValue(formData, `${key}[${index}]`, item);
    });
    return;
  }

  if (isPlainObject(value)) {
    Object.entries(value).forEach(([childKey, childValue]) => {
      appendFormValue(formData, `${key}[${childKey}]`, childValue);
    });
    return;
  }

  formData.append(key, String(value));
}

function appendJsonPart(formData, key, value) {
  formData.append(
    key,
    new Blob([JSON.stringify(value)], { type: "application/json" }),
    `${key}.json`,
  );
}

function base64ToBlob(base64 = "", mimeType = "application/octet-stream") {
  const binary = window.atob(String(base64 || ""));
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function buildAutomationRequestBody(flowName, payload, overrides = {}) {
  const { event, agentType, actionType } = resolveAutomationDefinition(flowName, overrides);
  return {
    event,
    agentType,
    actionType,
    flowName,
    source: "EnrollEase AI",
    timestamp: new Date().toISOString(),
    payload,
  };
}

function buildAutomationRequestInit(requestBody, webhookSecret = "") {
  const baseHeaders = {
    "x-enrollease-event": requestBody.event,
    "x-enrollease-agent": requestBody.agentType,
    "x-enrollease-action": requestBody.actionType,
    ...(webhookSecret ? { "x-enrollease-secret": webhookSecret } : {}),
  };
  const attachments = Array.isArray(requestBody.payload?.attachments) ? requestBody.payload.attachments : [];

  if (!attachments.length) {
    return {
      headers: {
        "Content-Type": "application/json",
        ...baseHeaders,
      },
      body: JSON.stringify(requestBody),
    };
  }

  const formData = new FormData();
  appendJsonPart(formData, "request", requestBody);
  appendFormValue(formData, "event", requestBody.event);
  appendFormValue(formData, "agentType", requestBody.agentType);
  appendFormValue(formData, "actionType", requestBody.actionType);
  appendFormValue(formData, "flowName", requestBody.flowName);
  appendFormValue(formData, "source", requestBody.source);
  appendFormValue(formData, "timestamp", requestBody.timestamp);

  appendFormValue(formData, "recipientEmail", requestBody.payload?.recipientEmail || "");
  appendFormValue(formData, "subject", requestBody.payload?.subject || "");
  appendFormValue(formData, "html", requestBody.payload?.html || "");
  appendFormValue(formData, "text", requestBody.payload?.text || "");
  appendFormValue(formData, "htmlMessage", requestBody.payload?.htmlMessage || "");
  appendFormValue(formData, "textMessage", requestBody.payload?.textMessage || "");
  appendFormValue(formData, "message", requestBody.payload?.message || "");
  appendFormValue(formData, "payloadJson", JSON.stringify(requestBody.payload || {}));

  attachments.forEach((attachment, index) => {
    if (!attachment?.contentBase64) return;
    const fieldName = attachment.fieldName || (index === 0 ? "student_profile_pdf" : `attachment_${index + 1}`);
    const blob = base64ToBlob(attachment.contentBase64, attachment.mimeType || attachment.contentType || "application/pdf");
    formData.append(fieldName, blob, attachment.fileName || `${fieldName}.pdf`);
  });

  return {
    headers: baseHeaders,
    body: formData,
  };
}

async function readResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text ? { text } : {};
}

export async function triggerAutomation(flowName, payload, overrides = {}) {
  const requestBody = buildAutomationRequestBody(flowName, payload, overrides);
  const { event, agentType, actionType } = requestBody;

  if (!webhookUrl) {
      return {
        success: false,
        status: "not_configured",
        event,
        agentType,
        actionType,
        message: buildAutomationErrorMessage("not_configured"),
        requestBody,
      };
  }

  if (import.meta.env.PROD && /localhost|127\.0\.0\.1/i.test(webhookUrl)) {
      return {
        success: false,
        status: "invalid_production_url",
        event,
        agentType,
        actionType,
        message: buildAutomationErrorMessage("invalid_production_url"),
        requestBody,
      };
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), AUTOMATION_TIMEOUT_MS);
  const webhookTargets = buildWebhookTargets(webhookUrl);
  let lastFailure = null;

  try {
    for (const targetUrl of webhookTargets) {
      console.log("Sending n8n event:", event, payload);
      const requestInit = buildAutomationRequestInit(requestBody, webhookSecret);
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: requestInit.headers,
        body: requestInit.body,
        signal: controller.signal,
      });
      const data = await readResponseBody(response);

      if (!response.ok) {
        const errorDetails = extractAutomationErrorDetails(data);
        lastFailure = {
          success: false,
          status: "http_error",
          event,
          agentType,
          actionType,
          message: errorDetails
            ? `n8n returned ${response.status}: ${errorDetails}`
            : buildAutomationErrorMessage("http_error"),
          requestBody,
          responseStatus: response.status,
          data,
          targetUrl,
        };

        // When developing against local n8n, `Execute workflow` listens on `/webhook-test/...`.
        // Fall through and try that derived endpoint before reporting failure.
        if (response.status === 404 && /\/webhook\//i.test(targetUrl)) {
          continue;
        }

        return lastFailure;
      }

      return {
          success: true,
          status: "ok",
          event,
          agentType,
          actionType,
          message: "Automation workflow completed successfully.",
          requestBody,
          data,
          targetUrl,
      };
    }

    return lastFailure || {
      success: false,
      status: "http_error",
      event,
      agentType,
      actionType,
      message: buildAutomationErrorMessage("http_error"),
      requestBody,
    };
  } catch (error) {
    const timedOut = error?.name === "AbortError";
      return {
        success: false,
        status: timedOut ? "timeout" : "unreachable",
        event,
        agentType,
        actionType,
        message: timedOut
          ? `n8n request timed out after ${Math.round(AUTOMATION_TIMEOUT_MS / 1000)} seconds.`
          : (error?.message || buildAutomationErrorMessage("unreachable")),
        requestBody,
        error: error.message,
      };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

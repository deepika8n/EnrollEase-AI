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

async function readResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text ? { text } : {};
}

export async function triggerAutomation(flowName, payload, overrides = {}) {
  const { event, agentType, actionType } = resolveAutomationDefinition(flowName, overrides);
  const requestBody = {
    event,
    agentType,
    actionType,
    flowName,
    source: "EnrollEase AI",
    timestamp: new Date().toISOString(),
    payload,
  };

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
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-enrollease-event": event,
          "x-enrollease-agent": agentType,
          "x-enrollease-action": actionType,
          ...(webhookSecret ? { "x-enrollease-secret": webhookSecret } : {}),
        },
        body: JSON.stringify(requestBody),
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

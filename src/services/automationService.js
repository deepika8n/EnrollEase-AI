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

export async function triggerAutomation(flowName, payload, overrides = {}) {
  const { event, agentType, actionType } = resolveAutomationDefinition(flowName, overrides);

  return {
    success: true,
    status: "handled_locally",
    event,
    agentType,
    actionType,
    message: "Automation is handled natively inside the app and Supabase functions.",
    requestBody: {
      flowName,
      payload,
      event,
      agentType,
      actionType,
    },
  };
}

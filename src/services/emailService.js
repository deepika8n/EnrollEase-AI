import { triggerAutomation } from "./automationService";

export async function sendEmailTrigger(emailType, enrollment) {
  const automationResult = await triggerAutomation("email_notification", {
    emailType,
    enrollmentId: enrollment.id,
    enrollment,
  });

  return {
    ok: true,
    status: automationResult.success === false ? "pending_webhook" : "queued",
    message: `Email trigger executed for "${emailType}" and enrollment ${enrollment.id}.`,
  };
}

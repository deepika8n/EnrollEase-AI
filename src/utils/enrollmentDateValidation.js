import { addDays, toIsoDate } from "./dateMath.js";

export const ENQUIRY_FOLLOW_UP_INTERVAL_DAYS = 3;
export const ENQUIRY_MAX_FOLLOW_UP_CYCLES = 2;

function normalizeStageValue(stage = "") {
  const normalizedStage = String(stage || "").trim().toLowerCase().replace(/[^a-z]+/g, "");
  if (normalizedStage === "enquiry" || normalizedStage === "inquiry") return "Enquiry";
  if (normalizedStage === "enrolled") return "Enrolled";
  if (normalizedStage === "dropout" || normalizedStage === "dropped") return "Dropout";
  return String(stage || "").trim();
}

export function getTodayIsoDate() {
  return toIsoDate(new Date());
}

export function compareIsoDates(leftValue, rightValue) {
  const left = toIsoDate(leftValue);
  const right = toIsoDate(rightValue);

  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  return left.localeCompare(right);
}

export function getAutoDropoutDate(followUpDate = "") {
  const normalizedFollowUpDate = toIsoDate(followUpDate);
  if (!normalizedFollowUpDate) return "";
  return normalizedFollowUpDate;
}

export function getInitialEnquiryFollowUpDate(leadDate = "") {
  const normalizedLeadDate = toIsoDate(leadDate);
  if (!normalizedLeadDate) return "";
  return addDays(normalizedLeadDate, ENQUIRY_FOLLOW_UP_INTERVAL_DAYS);
}

export function getFinalEnquiryFollowUpDate(leadDate = "") {
  const normalizedLeadDate = toIsoDate(leadDate);
  if (!normalizedLeadDate) return "";
  return addDays(normalizedLeadDate, ENQUIRY_FOLLOW_UP_INTERVAL_DAYS * ENQUIRY_MAX_FOLLOW_UP_CYCLES);
}

export function getNextEnquiryFollowUpDate({ leadDate = "", followUpDate = "" } = {}) {
  const initialFollowUpDate = getInitialEnquiryFollowUpDate(leadDate);
  const finalFollowUpDate = getFinalEnquiryFollowUpDate(leadDate);
  const normalizedFollowUpDate = toIsoDate(followUpDate);

  if (!initialFollowUpDate) return "";
  if (!normalizedFollowUpDate) return initialFollowUpDate;
  if (!finalFollowUpDate) return "";
  if (compareIsoDates(normalizedFollowUpDate, initialFollowUpDate) <= 0) {
    return finalFollowUpDate;
  }

  return "";
}

export function getDisplayEnquiryFollowUpDate({
  leadDate = "",
  followUpDate = "",
  today = getTodayIsoDate(),
} = {}) {
  const initialFollowUpDate = getInitialEnquiryFollowUpDate(leadDate);
  const finalFollowUpDate = getFinalEnquiryFollowUpDate(leadDate);
  const normalizedFollowUpDate = toIsoDate(followUpDate);
  const normalizedToday = toIsoDate(today);

  if (!initialFollowUpDate) {
    return normalizedFollowUpDate || "";
  }

  if (!normalizedFollowUpDate) {
    return initialFollowUpDate;
  }

  if (finalFollowUpDate && compareIsoDates(normalizedFollowUpDate, finalFollowUpDate) > 0) {
    return initialFollowUpDate;
  }

  if (normalizedToday && compareIsoDates(normalizedToday, initialFollowUpDate) < 0) {
    return initialFollowUpDate;
  }

  if (compareIsoDates(normalizedFollowUpDate, initialFollowUpDate) <= 0) {
    return initialFollowUpDate;
  }

  return finalFollowUpDate || normalizedFollowUpDate;
}

export function shouldAutoDropoutEnquiry({
  pipelineStage = "",
  leadDate = "",
  followUpDate = "",
  today = getTodayIsoDate(),
}) {
  if (normalizeStageValue(pipelineStage) !== "Enquiry") {
    return false;
  }

  const autoDropoutDate = getFinalEnquiryFollowUpDate(leadDate) || getAutoDropoutDate(followUpDate);
  if (!autoDropoutDate) {
    return false;
  }

  return compareIsoDates(autoDropoutDate, today) < 0;
}

export function getDerivedDropoutDate({
  pipelineStage = "",
  leadDate = "",
  followUpDate = "",
  today = getTodayIsoDate(),
} = {}) {
  const normalizedStage = normalizeStageValue(pipelineStage);
  const normalizedFollowUpDate = toIsoDate(followUpDate);

  if (normalizedStage === "Dropout") {
    return normalizedFollowUpDate || "";
  }

  if (shouldAutoDropoutEnquiry({ pipelineStage, leadDate, followUpDate, today })) {
    return getFinalEnquiryFollowUpDate(leadDate) || normalizedFollowUpDate || "";
  }

  return "";
}

export function getEnrollmentTimelineValidationErrors({
  leadDate = "",
  enrolledDate = "",
  followUpDate = "",
  lastPaymentDate = "",
  nextDueDate = "",
  paymentPlan = "",
  pipelineStage = "",
  requireLeadDate = true,
  requireEnrolledDate = false,
  today = getTodayIsoDate(),
} = {}) {
  const errors = {};
  const normalizedLeadDate = toIsoDate(leadDate);
  const normalizedEnrolledDate = toIsoDate(enrolledDate);
  const normalizedFollowUpDate = toIsoDate(followUpDate);
  const normalizedLastPaymentDate = toIsoDate(lastPaymentDate);
  const normalizedNextDueDate = toIsoDate(nextDueDate);
  const normalizedToday = toIsoDate(today);
  const normalizedStage = normalizeStageValue(pipelineStage);
  const normalizedPaymentPlan = String(paymentPlan || "").trim().toUpperCase();
  const needsEnrolledDate = requireEnrolledDate || normalizedStage === "Enrolled";

  if (requireLeadDate && !normalizedLeadDate) {
    errors.lead_date = "Lead date is required.";
  } else if (normalizedLeadDate && normalizedToday && compareIsoDates(normalizedLeadDate, normalizedToday) > 0) {
    errors.lead_date = "Lead date cannot be in the future.";
  }

  if (needsEnrolledDate && !normalizedEnrolledDate) {
    errors.enrolled_date = "Enrolled date is required for enrolled students.";
  } else if (normalizedEnrolledDate && normalizedToday && compareIsoDates(normalizedEnrolledDate, normalizedToday) > 0) {
    errors.enrolled_date = "Enrolled date cannot be in the future.";
  } else if (normalizedLeadDate && normalizedEnrolledDate && compareIsoDates(normalizedEnrolledDate, normalizedLeadDate) < 0) {
    errors.enrolled_date = "Enrolled date cannot be earlier than lead date.";
  }

  if (normalizedFollowUpDate && normalizedLeadDate && compareIsoDates(normalizedFollowUpDate, normalizedLeadDate) < 0) {
    errors.follow_up_date = "Follow-up date cannot be earlier than lead date.";
  }

  if (normalizedLastPaymentDate && normalizedToday && compareIsoDates(normalizedLastPaymentDate, normalizedToday) > 0) {
    errors.last_payment_date = "Last payment date cannot be in the future.";
  } else if (normalizedLastPaymentDate && normalizedEnrolledDate && compareIsoDates(normalizedLastPaymentDate, normalizedEnrolledDate) < 0) {
    errors.last_payment_date = "Last payment date cannot be earlier than enrolled date.";
  } else if (normalizedLastPaymentDate && normalizedLeadDate && !normalizedEnrolledDate && compareIsoDates(normalizedLastPaymentDate, normalizedLeadDate) < 0) {
    errors.last_payment_date = "Last payment date cannot be earlier than lead date.";
  }

  if (normalizedNextDueDate && normalizedPaymentPlan && normalizedPaymentPlan !== "EMI") {
    errors.next_due_date = "Next due date is only applicable for EMI payments.";
  } else if (normalizedNextDueDate && !normalizedLastPaymentDate) {
    errors.next_due_date = "Last payment date is required before setting next due date.";
  } else if (normalizedNextDueDate && compareIsoDates(normalizedNextDueDate, normalizedLastPaymentDate) < 0) {
    errors.next_due_date = "Next due date cannot be earlier than last payment date.";
  }

  return errors;
}

export function getEnrollmentTimelineValidationMessage(options = {}) {
  const errors = getEnrollmentTimelineValidationErrors(options);
  return Object.values(errors)[0] || "";
}

import { addMonthsPreservingDay, toIsoDate } from "./dateMath.js";

export function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function toNumberOrNull(value) {
  if (!hasValue(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isEmiPlan(paymentPlan = "") {
  return String(paymentPlan || "").trim().toUpperCase() === "EMI";
}

export function normalizePaymentPlanValue(paymentPlan = "") {
  const normalizedValue = String(paymentPlan || "").trim();
  if (!normalizedValue) return "";
  if (isEmiPlan(normalizedValue)) return "EMI";
  if (normalizedValue.toLowerCase().includes("one time")) return "One Time";
  return normalizedValue;
}

export function isOneTimePlan(paymentPlan = "") {
  return normalizePaymentPlanValue(paymentPlan) === "One Time";
}

export function formatPaymentTypeDisplay(paymentPlan = "") {
  const normalizedValue = normalizePaymentPlanValue(paymentPlan);
  if (!normalizedValue) return "";
  if (isEmiPlan(normalizedValue)) return "EMI";
  if (normalizedValue.toLowerCase().includes("one time")) return "One Time Payment";
  return normalizedValue;
}

function parsePaymentHistory(history) {
  if (Array.isArray(history)) {
    return history.filter(Boolean);
  }

  if (typeof history === "string") {
    try {
      const parsed = JSON.parse(history);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function getHistoryDate(entry) {
  return toIsoDate(entry?.date || entry?.payment_date || "");
}

function compareHistoryEntries(leftEntry, rightEntry, direction = "desc") {
  const leftDate = getHistoryDate(leftEntry);
  const rightDate = getHistoryDate(rightEntry);

  if (leftDate === rightDate) return 0;
  if (direction === "asc") {
    return leftDate.localeCompare(rightDate);
  }

  return rightDate.localeCompare(leftDate);
}

export function sumPaymentHistoryAmounts(history) {
  return parsePaymentHistory(history).reduce((sum, entry) => {
    return sum + (toNumberOrNull(entry?.paid_amount ?? entry?.amount) || 0);
  }, 0);
}

export function inferPaymentPlan({
  paymentPlan = "",
  installmentsPlanned = 0,
  history = [],
  amountPaid = 0,
} = {}) {
  if (hasValue(paymentPlan)) {
    return normalizePaymentPlanValue(paymentPlan);
  }

  const parsedHistory = parsePaymentHistory(history);
  if (Number(installmentsPlanned) > 1) {
    return "EMI";
  }

  if (
    parsedHistory.some((entry) =>
      isEmiPlan(entry?.payment_type)
      || String(entry?.label || "").trim().toLowerCase().startsWith("installment"))
  ) {
    return "EMI";
  }

  return (toNumberOrNull(amountPaid) || sumPaymentHistoryAmounts(parsedHistory)) > 0 ? "One Time" : "";
}

export function isEmiEnrollment(enrollment = {}, options = {}) {
  const normalizedPaymentPlan = inferPaymentPlan({
    paymentPlan:
      enrollment?.payment_plan
      || (isEmiPlan(enrollment?.payment_method || "") ? "EMI" : ""),
    installmentsPlanned: options.installmentsPlanned ?? enrollment?.installments_planned ?? 0,
    history: options.history ?? enrollment?.payment_history ?? [],
    amountPaid: options.amountPaid ?? enrollment?.amount_paid ?? 0,
  });

  return isEmiPlan(normalizedPaymentPlan);
}

export function isOneTimeEnrollment(enrollment = {}, options = {}) {
  const normalizedPaymentPlan = inferPaymentPlan({
    paymentPlan: enrollment?.payment_plan || "",
    installmentsPlanned: options.installmentsPlanned ?? enrollment?.installments_planned ?? 0,
    history: options.history ?? enrollment?.payment_history ?? [],
    amountPaid: options.amountPaid ?? enrollment?.amount_paid ?? 0,
  });

  return isOneTimePlan(normalizedPaymentPlan);
}

export function resolveAmountPaid(amountPaid, history = []) {
  const directAmount = toNumberOrNull(amountPaid);
  if (directAmount !== null) {
    return directAmount;
  }

  return sumPaymentHistoryAmounts(history);
}

export function resolveRemainingAmount(totalFee, amountPaid) {
  const feeValue = toNumberOrNull(totalFee);
  if (feeValue === null) return null;

  return Math.max(feeValue - (toNumberOrNull(amountPaid) || 0), 0);
}

export function buildPaymentHistoryEntry({
  entryId = "",
  amount = 0,
  amountPaidAfter = 0,
  totalFee = 0,
  paymentPlan = "",
  paymentMethod = "",
  installmentNumber = 0,
  installmentsPlanned = 0,
  paymentDate = "",
  label = "",
  status = "Paid",
} = {}) {
  const normalizedPlan = inferPaymentPlan({
    paymentPlan,
    installmentsPlanned,
    amountPaid: amountPaidAfter,
  });
  const normalizedMethod = hasValue(paymentMethod) ? String(paymentMethod).trim() : "";
  const feeValue = toNumberOrNull(totalFee) ?? 0;
  const paymentAmount = toNumberOrNull(amount) ?? 0;
  const cumulativePaid = toNumberOrNull(amountPaidAfter) ?? paymentAmount;
  const pendingAmount = feeValue ? Math.max(feeValue - cumulativePaid, 0) : 0;
  const normalizedInstallmentsPlanned = Number(installmentsPlanned) || (normalizedPlan ? 1 : 0);
  const normalizedInstallmentNumber = Number(installmentNumber)
    || (isEmiPlan(normalizedPlan) ? 1 : cumulativePaid > 0 ? 1 : 0);

  return {
    id: entryId || `payment-${paymentDate || Date.now()}`,
    label:
      label
      || (isEmiPlan(normalizedPlan)
        ? `Installment ${normalizedInstallmentNumber}`
        : feeValue > 0 && cumulativePaid >= feeValue
          ? "Full Payment"
          : "Part Payment"),
    amount: paymentAmount,
    paid_amount: paymentAmount,
    cumulative_paid: cumulativePaid,
    course_fee: feeValue,
    pending_amount: pendingAmount,
    payment_type: formatPaymentTypeDisplay(normalizedPlan),
    payment_method: normalizedMethod,
    mode: normalizedMethod,
    date: toIsoDate(paymentDate),
    status,
    installments_paid: normalizedInstallmentNumber,
    installments_planned: normalizedInstallmentsPlanned,
  };
}

export function normalizePaymentHistoryList(history, options = {}) {
  const parsedHistory = parsePaymentHistory(history);
  if (!parsedHistory.length) return [];

  const totalFee = toNumberOrNull(options.totalFee);
  const paymentPlan = inferPaymentPlan({
    paymentPlan: options.paymentPlan,
    installmentsPlanned: options.installmentsPlanned,
    history: parsedHistory,
    amountPaid: options.amountPaid,
  });
  const paymentMethod = hasValue(options.paymentMethod) ? String(options.paymentMethod).trim() : "";
  const installmentsPlanned = Number(options.installmentsPlanned)
    || (isEmiPlan(paymentPlan) ? parsedHistory.length : paymentPlan ? 1 : 0);
  const ascendingHistory = [...parsedHistory].sort((leftEntry, rightEntry) =>
    compareHistoryEntries(leftEntry, rightEntry, "asc"));
  let runningPaid = 0;

  const normalizedEntries = ascendingHistory.map((entry, index) => {
    const paymentAmount = toNumberOrNull(entry?.paid_amount ?? entry?.amount) ?? 0;
    const cumulativePaid = toNumberOrNull(entry?.cumulative_paid) ?? (runningPaid + paymentAmount);
    const entryPlan = inferPaymentPlan({
      paymentPlan: entry?.payment_type || paymentPlan,
      installmentsPlanned: entry?.installments_planned || installmentsPlanned,
      history: [],
      amountPaid: cumulativePaid,
    });
    const entryMethod =
      (hasValue(entry?.payment_method) ? String(entry.payment_method).trim() : "")
      || (hasValue(entry?.mode) ? String(entry.mode).trim() : "")
      || paymentMethod;
    const entryInstallmentNumber = Number(entry?.installments_paid)
      || (isEmiPlan(entryPlan) ? index + 1 : cumulativePaid > 0 ? 1 : 0);
    const entryCourseFee = toNumberOrNull(entry?.course_fee) ?? totalFee;
    const entryPendingAmount = toNumberOrNull(entry?.pending_amount)
      ?? (entryCourseFee === null ? null : Math.max(entryCourseFee - cumulativePaid, 0));

    runningPaid = cumulativePaid;

    return {
      ...entry,
      id: entry?.id || `payment-${index + 1}-${getHistoryDate(entry) || Date.now()}`,
      label:
        entry?.label
        || (isEmiPlan(entryPlan)
          ? `Installment ${entryInstallmentNumber}`
          : entryCourseFee && cumulativePaid >= entryCourseFee
            ? "Full Payment"
            : "Payment"),
      amount: paymentAmount,
      paid_amount: paymentAmount,
      cumulative_paid: cumulativePaid,
      course_fee: entryCourseFee,
      pending_amount: entryPendingAmount,
      payment_type: formatPaymentTypeDisplay(entry?.payment_type || entryPlan),
      payment_method: entryMethod,
      mode: entryMethod,
      date: getHistoryDate(entry),
      status: entry?.status || "Paid",
      installments_paid: entryInstallmentNumber,
      installments_planned: Number(entry?.installments_planned) || installmentsPlanned,
    };
  });

  return normalizedEntries.sort((leftEntry, rightEntry) =>
    compareHistoryEntries(leftEntry, rightEntry, "desc"));
}

export function getLatestPaymentEntry(history, options = {}) {
  return normalizePaymentHistoryList(history, options)[0] || null;
}

export function resolveLastPaymentDate({
  lastPaymentDate = "",
  history = [],
  amountPaid = 0,
  enrolledDate = "",
  leadDate = "",
} = {}) {
  if (hasValue(lastPaymentDate)) {
    return toIsoDate(lastPaymentDate);
  }

  const latestPayment = getLatestPaymentEntry(history);
  if (hasValue(latestPayment?.date)) {
    return latestPayment.date;
  }

  return "";
}

export function resolveNextDueDate({
  paymentStatus = "",
  paymentPlan = "",
  lastPaymentDate = "",
  history = [],
  fallbackDate = "",
} = {}) {
  if (String(paymentStatus || "").trim() === "Paid") {
    return "";
  }

  const normalizedPaymentPlan = inferPaymentPlan({
    paymentPlan,
    history,
  });
  if (!isEmiPlan(normalizedPaymentPlan)) {
    return "";
  }

  const anchorDate = resolveLastPaymentDate({
    lastPaymentDate,
    history,
  });
  return anchorDate ? addMonthsPreservingDay(anchorDate, 1) : "";
}

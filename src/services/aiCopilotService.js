import { formatCurrency, formatDate } from "../utils/formatters";
import { resolveAmountPaid, resolveRemainingAmount } from "../utils/paymentHelpers";

const AI_API_KEY = String(import.meta.env.VITE_AI_API_KEY || "").trim();
const AI_MODEL = String(import.meta.env.VITE_AI_MODEL || "gpt-4o-mini").trim();
const AI_API_URL = String(import.meta.env.VITE_AI_API_URL || "https://api.openai.com/v1/chat/completions").trim();
const GEMINI_API_KEY = String(import.meta.env.VITE_GEMINI_API_KEY || "").trim();
const GEMINI_MODEL = String(import.meta.env.VITE_GEMINI_MODEL || "gemini-3.5-flash").trim();
const GEMINI_API_URL = String(import.meta.env.VITE_GEMINI_API_URL || "https://generativelanguage.googleapis.com/v1beta").trim();
const MAX_MATCHED_RESULTS = 8;

function normalizeText(value = "") {
  return String(value || "").trim();
}

function normalizeKey(value = "") {
  return normalizeText(value).toLowerCase().replace(/\s+/g, " ");
}

function normalizeSemanticQuery(value = "") {
  let text = normalizeKey(value);

  const replacements = [
    [/\benquiried\b/g, "enquiry"],
    [/\benquired\b/g, "enquiry"],
    [/\benquiries\b/g, "enquiry"],
    [/\binquiries\b/g, "enquiry"],
    [/\binquiry\b/g, "enquiry"],
    [/\bcurrent enquiry\b/g, "enquiry"],
    [/\bcurrent enquiry\b/g, "enquiry"],
    [/\bactive enquiry\b/g, "enquiry"],
    [/\bactive enquiries\b/g, "enquiry"],
    [/\bdropped out\b/g, "dropout"],
    [/\bdropped\b/g, "dropout"],
    [/\bdrop out\b/g, "dropout"],
    [/\bcurrently\b/g, "current"],
    [/\bstudents\b/g, "student"],
  ];

  replacements.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });

  return text.replace(/\s+/g, " ").trim();
}

function extractQueryConcepts(query = "") {
  const text = normalizeSemanticQuery(query);
  const wantsOnly = text.includes("only") || text.includes("just");
  const wantsPendingKeyword = text.includes("pending");

  return {
    text,
    wantsOnly,
    wantsEnquiry:
      text.includes("enquiry")
      || text.includes("lead")
      || text.includes("follow up")
      || text.includes("follow-up"),
    wantsDropout: text.includes("dropout"),
    wantsEnrolled:
      text.includes("enrolled")
      || text.includes("admission")
      || text.includes("admitted"),
    wantsEmi:
      text.includes("emi")
      || text.includes("installment")
      || text.includes("instalment"),
    wantsPendingPayment:
      wantsPendingKeyword
      || text.includes("due")
      || text.includes("balance")
      || text.includes("remaining")
      || text.includes("unpaid"),
    wantsExactPendingPayment:
      wantsPendingKeyword
      && wantsOnly
      && !text.includes("partial")
      && !text.includes("overdue"),
    wantsPaid: text.includes("paid") || text.includes("cleared"),
    wantsOverdue:
      text.includes("overdue")
      || text.includes("late payment")
      || text.includes("missed payment"),
    wantsVerificationPending:
      text.includes("pending verification")
      || text.includes("verification pending")
      || text.includes("verify pending"),
    wantsCorrection:
      text.includes("correction")
      || text.includes("requested correction"),
    wantsCurrent:
      text.includes("current")
      || text.includes("active")
      || text.includes("present"),
  };
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getRecordLabel(record) {
  return normalizeText(record?.student?.full_name) || "Selected student";
}

function getPaymentSummary(record) {
  const totalFee = toNumber(record?.enrollment?.total_fee || record?.course?.fee);
  const amountPaid = toNumber(resolveAmountPaid(record?.enrollment?.amount_paid, record?.enrollment?.payment_history));
  const dueAmount = toNumber(resolveRemainingAmount(totalFee, amountPaid));

  return { totalFee, amountPaid, dueAmount };
}

function getMissingItems(record) {
  const items = [];
  const missingInformation = Array.isArray(record?.missingInformation) ? record.missingInformation : [];

  missingInformation.forEach((item) => {
    const safeItem = normalizeText(item);
    if (safeItem) items.push(safeItem);
  });

  const documents = Array.isArray(record?.documents) ? record.documents : [];
  const hasStudentPhoto = documents.some((item) => item.document_type === "Student Photo" && item.file_url);
  const hasAadhaar = documents.some((item) => item.document_type === "Aadhaar ID Photo" && item.file_url);

  if (!hasStudentPhoto) items.push("Student photo upload");
  if (!hasAadhaar) items.push("Aadhaar ID upload");

  return [...new Set(items)];
}

function getTimelineFlags(record) {
  const flags = [];
  const payment = getPaymentSummary(record);
  const stage = normalizeText(record?.currentStage);
  const verificationStatus = normalizeText(record?.enrollment?.verification_status) || "Pending";
  const paymentStatus = normalizeText(record?.enrollment?.payment_status) || "Pending";
  const followUpDate = normalizeText(record?.enrollment?.follow_up_date);
  const nextDueDate = normalizeText(record?.enrollment?.next_due_date);

  if (stage === "Dropout") flags.push("Dropped out");
  if (stage === "Enquiry") flags.push("Still in enquiry stage");
  if (stage !== "Dropout" && verificationStatus && verificationStatus !== "Approved") flags.push(`Verification is ${verificationStatus.toLowerCase()}`);
  if (payment.dueAmount > 0) flags.push(`Outstanding balance ${formatCurrency(payment.dueAmount)}`);
  if (paymentStatus === "Overdue") flags.push("Payment is overdue");
  if (followUpDate) flags.push(`Follow-up date ${formatDate(followUpDate)}`);
  if (nextDueDate) flags.push(`Next due date ${formatDate(nextDueDate)}`);

  return flags;
}

function getPriorityScore(record) {
  const payment = getPaymentSummary(record);
  const missingItems = getMissingItems(record);
  let score = 0;

  if (record?.isEnquiryRecord) score += 18;
  if (record?.isEnrolledRecord) score += 10;
  if (record?.isDropoutRecord) score += 30;
  if (normalizeText(record?.enrollment?.payment_status) === "Overdue") score += 35;
  if (payment.dueAmount > 0) score += Math.min(30, Math.round(payment.dueAmount / 5000) * 4);
  if (missingItems.length) score += Math.min(24, missingItems.length * 8);
  if (normalizeText(record?.enrollment?.verification_status) === "Pending") score += 12;
  if (normalizeText(record?.enrollment?.verification_status) === "Requested Correction") score += 18;

  return score;
}

function getUrgencyLevel(record) {
  const score = getPriorityScore(record);
  if (score >= 70) return "critical";
  if (score >= 45) return "high";
  if (score >= 20) return "medium";
  return "low";
}

function getSortTimestamp(record) {
  const raw = record?.enrollment?.enrolled_date || record?.enrollment?.lead_date || record?.enrollment?.created_at || "";
  const time = Date.parse(raw || "");
  return Number.isNaN(time) ? 0 : time;
}

function toDateSearchTokens(value = "") {
  const parsed = Date.parse(value || "");
  if (Number.isNaN(parsed)) return [];

  const date = new Date(parsed);
  const iso = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

  return [
    iso,
    normalizeKey(formatDate(iso)),
    normalizeKey(
      new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date),
    ),
  ];
}

function extractQueryDateTokens(query = "") {
  const normalizedQuery = normalizeSemanticQuery(query);
  const matches = normalizedQuery.match(/\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g) || [];
  return [...new Set(matches.flatMap((value) => toDateSearchTokens(value)))];
}

function recordMatchesDateTokens(record, tokens = [], fieldNames = []) {
  if (!tokens.length) return true;

  const dateValues = fieldNames
    .map((fieldName) => record?.enrollment?.[fieldName])
    .filter(Boolean);
  const searchableTokens = new Set(dateValues.flatMap((value) => toDateSearchTokens(value)));

  return tokens.every((token) => searchableTokens.has(token));
}

function getRecordFingerprint(record) {
  const student = record?.student || {};
  const enrollment = record?.enrollment || {};
  return [
    normalizeKey(student.email || student.phone || student.full_name),
    normalizeKey(record?.course?.course_name || enrollment.course_name),
    normalizeKey(enrollment.batch),
    normalizeKey(record?.currentStage),
    normalizeKey(enrollment.enrolled_date || enrollment.lead_date),
  ].join("|");
}

export function buildCopilotRecordSet(portalRecords = []) {
  const latestById = new Map();

  portalRecords.forEach((record) => {
    if (!record?.id) return;
    const existing = latestById.get(record.id);
    if (!existing || getSortTimestamp(record) >= getSortTimestamp(existing)) {
      latestById.set(record.id, record);
    }
  });

  const deduped = [];
  const seenFingerprints = new Map();

  [...latestById.values()]
    .sort((left, right) => getSortTimestamp(right) - getSortTimestamp(left))
    .forEach((record) => {
      const fingerprint = getRecordFingerprint(record);
      const existing = seenFingerprints.get(fingerprint);
      if (!existing) {
        seenFingerprints.set(fingerprint, record);
        deduped.push(record);
        return;
      }

      if (getSortTimestamp(record) > getSortTimestamp(existing)) {
        const index = deduped.findIndex((item) => item.id === existing.id);
        if (index >= 0) deduped[index] = record;
        seenFingerprints.set(fingerprint, record);
      }
    });

  return deduped;
}

function buildOverview(record) {
  const payment = getPaymentSummary(record);
  const studentName = getRecordLabel(record);
  const courseName = normalizeText(record?.course?.course_name || record?.enrollment?.course_name) || "Course pending";
  const stage = normalizeText(record?.currentStage) || "Unknown";
  const verificationStatus = normalizeText(record?.enrollment?.verification_status) || "Pending";
  const paymentStatus = normalizeText(record?.enrollment?.payment_status) || "Pending";

  return [
    `${studentName} is currently in the ${stage.toLowerCase()} stage for ${courseName}.`,
    `Verification is ${verificationStatus.toLowerCase()} and payment status is ${paymentStatus.toLowerCase()}.`,
    payment.totalFee > 0
      ? `The total fee is ${formatCurrency(payment.totalFee)}, ${formatCurrency(payment.amountPaid)} is paid, and ${formatCurrency(payment.dueAmount)} remains.`
      : "Course fee is not fully set yet, so payment follow-up should wait until the fee is confirmed.",
  ].join(" ");
}

function buildNextSteps(record) {
  const steps = [];
  const missingItems = getMissingItems(record);
  const payment = getPaymentSummary(record);
  const verificationStatus = normalizeText(record?.enrollment?.verification_status) || "Pending";

  if (missingItems.length) steps.push(`Collect or re-upload: ${missingItems.join(", ")}.`);
  if (verificationStatus === "Pending") steps.push("Review uploaded documents and either approve them or request a correction.");
  if (verificationStatus === "Requested Correction") steps.push("Send a correction-focused follow-up listing the exact items to fix.");
  if (record?.isEnquiryRecord) steps.push("Move the lead toward enrollment by confirming course, batch, fee, and a target enrollment date.");
  if (payment.dueAmount > 0) steps.push(`Follow up on the pending balance of ${formatCurrency(payment.dueAmount)} and confirm the next payment date.`);
  if (!steps.length) steps.push("This profile looks healthy. Keep the student warm with a short progress update and monitor the next milestone.");

  return steps;
}

function buildFollowUpMessage(record) {
  const studentName = getRecordLabel(record);
  const courseName = normalizeText(record?.course?.course_name || record?.enrollment?.course_name) || "your selected course";
  const missingItems = getMissingItems(record);
  const payment = getPaymentSummary(record);
  const verificationStatus = normalizeText(record?.enrollment?.verification_status) || "Pending";

  const lines = [
    `Hi ${studentName},`,
    "",
    `This is a quick update from the admissions team regarding ${courseName}.`,
  ];

  if (missingItems.length) lines.push(`We still need the following to continue your admission smoothly: ${missingItems.join(", ")}.`);
  if (verificationStatus === "Requested Correction") {
    lines.push("Our team reviewed the submitted details and a few corrections are still needed before approval.");
  } else if (verificationStatus === "Pending") {
    lines.push("Your profile is under review and we want to help you complete the remaining steps quickly.");
  }
  if (payment.dueAmount > 0) lines.push(`There is also a pending balance of ${formatCurrency(payment.dueAmount)} on your enrollment.`);

  lines.push("Please reply to this message or contact our team once the pending step is completed.");
  lines.push("");
  lines.push("Regards,");
  lines.push("Admissions Team");

  return lines.join("\n");
}

function buildWhatsAppMessage(record, variant = "follow_up") {
  const studentName = getRecordLabel(record);
  const courseName = normalizeText(record?.course?.course_name || record?.enrollment?.course_name) || "your selected course";
  const missingItems = getMissingItems(record);
  const payment = getPaymentSummary(record);

  if (variant === "payment") {
    return [
      `Hi ${studentName}, this is a quick payment update from CERTISURED.`,
      payment.dueAmount > 0
        ? `Your pending balance for ${courseName} is ${formatCurrency(payment.dueAmount)}.`
        : `Your payment record for ${courseName} looks up to date.`,
      normalizeText(record?.enrollment?.next_due_date) ? `Next due date: ${formatDate(record.enrollment.next_due_date)}.` : "",
      "Reply here if you need help with the payment process.",
    ].filter(Boolean).join(" ");
  }

  return [
    `Hi ${studentName}, this is a quick admissions follow-up from CERTISURED for ${courseName}.`,
    missingItems.length
      ? `We still need ${missingItems.join(", ")} to move your profile forward.`
      : "Your profile is under review and we are helping you complete the next step.",
    "Reply here once done and our team will assist you further.",
  ].join(" ");
}

function buildPriorityQueue(records = []) {
  return records
    .map((record) => {
      const missingItems = getMissingItems(record);
      const timelineFlags = getTimelineFlags(record);
      return {
        id: record.id,
        studentName: getRecordLabel(record),
        stage: normalizeText(record.currentStage) || "Unknown",
        priorityScore: getPriorityScore(record),
        reason: timelineFlags[0] || (missingItems.length ? `Missing ${missingItems[0]}` : "Needs review"),
      };
    })
    .sort((left, right) => right.priorityScore - left.priorityScore)
    .slice(0, 6);
}

function toRecordSummary(record) {
  const payment = getPaymentSummary(record);
  return {
    id: record.id,
    studentName: getRecordLabel(record),
    courseName: normalizeText(record?.course?.course_name || record?.enrollment?.course_name) || "Course pending",
    stage: normalizeText(record?.currentStage) || "Unknown",
    batch: normalizeText(record?.enrollment?.batch) || "N/A",
    verificationStatus: normalizeText(record?.enrollment?.verification_status) || "Pending",
    paymentStatus: normalizeText(record?.enrollment?.payment_status) || "Pending",
    dueAmount: payment.dueAmount,
    followUpDate: normalizeText(record?.enrollment?.follow_up_date),
    urgencyLevel: getUrgencyLevel(record),
  };
}

function buildRecordContext(record) {
  return {
    summary: toRecordSummary(record),
    missingItems: getMissingItems(record),
    timelineFlags: getTimelineFlags(record),
    remarks: normalizeText(record?.enrollment?.remarks),
  };
}

function tokenizeQuery(query = "") {
  return normalizeSemanticQuery(query)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function recordMatchesQuery(record, tokens = []) {
  if (!tokens.length) return true;
  const haystack = [
    record.student?.full_name,
    record.student?.email,
    record.student?.phone,
    record.course?.course_name,
    record.enrollment?.course_name,
    record.enrollment?.batch,
    record.currentStage,
    record.enrollment?.verification_status,
    record.enrollment?.payment_status,
    record.enrollment?.remarks,
    record.enrollment?.lead_date,
    record.enrollment?.enrolled_date,
    record.enrollment?.follow_up_date,
    record.enrollment?.dropout_date,
    formatDate(record.enrollment?.lead_date),
    formatDate(record.enrollment?.enrolled_date),
    formatDate(record.enrollment?.follow_up_date),
    formatDate(record.enrollment?.dropout_date),
    ...getMissingItems(record),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return tokens.every((token) => haystack.includes(token));
}

function recordMatchesConcepts(record, concepts) {
  if (!concepts) return true;

  if (concepts.wantsDropout && normalizeKey(record?.currentStage) !== "dropout") return false;
  if (concepts.wantsEnquiry && normalizeKey(record?.currentStage) !== "enquiry") return false;
  if (concepts.wantsEnrolled && normalizeKey(record?.currentStage) !== "enrolled") return false;
  if (concepts.wantsVerificationPending && normalizeKey(record?.enrollment?.verification_status) !== "pending") return false;
  if (concepts.wantsCorrection && normalizeKey(record?.enrollment?.verification_status) !== "requested correction") return false;
  if (concepts.wantsPaid && normalizeKey(record?.enrollment?.payment_status) !== "paid") return false;
  if (concepts.wantsOverdue && normalizeKey(record?.enrollment?.payment_status) !== "overdue") return false;

  if (concepts.wantsEmi) {
    const paymentPlan = normalizeKey(record?.enrollment?.payment_plan || "");
    const paymentMethod = normalizeKey(record?.enrollment?.payment_method || "");
    const hasEmi = paymentPlan === "emi" || paymentMethod === "emi" || Number(record?.enrollment?.installments_planned || 0) > 1;
    if (!hasEmi) return false;
  }

  if (concepts.wantsPendingPayment) {
    const paymentStatus = normalizeKey(record?.enrollment?.payment_status || "");
    const dueAmount = getPaymentSummary(record).dueAmount;
    const isActivePaymentRecord = Boolean(record?.paymentEligible) && normalizeKey(record?.currentStage) === "enrolled";
    const isPendingPayment = concepts.wantsExactPendingPayment
      ? isActivePaymentRecord && paymentStatus === "pending"
      : isActivePaymentRecord && (["pending", "partial", "overdue"].includes(paymentStatus) || dueAmount > 0);
    if (!isPendingPayment) return false;
  }

  return true;
}

function applyIntentFilters(records = [], query = "") {
  const concepts = extractQueryConcepts(query);
  const text = concepts.text;
  const queryDateTokens = extractQueryDateTokens(query);
  let filtered = [...records];
  const isDropoutQuery = concepts.wantsDropout;

  if (text.includes("pending verification") || text.includes("verification pending")) {
    filtered = filtered.filter((record) => normalizeKey(record?.enrollment?.verification_status) === "pending");
  }
  if (text.includes("requested correction") || text.includes("correction")) {
    filtered = filtered.filter((record) => normalizeKey(record?.enrollment?.verification_status) === "requested correction");
  }
  if (isDropoutQuery) {
    filtered = filtered.filter((record) => normalizeKey(record?.currentStage) === "dropout");
  }
  if (text.includes("enquiry") || text.includes("inquiry")) {
    filtered = filtered.filter((record) => normalizeKey(record?.currentStage) === "enquiry");
  }
  if (text.includes("enrolled")) {
    filtered = filtered.filter((record) => normalizeKey(record?.currentStage) === "enrolled");
  }
  if (text.includes("overdue")) {
    filtered = filtered.filter((record) => normalizeKey(record?.enrollment?.payment_status) === "overdue");
  }
  if (text.includes("partial")) {
    filtered = filtered.filter((record) => normalizeKey(record?.enrollment?.payment_status) === "partial");
  }
  if (text.includes("paid")) {
    filtered = filtered.filter((record) => normalizeKey(record?.enrollment?.payment_status) === "paid");
  }
  if (text.includes("missing docs") || text.includes("missing documents") || text.includes("documents missing")) {
    filtered = filtered.filter((record) => getMissingItems(record).length > 0);
  }
  if (text.includes("payment due") || text.includes("due amount") || text.includes("pending balance")) {
    filtered = filtered.filter((record) => getPaymentSummary(record).dueAmount > 0);
  }
  if (concepts.wantsEmi) {
    filtered = filtered.filter((record) => recordMatchesConcepts(record, { wantsEmi: true }));
  }
  if (concepts.wantsPendingPayment) {
    filtered = filtered.filter((record) => recordMatchesConcepts(record, { wantsPendingPayment: true }));
  }
  if (text.includes("follow-up date") || text.includes("follow up date") || text.includes("followup date")) {
    filtered = filtered.filter((record) => normalizeText(record?.enrollment?.follow_up_date) !== "");
    if (queryDateTokens.length) {
      filtered = filtered.filter((record) => recordMatchesDateTokens(record, queryDateTokens, ["follow_up_date"]));
    }
  } else if (text.includes("dropout date")) {
    filtered = filtered.filter((record) => normalizeText(record?.enrollment?.dropout_date) !== "");
    if (queryDateTokens.length) {
      filtered = filtered.filter((record) => recordMatchesDateTokens(record, queryDateTokens, ["dropout_date"]));
    }
  } else if (queryDateTokens.length) {
    filtered = filtered.filter((record) => recordMatchesDateTokens(
      record,
      queryDateTokens,
      ["lead_date", "enrolled_date", "follow_up_date", "dropout_date"],
    ));
  }

  return filtered;
}

function findMatchedRecords(records = [], query = "", selectedRecord = null) {
  const normalizedQuery = normalizeSemanticQuery(query);
  if (!normalizedQuery) {
    return selectedRecord ? [selectedRecord] : [];
  }

  const intentFiltered = applyIntentFilters(records, normalizedQuery);
  const concepts = extractQueryConcepts(normalizedQuery);
  const tokenMatched = intentFiltered.filter((record) =>
    recordMatchesConcepts(record, concepts) && recordMatchesQuery(record, tokenizeQuery(normalizedQuery)));
  const conceptMatched = intentFiltered.filter((record) => recordMatchesConcepts(record, concepts));

  const base = tokenMatched.length ? tokenMatched : conceptMatched.length ? conceptMatched : intentFiltered;

  return base
    .sort((left, right) => getPriorityScore(right) - getPriorityScore(left) || getSortTimestamp(right) - getSortTimestamp(left))
    .slice(0, MAX_MATCHED_RESULTS);
}

function isLookupQuery(query = "") {
  const text = normalizeSemanticQuery(query);
  return ["show", "list", "which", "who", "find", "student", "current"].some((keyword) => text.includes(keyword));
}

function buildLookupResponse(query, matchedRecords) {
  if (!matchedRecords.length) {
    return `I could not find any current records matching "${normalizeText(query)}" in the available portal data.`;
  }

  const lines = [
    `I found ${matchedRecords.length} matching record${matchedRecords.length > 1 ? "s" : ""} for "${normalizeText(query)}".`,
    "",
    ...matchedRecords.map((record, index) => {
      const summary = toRecordSummary(record);
      const dueLabel = summary.dueAmount > 0 ? formatCurrency(summary.dueAmount) : "No due amount";
      return `${index + 1}. ${summary.studentName} · ${summary.stage} · ${summary.courseName} · ${summary.verificationStatus} · ${summary.paymentStatus} · ${dueLabel}`;
    }),
  ];

  return lines.join("\n");
}

function buildSystemPrompt() {
  return [
    "You are an admissions copilot for an Indian education institute.",
    "Use the structured record data only.",
    "Do not invent students, statuses, or counts.",
    "When matchedRecords are provided, answer only from those records.",
    "Keep the answer operational, neat, and short.",
  ].join(" ");
}

function buildUserPrompt({ intent, query, portalRecord, matchedRecords, sourceSummary }) {
  return JSON.stringify(
    {
      intent,
      query: normalizeText(query),
      sourceSummary,
      selectedRecord: portalRecord ? buildRecordContext(portalRecord) : null,
      matchedRecords: matchedRecords.map((record) => buildRecordContext(record)),
    },
    null,
    2,
  );
}

function getConfiguredAiProvider() {
  if (GEMINI_API_KEY) {
    return "gemini";
  }

  if (AI_API_KEY) {
    return "openai";
  }

  return "";
}

function buildAgentRecordCatalog(records = []) {
  return records.map((record) => {
    const summary = toRecordSummary(record);
    return {
      id: record.id,
      studentName: summary.studentName,
      stage: summary.stage,
      courseName: summary.courseName,
      batch: summary.batch,
      verificationStatus: summary.verificationStatus,
      paymentStatus: summary.paymentStatus,
      dueAmount: summary.dueAmount,
      followUpDate: summary.followUpDate,
      remarks: normalizeText(record?.enrollment?.remarks),
      missingItems: getMissingItems(record),
      flags: getTimelineFlags(record),
    };
  });
}

function buildStructuredAgentPrompt({ intent, query, portalRecord, portalRecords, sourceSummary }) {
  return JSON.stringify(
    {
      task: "Answer the user's request from admissions records only and identify the most relevant record ids.",
      rules: [
        "Understand natural wording, typos, shorthand, and mixed phrasing.",
        "Do not invent students, statuses, or counts.",
        "If the user asks for filtered students, include only those actually matching the request.",
        "Prefer current active data over old interpretations.",
        "Return valid JSON only.",
      ],
      output_schema: {
        answer: "string",
        matched_record_ids: ["string"],
        suggestions: ["string"],
      },
      intent,
      query: normalizeText(query),
      selected_record: portalRecord ? buildRecordContext(portalRecord) : null,
      source_summary: sourceSummary,
      records: buildAgentRecordCatalog(portalRecords),
    },
    null,
    2,
  );
}

function parseStructuredAgentResponse(rawText = "") {
  const text = String(rawText || "").trim();
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : text;
  const parsed = JSON.parse(candidate);

  return {
    answer: normalizeText(parsed?.answer || ""),
    matchedRecordIds: Array.isArray(parsed?.matched_record_ids) ? parsed.matched_record_ids.map((item) => String(item || "").trim()).filter(Boolean) : [],
    suggestions: Array.isArray(parsed?.suggestions) ? parsed.suggestions.map((item) => normalizeText(item)).filter(Boolean) : [],
  };
}

function parseAiErrorPayload(errorText = "") {
  const normalized = String(errorText || "").trim();
  if (!normalized) return null;

  try {
    return JSON.parse(normalized);
  } catch {
    const jsonMatch = normalized.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }
  }
}

function createAiError(message, code = "", status = "", retryAfterSeconds = null) {
  const error = new Error(message);
  error.aiCode = String(code || "").trim();
  error.aiStatus = String(status || "").trim();
  error.retryAfterSeconds = Number.isFinite(Number(retryAfterSeconds)) ? Number(retryAfterSeconds) : null;
  return error;
}

function formatProviderError(errorText = "", fallbackMessage = "AI response could not be generated.") {
  const payload = parseAiErrorPayload(errorText);
  const providerError = payload?.error || payload;
  const code = String(providerError?.code || "").trim();
  const status = String(providerError?.status || "").trim();
  const message = String(providerError?.message || "").trim();
  const retryMatch = message.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
  const retryAfterSeconds = retryMatch ? Math.ceil(Number(retryMatch[1])) : null;

  if (code === "429" || status === "RESOURCE_EXHAUSTED" || /quota exceeded|rate limit|resource exhausted/i.test(message)) {
    const retryLine = retryAfterSeconds ? ` Try again in about ${retryAfterSeconds} seconds.` : " Try again after a short wait.";
    return createAiError(`AI limit reached for now.${retryLine}`, code, status, retryAfterSeconds);
  }

  if (/api key|permission|unauthorized|forbidden|invalid/i.test(message)) {
    return createAiError("AI setup error. Check the API key and model settings.", code, status, retryAfterSeconds);
  }

  return createAiError(message || fallbackMessage, code, status, retryAfterSeconds);
}

async function requestOpenAiCopilot(prompt) {
  const response = await fetch(AI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: `${buildSystemPrompt()} Reply in strict JSON only.` },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw formatProviderError(errorText, "OpenAI response could not be generated.");
  }

  const payload = await response.json();
  const message = payload?.choices?.[0]?.message?.content;
  if (!normalizeText(message)) throw new Error("OpenAI response was empty.");
  return parseStructuredAgentResponse(message);
}

async function requestGeminiCopilot(prompt) {
  const response = await fetch(`${GEMINI_API_URL}/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${buildSystemPrompt()}\nReturn strict JSON only.\n\n${prompt}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw formatProviderError(errorText, "Gemini response could not be generated.");
  }

  const payload = await response.json();
  const message = payload?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("\n");
  if (!normalizeText(message)) throw new Error("Gemini response was empty.");
  return parseStructuredAgentResponse(message);
}

async function requestRemoteCopilot({ intent, query, portalRecord, portalRecords, sourceSummary }) {
  const provider = getConfiguredAiProvider();
  const prompt = buildStructuredAgentPrompt({
    intent,
    query,
    portalRecord,
    portalRecords,
    sourceSummary,
  });

  if (provider === "gemini") {
    return requestGeminiCopilot(prompt);
  }

  if (provider === "openai") {
    return requestOpenAiCopilot(prompt);
  }

  throw new Error("No AI provider configured.");
}

function buildFallbackResponse({ intent, query, portalRecord, matchedRecords, sourceSummary }) {
  if (intent === "priority") {
    return [
      `Priority queue is based on ${sourceSummary.uniqueRecords} cleaned live record${sourceSummary.uniqueRecords === 1 ? "" : "s"}.`,
      "",
      ...sourceSummary.priorityQueue.map((item, index) => `${index + 1}. ${item.studentName} (${item.stage}) - ${item.reason}`),
    ].join("\n");
  }

  if (query && isLookupQuery(query)) {
    return buildLookupResponse(query, matchedRecords);
  }

  if (matchedRecords.length > 1) {
    return buildLookupResponse(query || "your request", matchedRecords);
  }

  if (!portalRecord) {
    return "Select a record or ask a direct question like 'show pending verification students' or 'show Chandraka only'.";
  }

  if (intent === "summary") {
    return `${buildOverview(portalRecord)} Key flags: ${getTimelineFlags(portalRecord).join(", ") || "No major blockers detected"}.`;
  }

  if (intent === "next_step") {
    return [`Best next actions for ${getRecordLabel(portalRecord)}:`, "", ...buildNextSteps(portalRecord).map((item, index) => `${index + 1}. ${item}`)].join("\n");
  }

  if (intent === "follow_up") {
    return buildFollowUpMessage(portalRecord);
  }

  return buildOverview(portalRecord);
}

export function getCopilotWorkspaceData(portalRecords = []) {
  const cleanedRecords = buildCopilotRecordSet(portalRecords);
  return {
    uniqueRecords: cleanedRecords.length,
    priorityQueue: buildPriorityQueue(cleanedRecords),
    sourceLabel: `Using ${cleanedRecords.length} cleaned records from the current portal data`,
  };
}

export function getAdmissionsUrgency(record) {
  return {
    level: getUrgencyLevel(record),
    score: getPriorityScore(record),
    reasons: getTimelineFlags(record),
  };
}

export function getWhatsAppDrafts(record) {
  return [
    {
      id: "follow_up",
      label: "Admission follow-up",
      message: buildWhatsAppMessage(record, "follow_up"),
    },
    {
      id: "payment",
      label: "Payment reminder",
      message: buildWhatsAppMessage(record, "payment"),
    },
  ];
}

export async function generateAdmissionsCopilotResponse({
  intent,
  query,
  portalRecord,
  portalRecords,
}) {
  const cleanedRecords = buildCopilotRecordSet(portalRecords);
  const sourceSummary = {
    uniqueRecords: cleanedRecords.length,
    priorityQueue: buildPriorityQueue(cleanedRecords),
  };

  if (!getConfiguredAiProvider()) {
    return {
      mode: "ai_not_configured",
      answer: "AI agent is not configured yet. Add VITE_GEMINI_API_KEY for Gemini free tier or VITE_AI_API_KEY for OpenAI.",
      matchedRecords: [],
      insights: [],
      suggestions: ["Add a real AI key to the environment and restart the app."],
    };
  }

  try {
    const response = await requestRemoteCopilot({
      intent,
      query,
      portalRecord,
      portalRecords: cleanedRecords,
      sourceSummary,
    });
    const matchedRecords = cleanedRecords.filter((record) => response.matchedRecordIds.includes(record.id)).slice(0, MAX_MATCHED_RESULTS);
    const fallbackMatchedRecords = matchedRecords.length ? matchedRecords : findMatchedRecords(cleanedRecords, query, portalRecord);

    return {
      mode: `live_ai_${getConfiguredAiProvider()}`,
      answer: response.answer || "AI agent did not return an answer.",
      matchedRecords: fallbackMatchedRecords.map(toRecordSummary),
      insights: portalRecord ? getTimelineFlags(portalRecord) : fallbackMatchedRecords.flatMap(getTimelineFlags).slice(0, 6),
      suggestions: response.suggestions?.length
        ? response.suggestions
        : portalRecord
          ? buildNextSteps(portalRecord)
          : fallbackMatchedRecords.slice(0, 4).map((record) => `Review ${getRecordLabel(record)}: ${getTimelineFlags(record)[0] || "Needs attention"}`),
    };
  } catch (error) {
    const suggestion = error?.aiStatus === "RESOURCE_EXHAUSTED" || error?.aiCode === "429"
      ? "Free AI limit reached. Wait a few seconds and try again, or use a fresh key/project."
      : "Check the AI key, model, or API URL configuration and try again.";

    return {
      mode: "ai_error",
      answer: error?.message || "AI agent request failed.",
      matchedRecords: [],
      insights: [],
      suggestions: [suggestion],
    };
  }
}

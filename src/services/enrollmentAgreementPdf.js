import { jsPDF } from "jspdf";
import { addMonthsPreservingDay, toIsoDate } from "../utils/dateMath.js";
import shieldIcon from "../assets/certisured-shield.svg";
import {
  inferPaymentPlan,
  normalizePaymentHistoryList,
  resolveAmountPaid,
  toNumberOrNull,
} from "../utils/paymentHelpers.js";

const COLORS = {
  navy: [11, 53, 88],
  green: [30, 207, 107],
  black: [17, 24, 39],
  text: [33, 33, 33],
  muted: [85, 85, 85],
};

const DEFAULT_COMPANY = {
  brand: "CERTISURED",
  companyName: "Analogica Software Development Pvt Ltd",
  address: "Bhashyam Circle, 3rd Block, Rajajinagar, Bangalore - 560010.",
  phone: "9606698866",
  email: "hello@certisured.com",
};

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function safeText(value, fallback = "N/A") {
  return hasValue(value) ? String(value).trim() : fallback;
}

function drawText(doc, text, x, y, options = {}) {
  const {
    font = "helvetica",
    style = "normal",
    size = 9,
    color = COLORS.text,
    align = "left",
    maxWidth = 0,
    maxLines = 1,
    lineHeight = 4.2,
  } = options;

  doc.setFont(font, style);
  doc.setFontSize(size);
  doc.setTextColor(...color);

  const content = safeText(text, "");
  const lines = maxWidth > 0
    ? doc.splitTextToSize(content, maxWidth).slice(0, maxLines).map((line) => String(line))
    : [content];

  lines.forEach((line, index) => {
    doc.text(line, x, y + (index * lineHeight), { align, baseline: "top" });
  });

  return lines.length;
}

function drawLine(doc, x1, y1, x2, y2, width = 0.22, color = COLORS.black) {
  doc.setDrawColor(...color);
  doc.setLineWidth(width);
  doc.line(x1, y1, x2, y2);
}

async function loadImageDataUrl(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || 128;
      canvas.height = image.naturalHeight || 128;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Unable to render logo image."));
        return;
      }
      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("Unable to load logo image."));
    image.src = src;
  });
}

async function drawShieldLogo(doc, x, y, size) {
  const imageDataUrl = await loadImageDataUrl(shieldIcon);
  doc.addImage(imageDataUrl, "PNG", x, y, size, size);
}

function resolveCompanyDetails(payload = {}) {
  const details = payload.companyDetails || {};
  return {
    brand: safeText(details.brand || details.name || payload.instituteName || DEFAULT_COMPANY.brand, DEFAULT_COMPANY.brand),
    companyName: safeText(details.companyName || DEFAULT_COMPANY.companyName, DEFAULT_COMPANY.companyName),
    address: safeText(details.address || DEFAULT_COMPANY.address, DEFAULT_COMPANY.address),
    phone: safeText(details.phone || DEFAULT_COMPANY.phone, DEFAULT_COMPANY.phone),
    email: safeText(details.email || DEFAULT_COMPANY.email, DEFAULT_COMPANY.email),
  };
}

function formatAmount(value, decimals = 0) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return decimals > 0 ? "0.00" : "0";
  return decimals > 0 ? amount.toFixed(decimals) : String(Math.round(amount));
}

function formatDuration(value) {
  const content = safeText(value);
  if (/month/i.test(content)) return content;
  const match = content.match(/^(\d+)/);
  return match ? `${match[1]} Months` : content;
}

function formatDisplayDate(value) {
  return toIsoDate(value) || "N/A";
}

function formatInstallmentDate(value) {
  const iso = toIsoDate(value);
  if (!iso) return "N/A";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function resolveStudentId(student = {}, enrollment = {}) {
  return safeText(
    student.student_code
      || student.student_id
      || student.studentId
      || enrollment.student_code
      || enrollment.student_id
      || student.id,
  );
}

function splitAmountEvenly(totalAmount, parts) {
  const safeParts = Math.max(Number(parts) || 1, 1);
  const totalCents = Math.round((Number(totalAmount || 0) || 0) * 100);
  const baseCents = Math.floor(totalCents / safeParts);
  const remainder = totalCents - (baseCents * safeParts);

  return Array.from({ length: safeParts }, (_, index) => ((baseCents + (index < remainder ? 1 : 0)) / 100));
}

function normalizeAddress(student = {}) {
  const parts = [student.address, student.place]
    .flatMap((value) => String(value || "").split(/\r?\n/))
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set(parts)].join(", ");
}

function buildInstallmentRows(enrollment, courseFee, amountPaid) {
  const paymentPlan = inferPaymentPlan({
    paymentPlan: enrollment.payment_plan || "",
    installmentsPlanned: enrollment.installments_planned || 0,
    history: enrollment.payment_history,
    amountPaid,
  });

  if (paymentPlan !== "EMI") {
    const anchorDate = enrollment.enrolled_date || enrollment.lead_date || enrollment.created_at || toIsoDate(new Date());
    return [{
      installment: 1,
      dueDate: anchorDate,
      amount: Number(courseFee || 0),
    }];
  }

  const emiCount = paymentPlan === "EMI"
    ? Math.max(Number(enrollment.installments_planned) || 1, 1)
    : 1;
  const remainingAmount = Math.max((Number(courseFee || 0) || 0) - (Number(amountPaid || 0) || 0), 0);
  const rowAmounts = splitAmountEvenly(
    remainingAmount > 0
      ? remainingAmount
      : (toNumberOrNull(enrollment.installment_amount) || 0) * emiCount,
    emiCount,
  );
  const paymentHistory = normalizePaymentHistoryList(enrollment.payment_history, {
    totalFee: courseFee,
    paymentPlan,
    paymentMethod: enrollment.payment_method || "",
    installmentsPlanned: enrollment.installments_planned || 0,
    amountPaid,
  });
  const latestPaidDate = paymentHistory[0]?.date || enrollment.last_payment_date || "";
  const anchorDate = enrollment.next_due_date
    || addMonthsPreservingDay(latestPaidDate || enrollment.enrolled_date || enrollment.lead_date || enrollment.created_at || toIsoDate(new Date()), latestPaidDate ? 0 : 1);

  return Array.from({ length: emiCount }, (_, index) => {
    return {
      installment: index + 1,
      dueDate: index === 0 ? anchorDate : addMonthsPreservingDay(anchorDate, index),
      amount: Number(rowAmounts[index] || 0),
    };
  });
}

function drawField(doc, label, value, y, options = {}) {
  const {
    labelX = 12,
    colonX = 60,
    valueX = 65,
    valueWidth = 112,
    maxLines = 1,
    lineHeight = 5.3,
    labelWidth = 44,
    valueSize = 9,
  } = options;

  drawText(doc, label, labelX, y, {
    size: 9,
    color: COLORS.black,
    lineHeight,
    maxWidth: labelWidth,
    maxLines: 2,
  });
  drawText(doc, ":", colonX, y, {
    size: 9,
    color: COLORS.black,
    lineHeight,
  });

  const lineCount = drawText(doc, value, valueX, y, {
    size: valueSize,
    color: COLORS.black,
    maxWidth: valueWidth,
    maxLines,
    lineHeight,
  });

  return y + Math.max(lineCount, 1) * lineHeight + 3;
}

export async function buildEnrollmentPdfDocument(payload) {
  const { student = {}, course = {}, enrollment = {} } = payload || {};
  const company = resolveCompanyDetails(payload);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const courseFee = toNumberOrNull(enrollment.total_fee) ?? toNumberOrNull(course?.fee) ?? 0;
  const amountPaid = resolveAmountPaid(enrollment.amount_paid, enrollment.payment_history);
  const paymentPlan = inferPaymentPlan({
    paymentPlan: enrollment.payment_plan || "",
    installmentsPlanned: enrollment.installments_planned || 0,
    history: enrollment.payment_history,
    amountPaid,
  });
  const installmentRows = buildInstallmentRows(enrollment, courseFee, amountPaid);
  const emiCount = Math.max(Number(enrollment.installments_planned) || installmentRows.length || 1, 1);
  const monthlyInstallmentAmount = paymentPlan === "EMI"
    ? Number(installmentRows[0]?.amount || toNumberOrNull(enrollment.installment_amount) || 0)
    : Number(courseFee || 0);
  const courseName = safeText(course?.course_name || enrollment.course_name);
  const startDate = enrollment.enrolled_date || enrollment.lead_date || enrollment.created_at || "";
  const duration = formatDuration(course?.duration || enrollment.duration || "N/A");

  doc.setProperties({
    title: "Student Enrollment Form",
    subject: "CERTISURED Enrollment Form",
    author: "EnrollEase AI",
    creator: "EnrollEase AI",
  });

  await drawShieldLogo(doc, 7.5, 10, 19);

  drawText(doc, company.brand, 105, 8.5, {
    font: "times",
    style: "bold",
    size: 18,
    color: COLORS.black,
    align: "center",
  });
  drawText(doc, company.companyName, 105, 17.5, {
    style: "bold",
    size: 10.5,
    color: COLORS.black,
    align: "center",
  });
  drawText(doc, company.address, 105, 24.2, {
    size: 7.6,
    color: COLORS.black,
    align: "center",
  });
  drawText(doc, `Ph: ${company.phone} Email: ${company.email}`, 105, 31, {
    size: 7.4,
    color: COLORS.black,
    align: "center",
  });
  drawLine(doc, 62, 35.4, 148, 35.4, 0.18, COLORS.muted);

  drawText(doc, "STUDENT ENROLLMENT FORM WITH TERMS AND CONDITIONS", 105, 42, {
    style: "bold",
    size: 10.2,
    color: COLORS.black,
    align: "center",
  });

  let y = 56;
  const studentId = resolveStudentId(student, enrollment);
  y = drawField(doc, "Name", safeText(student.full_name), y, {
    labelX: 12,
    colonX: 34,
    valueX: 40,
    valueWidth: 88,
    labelWidth: 18,
  });
  y = drawField(doc, "Student ID", studentId, y, {
    labelX: 12,
    colonX: 34,
    valueX: 40,
    valueWidth: 140,
    labelWidth: 18,
    valueSize: studentId.length > 24 ? 7.2 : 8.6,
    maxLines: 2,
  });

  y += 4;
  y = drawField(doc, "Phone", student.phone, y);
  y = drawField(doc, "Address", normalizeAddress(student), y, { maxLines: 3 });
  y = drawField(doc, "Course Name", courseName, y, { maxLines: 2 });
  y = drawField(doc, "Start Date", formatDisplayDate(startDate), y);
  y = drawField(doc, "Duration", duration, y);
  y = drawField(doc, "Course Fees", formatAmount(courseFee), y);
  y = drawField(doc, "Number of EMI", String(emiCount), y);
  y = drawField(doc, "Monthly Installment Amount", formatAmount(monthlyInstallmentAmount), y, {
    colonX: 60,
    valueX: 65,
    valueWidth: 34,
    labelWidth: 44,
  });

  y += 5;
  drawText(doc, "Installment Details:", 12, y, {
    style: "bold",
    size: 9.2,
    color: COLORS.black,
  });

  installmentRows.forEach((row, index) => {
    y += 6.4;
    drawText(doc, `${row.installment}. ${formatInstallmentDate(row.dueDate)} : ${formatAmount(row.amount, 2)}`, 12, y, {
      size: 8.7,
      color: COLORS.black,
    });
  });

  y += 14;
  drawText(doc, "Placement Eligibility:", 12, y, {
    style: "bold",
    size: 9.2,
    color: COLORS.black,
  });

  [
    "80% of classes must be attended.",
    "80% of assignments must be submitted.",
    "Weekly feedback must be completed.",
    "Fee confidentiality must be maintained.",
  ].forEach((item) => {
    y += 6.2;
    drawText(doc, "\u2022", 12, y, { size: 9, color: COLORS.black });
    drawText(doc, item, 17, y, { size: 8.6, color: COLORS.black });
  });

  y += 14;
  drawText(doc, "Required Document:", 12, y, {
    style: "bold",
    size: 9.2,
    color: COLORS.black,
  });
  y += 6.2;
  drawText(doc, "* Aadhaar card copy must be submitted.", 12, y, {
    size: 8.7,
    color: COLORS.black,
  });

  drawText(doc, "Signature", 12, 258, {
    size: 8.7,
    color: COLORS.black,
  });
  drawText(doc, "Seal", 165, 258, {
    size: 8.7,
    color: COLORS.black,
  });

  return doc;
}

export async function generateEnrollmentPdf(payload) {
  const doc = await buildEnrollmentPdfDocument(payload);
  return doc.output("bloburl");
}

export async function openEnrollmentPdf(payload) {
  const url = await generateEnrollmentPdf(payload);
  window.open(url, "_blank", "noopener,noreferrer");
}

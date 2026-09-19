import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { addMonthsPreservingDay, toIsoDate } from "../src/utils/dateMath.js";
import { getEnrollmentTimelineValidationErrors, shouldAutoDropoutEnquiry, getInitialEnquiryFollowUpDate, getFinalEnquiryFollowUpDate } from "../src/utils/enrollmentDateValidation.js";
import { resolveDiscountAmount, resolvePayableFee, resolveInstallmentProgress } from "../src/utils/paymentHelpers.js";
import { getNextStudentCode } from "../src/utils/studentCode.js";

test("calendar validation rejects impossible dates and preserves leap years/month ends", () => {
  for (const date of ["2026-02-30", "2026-13-01", "31/04/2026", "2026-00-01"]) assert.equal(toIsoDate(date), "");
  assert.equal(toIsoDate("29/02/2024"), "2024-02-29");
  assert.equal(addMonthsPreservingDay("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonthsPreservingDay("2024-01-31", 1), "2024-02-29");
});

test("timeline checks reject future enrollment and payments before enrollment", () => {
  const errors = getEnrollmentTimelineValidationErrors({ leadDate: "2026-09-01", enrolledDate: "2026-09-13", lastPaymentDate: "2026-08-31", today: "2026-09-12", pipelineStage: "Enrolled" });
  assert.ok(errors.enrolled_date);
  assert.ok(errors.last_payment_date);
  assert.ok(getEnrollmentTimelineValidationErrors({ lastPaymentDate: "2026-02-30" }).last_payment_date);
});

test("follow-ups occur at day three/six and dropout applies only to enquiries on day seven", () => {
  assert.equal(getInitialEnquiryFollowUpDate("2026-09-01"), "2026-09-04");
  assert.equal(getFinalEnquiryFollowUpDate("2026-09-01"), "2026-09-07");
  assert.equal(shouldAutoDropoutEnquiry({ pipelineStage: "Enquiry", leadDate: "2026-09-01", today: "2026-09-07" }), false);
  assert.equal(shouldAutoDropoutEnquiry({ pipelineStage: "Enquiry", leadDate: "2026-09-01", today: "2026-09-08" }), true);
  assert.equal(shouldAutoDropoutEnquiry({ pipelineStage: "Enrolled", leadDate: "2026-09-01", today: "2026-09-08" }), false);
});

test("discounts cannot make a negative payable balance", () => {
  assert.equal(resolveDiscountAmount(52000, "Percentage", 10), 5200);
  assert.equal(resolvePayableFee(52000, "Amount", 2000), 50000);
  assert.equal(resolvePayableFee(52000, "Percentage", 120), 0);
  assert.equal(resolvePayableFee(52000, "Amount", -1), 52000);
});

test("initial payment counts as one and one-time partial payments extend to EMI", () => {
  const progress = resolveInstallmentProgress({ total_fee: 52000, amount_paid: 15000, installments_paid: 0, installments_planned: 1, payment_plan: "One Time" });
  assert.equal(progress.installmentsPaid, 1);
  assert.equal(progress.installmentsPlanned, 2);
  assert.equal(progress.paymentPlan, "EMI");
});

test("student code generation increments the highest numeric suffix", () => {
  const code = getNextStudentCode(["STU008", "STU010", "STU009"]);
  assert.match(code, /^STU0*11$/);
});

test("CSV import preserves quoted commas, multiline notes, and escaped quotes", () => {
  const source = readFileSync(new URL("../src/utils/fileHelpers.js", import.meta.url), "utf8");
  const start = source.indexOf("export function parseCsv(");
  const end = source.indexOf("export function downloadTextFile", start);
  const parseCsv = vm.runInNewContext(source.slice(start, end).replace("export ", "") + "\nparseCsv;");
  const rows = parseCsv('name,notes\r\n"Doe, Jane","Line one\nLine ""two"""\r\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Doe, Jane");
  assert.equal(rows[0].notes, 'Line one\nLine "two"');
});

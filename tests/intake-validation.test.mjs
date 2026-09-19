import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { resolveInstallmentProgress, resolveNextDueDate } from "../src/utils/paymentHelpers.js";
import { toIsoDate } from "../src/utils/dateMath.js";
import { getEnrollmentTimelineValidationMessage } from "../src/utils/enrollmentDateValidation.js";
const source = readFileSync(new URL("../supabase/functions/student-intake/index.ts", import.meta.url), "utf8");
const helpers = source.slice(0, source.indexOf("Deno.serve(")).replace(/^import .*;\r?\n/gm, "");
const verifySchema = vm.runInNewContext(stripTypeScriptTypes(`${helpers}\nverifySubmissionSchema;`), { console: { error() {} } });

test("submission schema preflight checks actual payload keys without reading or writing records", async () => {
  const checks = [];
  const client = { from(table) { return { select(columns) { return { async limit(count) {
    assert.equal(count, 0);
    checks.push({ table, columns });
    return { error: null };
  } }; } }; } };
  await verifySchema(client, { enrollments: { original_fee: 100, discount_amount: 10 }, documents: { file_url: "test" } });
  assert.deepEqual(checks, [{ table: "enrollments", columns: "original_fee,discount_amount" }, { table: "documents", columns: "file_url" }]);
});

test("missing schema fields stop submission before student or enrollment writes", async () => {
  const client = { from() { return { select() { return { async limit() {
    return { error: { code: "PGRST204", message: "Missing discount_amount" } };
  } }; } }; } };
  await assert.rejects(verifySchema(client, { enrollments: { discount_amount: 10 } }), /Your form has not been submitted/);
  const preflight = source.indexOf("      await verifySubmissionSchema(");
  assert.ok(preflight < source.indexOf("      const { data: savedSubmission, error: submissionError }"));
  assert.ok(source.includes('adminClient.rpc("complete_student_intake"'));
});
const start = source.indexOf("      const indiaToday =");
const end = source.indexOf("      const nextStudentPayload", start);
assert.ok(start > 0 && end > start);
function validate(patch) {
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : ["2026-09-12T12:00:00Z"])); } }
  return vm.runInNewContext(stripTypeScriptTypes(`${helpers}\n(() => { ${source.slice(start, end)} return { paymentStatus, installmentsPaid, installmentsPlanned, paymentPlan, nextDueDate }; })()`), {
    Date: Clock, Intl, Response, enrollment: {}, enrollmentPatch: { batch: "Morning", lead_date: "2026-09-01", enrolled_date: "2026-09-12",
      payment_plan: "EMI", payment_method: "UPI", total_fee: 52000, amount_paid: 52000, installments_planned: 2, last_payment_date: "2026-09-12", ...patch },
    resolveInstallmentProgress, scheduledDueDate: resolveNextDueDate, strictIsoDate: toIsoDate, getEnrollmentTimelineValidationMessage,
  });
}
test("fully settled intake does not require another EMI due date", () => {
  const result = validate({});
  assert.equal(result.paymentStatus, "Paid");
  assert.equal(result.nextDueDate, "");
  assert.equal(result.installmentsPaid, 1);
});
test("partial one-time intake becomes a two-payment plan with a due date", () => {
  const result = validate({ payment_plan: "One Time", installments_planned: 1, amount_paid: 15000 });
  assert.equal(result.paymentPlan, "EMI");
  assert.equal(result.installmentsPlanned, 2);
  assert.equal(result.nextDueDate, "2026-10-12");
});
test("intake rejects invalid money, dates, installment counts, and methods", () => {
  for (const patch of [{ amount_paid: -1 }, { amount_paid: "bad" }, { amount_paid: 1.001 }, { amount_paid: 52001 },
    { enrolled_date: "2026-02-30" }, { enrolled_date: "2026-09-13" }, { installments_planned: -2 }, { installments_planned: 1.5 }, { payment_method: "invalid" }]) {
    assert.equal(validate(patch).status, 400, JSON.stringify(patch));
  }
});

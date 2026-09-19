import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import * as helpers from "../src/utils/paymentHelpers.js";
import { toIsoDate } from "../src/utils/dateMath.js";

const source = readFileSync(new URL("../src/context/AppContext.jsx", import.meta.url), "utf8");
const builder = source.slice(source.indexOf("function buildRecordedPaymentState("), source.indexOf("function normalizeDocumentRecord("));
const action = source.slice(source.indexOf("  const markInstallmentPaid = async"), source.indexOf("  const importStudentsFromCsv = async"));
function enrollment() {
  return { id: "enrollment-1", total_fee: 52000, amount_paid: 15000, payment_plan: "EMI", payment_method: "UPI",
    installments_planned: 3, installments_paid: 1, installment_amount: 18500, enrolled_date: "2026-08-12",
    last_payment_date: "2026-08-12", payment_history: [helpers.buildPaymentHistoryEntry({ entryId: "first", amount: 15000,
      amountPaidAfter: 15000, totalFee: 52000, paymentPlan: "EMI", paymentDate: "2026-08-12", installmentNumber: 1, installmentsPlanned: 3 })] };
}
function harness(remote = false, stale = false, writeError = null) {
  const writes = [], receipts = [];
  const state = { enrollments: [enrollment()], authUser: {} };
  const context = vm.createContext({ ...helpers, toIsoDate, Date, state,
    getTodayIsoDate: () => "2026-09-12", createId: () => "second",
    normalizePaymentStatus: (fee, paid) => paid >= fee ? "Paid" : paid > 0 ? "Partial" : "Pending",
    hasSupabaseEnv: remote,
    supabase: { from() { let payload; const query = {
      update(value) { payload = value; return query; },
      eq(key, value) { writes.push({ key, value }); return query; },
      select() { return query; },
      async single() { return { data: structuredClone(state.enrollments[0]) }; },
      async maybeSingle() { writes.push({ payload }); return { data: stale ? null : { ...state.enrollments[0], ...payload }, error: writeError }; },
    }; return query; } },
    setState: (updater) => Object.assign(state, updater(state)),
    commitLocalDb: (updater) => updater(state), refreshState: async () => {}, pushNotification: () => {},
    formatEnrollmentAccessError: (error) => error, sendPaymentEmail: async (...args) => receipts.push(args),
  });
  vm.runInContext(`${builder}\n${action}\nthis.build = buildRecordedPaymentState; this.save = markInstallmentPaid;`, context);
  return { build: context.build, save: context.save, state, writes, receipts };
}
const details = { amount: "15000", paymentDate: "2026-09-12", nextDueDate: "2026-10-12" };

test("second payment adds the actual received amount and preserves first payment history", () => {
  const h = harness();
  const current = enrollment();
  const result = h.build(current, "Cash", details);
  assert.equal(result.amount_paid, 30000);
  assert.equal(result.installments_paid, 2);
  assert.equal(result.payment_history.length, 2);
  assert.equal(result.payment_history[0].paid_amount, 15000);
  assert.equal(result.payment_history[0].pending_amount, 22000);
  assert.equal(result.payment_history[0].date, "2026-09-12");
  assert.ok(result.payment_history[0].recorded_at);
  assert.equal(result.payment_history[1].id, "first");
  assert.equal(current.amount_paid, 15000);
  assert.equal(result.next_due_date, "2026-10-12");
});

test("final payment clears next due date and marks the balance paid", () => {
  const result = harness().build(enrollment(), "UPI", { ...details, amount: 37000 });
  assert.equal(result.amount_paid, 52000);
  assert.equal(result.payment_status, "Paid");
  assert.equal(result.next_due_date, "");
});

test("invalid amounts, future or out-of-order dates, and invalid next due dates are rejected", () => {
  const h = harness();
  for (const amount of [0, -1, 37001, "bad", 1.001, ""]) {
    assert.throws(() => h.build(enrollment(), "UPI", { ...details, amount }));
  }
  for (const paymentDate of ["2026-09-13", "2026-08-11", "2026-02-30", ""]) {
    assert.throws(() => h.build(enrollment(), "UPI", { ...details, paymentDate }));
  }
  assert.throws(() => h.build(enrollment(), "UPI", { ...details, nextDueDate: details.paymentDate }));
  assert.throws(() => h.build(enrollment(), "Pending", details));
});

test("local payment persists summary and history without sending an unrequested email", async () => {
  const h = harness();
  await h.save("enrollment-1", "UPI", details);
  assert.equal(h.state.enrollments[0].amount_paid, 30000);
  assert.equal(h.state.enrollments[0].payment_history.length, 2);
  assert.equal(h.receipts.length, 0);
});

test("remote save guards the old balance and stores history with the summary", async () => {
  const h = harness(true);
  await h.save("enrollment-1", "UPI", { ...details, amount: 37000 });
  assert.ok(h.writes.some((item) => item.key === "amount_paid" && item.value === 15000));
  const { payload } = h.writes.find((item) => item.payload);
  assert.equal(payload.next_due_date, null);
  assert.equal(payload.payment_history.length, 2);
  assert.equal(h.state.enrollments[0].amount_paid, 52000);
});

test("stale or failed remote writes cannot report payment success", async () => {
  const stale = harness(true, true);
  await assert.rejects(stale.save("enrollment-1", "UPI", details), /changed/);
  assert.equal(stale.state.enrollments[0].amount_paid, 15000);
  const failed = harness(true, false, new Error("write failed"));
  await assert.rejects(failed.save("enrollment-1", "UPI", details), /write failed/);
  assert.equal(failed.state.enrollments[0].amount_paid, 15000);
});

test("two planned installments extend repeatedly until the actual balance clears", () => {
  const h = harness();
  let current = { ...enrollment(), installments_planned: 2 };
  const originalFirstPayment = structuredClone(current.payment_history[0]);
  current = { ...current, ...h.build(current, "UPI", { ...details, amount: 20000 }) };
  assert.equal(current.amount_paid, 35000);
  assert.equal(current.installments_paid, 2);
  assert.equal(current.installments_planned, 3);
  assert.equal(current.installment_amount, 17000);
  assert.equal(current.payment_status, "Partial");
  assert.equal(current.payment_history[0].installments_planned, 3);
  assert.equal(current.payment_history[0].label, "Installment 2");
  assert.equal(current.payment_history[1].paid_amount, originalFirstPayment.paid_amount);
  current = { ...current, ...h.build(current, "UPI", { ...details, amount: 10000 }) };
  assert.equal(current.installments_paid, 3);
  assert.equal(current.installments_planned, 4);
  assert.equal(current.installment_amount, 7000);
  current = { ...current, ...h.build(current, "UPI", { ...details, amount: 7000 }) };
  assert.equal(current.installments_paid, 4);
  assert.equal(current.installments_planned, 4);
  assert.equal(current.installment_amount, 0);
  assert.equal(current.next_due_date, "");
  assert.equal(current.payment_status, "Paid");
});

test("one-payment plans automatically become EMI when more payments are needed", () => {
  const current = { ...enrollment(), payment_plan: "One Time", installments_planned: 1 };
  const initial = helpers.resolveInstallmentProgress(current);
  assert.equal(initial.paymentPlan, "EMI");
  assert.equal(initial.installmentsPlanned, 2);
  const result = harness().build(current, "Cash", details);
  assert.equal(result.payment_plan, "EMI");
  assert.equal(result.installments_paid, 2);
  assert.equal(result.installments_planned, 3);
  assert.equal(result.next_due_date, "2026-10-12");
});

test("existing saved history corrects a stale count without recording another payment", () => {
  const current = { ...enrollment(), amount_paid: 35000, installments_paid: 1, installments_planned: 2 };
  current.payment_history.push(helpers.buildPaymentHistoryEntry({ amount: 20000, amountPaidAfter: 35000,
    totalFee: 52000, paymentPlan: "EMI", installmentNumber: 2, installmentsPlanned: 2, paymentDate: "2026-09-12" }));
  const progress = helpers.resolveInstallmentProgress(current);
  assert.equal(progress.installmentsPaid, 2);
  assert.equal(progress.installmentsPlanned, 3);
  assert.equal(progress.installmentAmount, 17000);
  assert.equal(current.payment_history.length, 2);
});

test("early settlement completes the actual count and future planned payments do not remain", () => {
  const result = harness().build(enrollment(), "UPI", { ...details, amount: 37000 });
  assert.equal(result.installments_paid, 2);
  assert.equal(result.installments_planned, 2);
});

test("remote save persists the extended plan with amounts and history", async () => {
  const h = harness(true);
  h.state.enrollments[0].installments_planned = 2;
  await h.save("enrollment-1", "UPI", { ...details, amount: 20000 });
  const { payload } = h.writes.find((item) => item.payload);
  assert.equal(payload.installments_paid, 2);
  assert.equal(payload.installments_planned, 3);
  assert.equal(payload.installment_amount, 17000);
  assert.equal(payload.payment_plan, "EMI");
  assert.equal(payload.payment_history.length, 2);
});


test("successful remote payment automatically requests a receipt with actual amount and new due date", async () => {
  const h = harness(true);
  await h.save("enrollment-1", "UPI", details);
  assert.equal(h.receipts.length, 1);
  assert.equal(h.receipts[0][1].paidAmount, 15000);
  assert.equal(h.receipts[0][1].enrollment.next_due_date, "2026-10-12");
});

import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/services/aiCopilotService.js", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, "")
  .replace(/^export /gm, "");

const { buildAdmissionsActionPlan, getAdmissionsUrgency } = vm.runInNewContext(
  `${source}\n({ buildAdmissionsActionPlan, getAdmissionsUrgency });`,
  {
    Date,
    Intl,
    Math,
    Number,
    String,
    Array,
    Set,
    JSON,
    Promise,
    formatCurrency: (value) => `₹${value}`,
    formatDate: (value) => value,
    normalizeBatchName: (value) => value,
    isHiddenDropoutStudent: () => false,
    resolveAmountPaid: (value) => value,
    resolveRemainingAmount: (total, paid) => Number(total || 0) - Number(paid || 0),
    supabase: null,
  },
);

function isoDateFromToday(offset) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function paymentRecord({ name, dueOffset, amountPaid = 0 }) {
  return {
    id: name.toLowerCase(),
    currentStage: "Enrolled",
    isEnrolledRecord: true,
    paymentEligible: true,
    student: { full_name: name },
    enrollment: {
      id: `${name.toLowerCase()}-enrollment`,
      payment_status: "Pending",
      total_fee: 10000,
      amount_paid: amountPaid,
      next_due_date: isoDateFromToday(dueOffset),
    },
  };
}

test("an unpaid past due date is high risk even when payment status remains Pending", () => {
  const record = paymentRecord({ name: "Chandana", dueOffset: -9 });

  assert.equal(getAdmissionsUrgency(record).level, "high");
  const action = buildAdmissionsActionPlan([record]).actions[0];
  assert.equal(action.urgencyLevel, "high");
  assert.match(action.reason, /overdue by 9 days/i);
});

test("an unpaid payment due within seven days is prioritized ahead of later payments", () => {
  const dhananjaya = paymentRecord({ name: "Dhananjaya", dueOffset: 3 });
  const laterPayment = paymentRecord({ name: "Later payment", dueOffset: 20 });
  const actions = buildAdmissionsActionPlan([laterPayment, dhananjaya]).actions;

  assert.equal(actions[0].studentName, "Dhananjaya");
  assert.equal(actions[0].urgencyLevel, "high");
  assert.equal(actions[1].studentName, "Later payment");
});

test("the action agent keeps valid lower-priority payment actions visible", () => {
  const records = Array.from({ length: 9 }, (_, index) => paymentRecord({
    name: `Student ${index + 1}`,
    dueOffset: 20 + index,
  }));

  assert.equal(buildAdmissionsActionPlan(records).actions.length, 9);
});

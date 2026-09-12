import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { getEmiReminderWindow, resolveRemainingAmount } from "../src/utils/paymentHelpers.js";
import { toIsoDate } from "../src/utils/dateMath.js";

// Exercise the real provider's selection, automatic caller and send function
// with an in-memory email transport; no student emails are sent by these tests.
const source = readFileSync(new URL("../src/context/AppContext.jsx", import.meta.url), "utf8");
function section(start, end) {
  const first = source.indexOf(start);
  assert.ok(first >= 0, `Missing source section: ${start}`);
  const last = source.indexOf(end, first);
  assert.ok(last > first, `Missing source boundary: ${end}`);
  return source.slice(first, last);
}

function harness(today = "2026-09-12") {
  const storage = new Map();
  const sent = [];
  const state = { enrollments: [], students: [], courses: [], emailLogs: [] };
  const sandbox = {
    state, toIsoDate, getEmiReminderWindow, resolveRemainingAmount,
    getTodayIsoDate: () => today,
    formatDate: (value) => value,
    findRelatedCoursesForEnrollment: () => [],
    pushNotification: () => {},
    refreshState: async () => {},
    window: { localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    } },
    autoEmailTracker: { current: { paymentReminder: new Set() } },
    todayIsoDate: today,
    portalRecords: [],
    sendPaymentStatusEmail: async (payload) => {
      sent.push(payload);
      return { ok: true, status: "Sent", logged: false };
    },
    tryPersistEmailLog: async (log) => {
      state.emailLogs.push(log);
      return { persisted: true };
    },
  };
  const context = vm.createContext(sandbox);
  vm.runInContext([
    source.match(/const PAYMENT_REMINDER_LOCK_KEY = .*;/)[0],
    section("function readPaymentReminderLocks()", "function hasLinkedPortalRecords("),
    section("function normalizeEmailLogType(", "function getRequiredEnquiryFollowUpCycles("),
    section("function hasSuccessfulEmailOnDate(", "function hasEmailLogOnDate("),
    section("  const sendPaymentEmail = async", "  const sendDashboardFollowUpEmail = async"),
  ].join("\n"), context);
  const selection = section("    const duePaymentReminders = portalRecords.filter", "    if (!dueFollowUps.length");
  const loop = section("      for (const record of duePaymentReminders)", "    })();");
  return {
    state, sandbox, storage, sent,
    add(id, enrolledDate, extra = {}) {
      const enrollment = {
        id, student_id: id, enrolled_date: enrolledDate, total_fee: 52000,
        amount_paid: 15000, payment_status: "Partial", ...extra,
      };
      const student = { id, email: `${id}@example.com` };
      state.enrollments.push(enrollment);
      state.students.push(student);
      sandbox.portalRecords.push({ enrollment, student, currentStage: "Enrolled" });
    },
    run: () => vm.runInContext(`(async () => { ${selection}\n${loop} })()`, context),
    manual: (id) => vm.runInContext(`sendPaymentEmail(${JSON.stringify(id)}, {emailVariant: "due_reminder", silent: true})`, context),
  };
}

test("automatic reminder sends today, skips tomorrow until due, and does not duplicate", async () => {
  const h = harness();
  h.add("today", "2026-08-12");
  h.add("tomorrow", "2026-08-13");
  await h.run();
  assert.deepEqual(h.sent.map((mail) => mail.enrollment.id), ["today"]);
  await h.run();
  await h.manual("today");
  assert.equal(h.sent.length, 1);
});

test("September 13 reminder sends on September 13", async () => {
  const h = harness("2026-09-13");
  h.add("tomorrow", "2026-08-13");
  await h.run();
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].paymentDate, "2026-09-13");
});

test("old false locks do not prevent today's reminder", async () => {
  const h = harness();
  h.add("today", "2026-08-12");
  h.storage.set("enrollease-payment-reminder-locks-v1", JSON.stringify({ "today:2026-09-12": true }));
  await h.run();
  assert.equal(h.sent.length, 1);
});

test("failed delivery logs allow retry, successful logs prevent duplicates", async () => {
  for (const status of ["Failed", "Sent"]) {
    const h = harness();
    h.add("today", "2026-08-12");
    h.state.emailLogs.push({ enrollment_id: "today", email_type: "EMI Due Reminder", status, sent_at: "2026-09-12T09:00:00+05:30" });
    await h.run();
    assert.equal(h.sent.length, status === "Failed" ? 1 : 0);
  }
});

test("failed and thrown sends release locks and retry on the next automatic check", async () => {
  for (const throws of [false, true]) {
    const h = harness();
    h.add("today", "2026-08-12");
    const deliver = h.sandbox.sendPaymentStatusEmail;
    h.sandbox.sendPaymentStatusEmail = async () => {
      if (throws) throw new Error("Transport unavailable");
      return { ok: false, message: "Transport unavailable" };
    };
    await h.run();
    h.sandbox.sendPaymentStatusEmail = deliver;
    await h.run();
    assert.equal(h.sent.length, 1);
  }
});

test("fully paid enrollments do not receive automatic reminders", async () => {
  const h = harness();
  h.add("paid", "2026-08-12", { payment_status: "Paid", amount_paid: 52000 });
  await h.run();
  assert.equal(h.sent.length, 0);
});

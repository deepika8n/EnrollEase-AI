import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const source = stripTypeScriptTypes(readFileSync(new URL("../supabase/functions/_shared/lifecycleEmails.ts", import.meta.url), "utf8").replace(/^export /gm, "") + "\n" + readFileSync(new URL("../supabase/functions/automation-dispatch/index.ts", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, ""));

function server(now, logs = [], options = {}) {
  let handler;
  const sent = [];
  const writes = [];
  const enrollments = [
    { id: "today", student_id: "today", enrolled_date: "2026-08-12", last_payment_date: "2026-08-12", next_due_date: "2026-09-12" },
    { id: "tomorrow", student_id: "tomorrow", enrolled_date: "2026-08-13", last_payment_date: "2026-08-13", next_due_date: "2026-09-13" },
  ].map(e => ({ pipeline_stage: "Enrolled", total_fee: 52000, amount_paid: 15000, payment_status: "Partial", created_at: "2026-08-12T00:00:00Z", ...e }));
  const tables = {
    enrollments, email_logs: logs, courses: [],
    students: enrollments.map(e => ({ id: e.id, full_name: e.id, email: `${e.id}@example.com` })),
  };
  const client = { from(name) {
    const query = {
      select: () => query, order: () => query,
      then: (resolve) => Promise.resolve({ data: tables[name] }).then(resolve),
      insert: async (log) => { writes.push(log); return {}; },
      update: (patch) => { writes.push(patch); return query; },
      eq: () => query,
      lte: () => query, limit: () => query,
    };
    return query;
  } };
  class Clock extends Date {
    static now() { return new Date(now).valueOf(); }
    constructor(...args) { super(...(args.length ? args : [now])); }
  }
  vm.runInNewContext(source, {
    Date: Clock, Intl, Response, Request, URL, URLSearchParams, console, crypto: webcrypto, TextEncoder, btoa,
    createClient: () => client,
    getAdminNotificationEmail: () => "admin@example.com",
    sendEmail: async payload => { if (options.failSend) throw new Error("Mail provider unavailable"); sent.push(payload); },
    Deno: {
      env: { get: key => ({ AUTOMATION_NOTIFICATION_START_AT: options.cutoff || "1970-01-01T00:00:00Z", AUTOMATION_DISPATCH_SECRET: "test-secret", AUTOMATION_PAYMENT_REMINDERS_ONLY: options.all ? "false" : "true",
        AUTOMATION_PAYMENT_RECEIPTS_ENABLED: options.receipts ? "true" : "false", SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-service" })[key] },
      serve: callback => { handler = callback; },
    },
  });
  return { sent, writes, enrollments, async run(dryRun = true) {
    const response = await handler(new Request("https://example.com", { method: "POST",
      headers: { "x-automation-dispatch-secret": "test-secret", "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun, ...options.request }),
    }));
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    return result;
  } };
}

test("server dry run selects today's reminder without sending or writing", async () => {
  const h = server("2026-09-12T14:00:00Z");
  assert.deepEqual((await h.run()).dispatched, ["payment_reminder:today"]);
  assert.equal(h.sent.length, 0);
  assert.equal(h.writes.length, 0);
});

test("full automation sends each same-day payment and completion receipt without manual confirmation", async () => {
  const h = server("2026-09-12T14:00:00Z", [], { all: true });
  h.enrollments.splice(1);
  Object.assign(h.enrollments[0], { amount_paid: 52000, payment_status: "Paid", last_payment_date: "2026-09-12", payment_history: [
    { id: "first", date: "2026-09-12", amount: 15000, cumulative_paid: 15000, recorded_at: "2026-09-12T10:00:00Z" },
    { id: "second", date: "2026-09-12", amount: 37000, cumulative_paid: 52000, recorded_at: "2026-09-12T12:00:00Z" },
  ] });
  assert.equal((await h.run(false)).failures.length, 0);
  assert.deepEqual(h.sent.map((email) => email.subject), ["Payment Received - CERTISURED", "Payment Cleared - CERTISURED"]);
  assert.ok(h.sent[1].text.includes("37,000"));
  assert.deepEqual(h.writes.map((log) => log.event_key), ["payment:today:first", "payment:today:second"]);
  assert.equal((await h.run(false)).dispatchedCount, 0);
});

test("legacy receipt from earlier today does not suppress a newly recorded payment", async () => {
  const h = server("2026-09-12T14:00:00Z", [{ enrollment_id: "today", email_type: "Payment Update", status: "Sent", sent_at: "2026-09-12T10:00:00Z" }], { all: true });
  h.enrollments.splice(1);
  Object.assign(h.enrollments[0], { last_payment_date: "2026-09-12", payment_history: [
    { id: "new", date: "2026-09-12", amount: 15000, cumulative_paid: 30000, recorded_at: "2026-09-12T12:00:00Z" },
  ] });
  assert.equal((await h.run(false)).dispatchedCount, 1);
  assert.equal(h.sent[0].subject, "Payment Received - CERTISURED");
});

test("full automation follows up eligible enquiries and never sends the two manual email types", async () => {
  const h = server("2026-09-12T14:00:00Z", [], { all: true });
  h.enrollments.splice(1);
  Object.assign(h.enrollments[0], { pipeline_stage: "Enquiry", lead_date: "2026-09-09", student_form_status: "Pending" });
  const result = await h.run(false);
  assert.equal(result.failures.length, 0);
  assert.equal(h.sent.length, 3);
  assert.ok(h.writes.some((log) => log.email_type === "Enquiry Acknowledgement"));
  assert.ok(h.writes.some((log) => log.email_type === "Admin New Enquiry Alert"));
  assert.ok(h.writes.some((log) => log.email_type === "Student Enrollment Form Follow-up 1"));
  assert.ok(h.writes.every((log) => !["Admission Confirmation", "Profile Send Mail"].includes(log.email_type)));
});

test("failed mail can retry and remains visible even when a failure was logged earlier today", async () => {
  const h = server("2026-09-12T14:00:00Z", [{ enrollment_id: "today", email_type: "EMI Due Reminder", status: "Failed", sent_at: "2026-09-12T10:00:00Z" }], { failSend: true });
  assert.equal((await h.run(false)).failures.length, 1);
  assert.equal((await h.run(false)).failures.length, 1);
});

test("server sends and records the due reminder through the real dispatch builder", async () => {
  const h = server("2026-09-12T14:00:00Z");
  assert.equal((await h.run(false)).failures.length, 0);
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].to, "today@example.com");
  assert.equal(h.writes[0].status, "Sent");
});

test("tomorrow is evaluated in India time and an already sent midnight email is skipped", async () => {
  const h = server("2026-09-12T19:00:00Z", [
    { enrollment_id: "today", email_type: "EMI Due Reminder", status: "Sent", sent_at: "2026-09-12T18:35:00Z" },
  ]);
  assert.deepEqual((await h.run()).dispatched, ["payment_reminder:tomorrow"]);
});

test("settled current cycle and fully paid records are skipped", async () => {
  const h = server("2026-09-12T14:00:00Z");
  h.enrollments[0].last_payment_date = "2026-09-12";
  assert.deepEqual((await h.run()).dispatched, []);
  h.enrollments[0].last_payment_date = "2026-08-12";
  h.enrollments[0].amount_paid = 52000;
  h.enrollments[0].payment_status = "Paid";
  assert.deepEqual((await h.run()).dispatched, []);
});


test("staged scheduler sends new payment receipt with next balance/date and skips historical opening balance", async () => {
  const h = server("2026-09-12T18:00:00Z", [], { receipts: true });
  h.enrollments.splice(1);
  Object.assign(h.enrollments[0], { amount_paid: 35000, last_payment_date: "2026-09-12", next_due_date: "2026-10-12", payment_history: [
    { id: "opening", date: "2026-08-12", amount: 15000, cumulative_paid: 15000 },
    { id: "second", date: "2026-09-12", recorded_at: "2026-09-12T16:11:00Z", amount: 20000, cumulative_paid: 35000 },
  ] });
  assert.deepEqual((await h.run(false)).dispatched, ["Payment Update:today"]);
  assert.equal(h.sent.length, 1);
  assert.match(h.sent[0].text, /20,000/);
  assert.match(h.sent[0].text, /17,000/);
  assert.match(h.sent[0].text, /12 Oct 2026/);
});

test("targeted receipt scope excludes other students and reminders", async () => {
  const h = server("2026-09-12T18:00:00Z", [], { request: { scope: "payment_receipts", enrollmentId: "today", paymentEntryId: "second" } });
  h.enrollments[0].payment_history = [{ id: "second", date: "2026-09-12", recorded_at: "2026-09-12T16:11:00Z", amount: 15000, cumulative_paid: 15000 }];
  assert.deepEqual((await h.run(false)).dispatched, ["Payment Update:today"]);
  assert.equal(h.sent.length, 1);
});


test("a sent newer receipt suppresses a stale opening-balance receipt", async () => {
  const h = server("2026-09-12T18:00:00Z", [{enrollment_id:"today",email_type:"Payment Update",status:"Sent",sent_at:"2026-09-12T17:00:00Z",event_key:"payment:today:second"}], { all: true });
  h.enrollments.splice(1);
  Object.assign(h.enrollments[0], { amount_paid:35000,last_payment_date:"2026-09-12",next_due_date:"2026-10-12",payment_history:[
    {id:"opening",date:"2026-08-12",amount:15000,cumulative_paid:15000},
    {id:"second",date:"2026-09-12",recorded_at:"2026-09-12T16:00:00Z",amount:20000,cumulative_paid:35000}
  ]});
  assert.deepEqual((await h.run()).dispatched, []);
});


test("rollout boundary suppresses old one-off notices but permits a new payment on an old enrollment", async () => {
  const h = server("2026-09-12T18:30:00Z", [], {all:true,cutoff:"2026-09-12T18:05:00Z"});
  h.enrollments.splice(1);
  Object.assign(h.enrollments[0], {amount_paid:35000,last_payment_date:"2026-09-12",next_due_date:"2026-10-12",payment_history:[
    {id:"opening",date:"2026-08-12",amount:15000,cumulative_paid:15000},
    {id:"new",date:"2026-09-12",recorded_at:"2026-09-12T18:10:00Z",amount:20000,cumulative_paid:35000}
  ]});
  await h.run(false);
  assert.equal(h.sent.length,1);
  assert.equal(h.writes[0].event_key,"payment:today:new");
  assert.match(h.sent[0].text,/20,000/);
});

test("old enquiry acknowledgements are not backfilled and new enquiries are still acknowledged", async () => {
  const h=server("2026-09-12T18:30:00Z",[],{all:true,cutoff:"2026-09-12T18:05:00Z"});
  h.enrollments.splice(1);
  Object.assign(h.enrollments[0],{pipeline_stage:"Enquiry",lead_date:"2026-09-12",created_at:"2026-09-12T17:00:00Z",amount_paid:0});
  assert.deepEqual((await h.run()).dispatched,[]);
  h.enrollments[0].created_at="2026-09-12T18:10:00Z";
  assert.equal((await h.run()).dispatched.length,2);
});

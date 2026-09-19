import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { stripTypeScriptTypes } from "node:module";
import { readFileSync } from "node:fs";
const code = stripTypeScriptTypes(readFileSync(new URL("../supabase/functions/_shared/durableEmail.ts", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, ""));
const api = vm.runInNewContext(`${code}\n({ deliverOnce, emailDeliveryKey });`, { crypto: webcrypto, TextEncoder, Date, Intl });

function database() {
  const rows = new Map();
  return { rows, async rpc(_, { p_key, p_payload }) {
    const row = rows.get(p_key);
    if (row && row.status !== "retry") return { data: row.status };
    rows.set(p_key, { payload: p_payload, status: "sending" });
    return { data: "claimed" };
  }, from() { return { update(patch) { return { async eq(_, key) { Object.assign(rows.get(key), patch); return {}; } }; } }; } };
}
const payload = { deliveryKey: "payment:test:second", to: "test@example.com", subject: "Payment received" };

test("simultaneous sends and later repeats deliver one email for the same payment", async () => {
  const admin = database();
  let sends = 0;
  const transport = async () => { sends++; return { id: "sent", provider: "test" }; };
  const results = await Promise.allSettled([api.deliverOnce(payload, transport, admin), api.deliverOnce(payload, transport, admin)]);
  assert.equal(sends, 1);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal((await api.deliverOnce(payload, transport, admin)).skipped, true);
  assert.equal(sends, 1);
});

test("different payment entries each get one receipt", async () => {
  const admin = database(); let sends = 0;
  const transport = async () => { sends++; return {}; };
  await api.deliverOnce(payload, transport, admin);
  await api.deliverOnce({ ...payload, deliveryKey: "payment:test:third" }, transport, admin);
  assert.equal(sends, 2);
});

test("confirmed SMTP rejection is retryable while an ambiguous timeout is held", async () => {
  for (const [error, expected] of [[Object.assign(new Error("Rejected"), { responseCode: 451 }), "retry"], [new Error("Connection timed out after DATA"), "uncertain"]]) {
    const admin = database();
    await assert.rejects(api.deliverOnce(payload, async () => { throw error; }, admin));
    assert.equal(admin.rows.get(payload.deliveryKey).status, expected);
    if (expected === "uncertain") {
      let sends = 0;
      await assert.rejects(api.deliverOnce(payload, async () => { sends++; }, admin));
      assert.equal(sends, 0);
    }
  }
});

test("browser and scheduler use the same reminder and follow-up keys", async () => {
  const browserKey = await api.emailDeliveryKey({ enrollmentId: "student-1", emailType: "Admission Follow-up" }, {});
  const serverKey = await api.emailDeliveryKey({ enrollmentId: "student-1", emailType: "Student Enrollment Form Follow-up 1" }, {});
  assert.equal(browserKey, serverKey);
  assert.match(await api.emailDeliveryKey({ enrollmentId: "student-1", emailType: "EMI Due Reminder" }, {}), /^reminder:student-1:/);
});

test("follow-up token is saved under the delivery claim before sending and survives a retry", async () => {
  const admin = database();
  const baseFrom = admin.from;
  let savedPatch;
  admin.from = (table) => {
    if (table !== "enrollments") return baseFrom();
    const query = { update(patch) { savedPatch = patch; return query; }, eq() { return query; }, select() { return query; }, async maybeSingle() { return { data: { id: "test-enrollment" } }; } };
    return query;
  };
  const followUp = { ...payload, enrollmentId: "test-enrollment", enrollmentPatch: { student_form_token_hash: "token-hash" } };
  await assert.rejects(api.deliverOnce(followUp, async () => {
    assert.equal(savedPatch.student_form_token_hash, "token-hash");
    throw Object.assign(new Error("Temporary rejection"), { responseCode: 451 });
  }, admin));
  const retryPayload = admin.rows.get(payload.deliveryKey).payload;
  assert.equal(retryPayload.enrollmentPatch.student_form_token_hash, "token-hash");
  await api.deliverOnce(retryPayload, async () => {
    assert.equal(savedPatch.student_form_token_hash, "token-hash");
    return { id: "retry-success" };
  }, admin);
});

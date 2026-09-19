import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { stripTypeScriptTypes } from "node:module";
import { readFileSync } from "node:fs";

test("submission logs each delivery independently and continues when one email fails", async () => {
  const source = readFileSync(new URL("../supabase/functions/student-intake/index.ts", import.meta.url), "utf8");
  const start = source.indexOf("      const emailFailures: string[] = [];");
  const end = source.indexOf("      return response(200, { ok: true, emailFailures });", start);
  assert.ok(start >= 0 && end > start);
  const logs = [], attempts = [];
  const email = { subject: "test", html: "test", text: "test" };
  const failures = await vm.runInNewContext(stripTypeScriptTypes(`(async () => { ${source.slice(start, end)} return emailFailures; })()`), {
    Date, enrollmentId: "test-enrollment", email: "student@example.com", studentAck: email, adminAlert: email, paymentEmail: email,
    getAdminNotificationEmail: () => "admin@example.com",
    sendEmail: async (payload) => { attempts.push(payload); if (attempts.length === 1) throw new Error("temporary failure"); },
    adminClient: { from: () => ({ insert: async (log) => { logs.push(log); return {}; } }) },
  });
  assert.equal(attempts.length, 3);
  assert.deepEqual(logs.map((log) => log.status), ["Failed", "Sent", "Sent"]);
  assert.equal(failures.length, 1);
});

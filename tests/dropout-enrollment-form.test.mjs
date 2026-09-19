import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { canSendStudentEnrollmentForm } from "../src/utils/studentFormEligibility.js";

test("enquiries and dropped leads can receive forms; prior admissions and payments cannot be overwritten", () => {
  for (const pipeline_stage of ["Enquiry", "Dropout", "Dropped"]) {
    assert.equal(canSendStudentEnrollmentForm({ pipeline_stage }), true);
    for (const patch of [{ enrolled_date: "2026-09-01" }, { amount_paid: 100 }, { student_form_status: "Submitted" }, { payment_history: [{}] }]) {
      assert.equal(canSendStudentEnrollmentForm({ pipeline_stage, ...patch }), false);
    }
  }
  assert.equal(canSendStudentEnrollmentForm({ pipeline_stage: "Enrolled" }), false);
  assert.equal(canSendStudentEnrollmentForm({}), false);
});

test("sending a dropped lead a form saves a token and emails its link without changing the admission stage", async () => {
  const source = readFileSync(new URL("../src/context/AppContext.jsx", import.meta.url), "utf8");
  const start = source.indexOf("  const sendStudentEnrollmentForm = async");
  const end = source.indexOf("  const appendEmailLogLocally", start);
  const patches = [];
  let sent;
  const url = "https://example.test/student-intake/enrollment-1?token=secure-token";
  const send = vm.runInNewContext(`${source.slice(start, end)}\nsendStudentEnrollmentForm;`, {
    state: { enrollments: [{ id: "enrollment-1", student_id: "student-1", pipeline_stage: "Dropout" }],
      students: [{ id: "student-1", full_name: "Test Student", email: "student@example.test" }], courses: [] },
    hasSupabaseEnv: true, supabase: {}, canSendStudentEnrollmentForm,
    isValidStudentEmailAddress: () => true,
    createStudentIntakeToken: () => "secure-token",
    hashStudentIntakeToken: async () => "hashed-token",
    runMutationWithSchemaRetry: async ({ payload }) => { patches.push(payload); return {}; },
    buildStudentIntakeUrl: ({ enrollmentId, token }) => {
      assert.equal(enrollmentId, "enrollment-1"); assert.equal(token, "secure-token"); return url;
    },
    normalizeBatchName: () => "Morning",
    buildStudentIntakeInviteEmail: ({ formUrl }) => ({ subject: "Enrollment form", html: `<a href="${formUrl}">Complete form</a>`, text: formUrl }),
    inferCurrentStage: () => "Dropout",
    logEmail: async (type, record, options) => { sent = { type, record, options }; },
    refreshState: async () => {},
  });
  const result = await send("enrollment-1");
  assert.equal(result.formUrl, url);
  assert.equal(sent.options.text, url);
  assert.ok(sent.options.html.includes(url));
  assert.equal(sent.options.student.email, "student@example.test");
  assert.equal(sent.options.currentStage, "Dropout");
  assert.equal(patches[0].student_form_token_hash, "hashed-token");
  assert.equal(patches[1].student_form_status, "Sent");
  assert.ok(patches.every(patch => !("pipeline_stage" in patch)));
});

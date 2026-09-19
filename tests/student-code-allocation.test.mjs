import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { getNextEnrolledStudentCode } from "../src/utils/studentCode.js";

const source = readFileSync(new URL("../supabase/functions/student-intake/index.ts", import.meta.url), "utf8");
const helpers = stripTypeScriptTypes(source.slice(0, source.indexOf("Deno.serve(")).replace(/^import .*;\r?\n/gm, ""));
const save = vm.runInNewContext(`${helpers}\nsaveStudentWithUniqueCode;`);
const collision = { code: "23505", message: 'duplicate key violates unique constraint "students_student_code_unique_idx"' };

function database(initial, options = {}) {
  const rows = structuredClone(initial);
  const writes = [];
  let attempts = 0;
  return {
    rows, writes,
    from(table) {
      assert.equal(table, "students");
      return {
        select() { return { order() { return { async range(start, end) {
          return options.readError ? { error: new Error("offline") } : { data: structuredClone(rows.slice(start, end + 1)) };
        } }; } }; },
        update(payload) { return { async eq(key, id) {
          attempts++;
          writes.push({ ...payload });
          if (options.alwaysCollision) return { error: collision };
          if (options.writeError) return { error: options.writeError };
          if (options.compete && attempts === 1) rows.push({ id: "racing-student", student_code: payload.student_code });
          if (rows.some(row => row.id !== id && row.student_code === payload.student_code)) return { error: collision };
          Object.assign(rows.find(row => row.id === id), payload);
          return { error: null };
        } }; },
      };
    },
  };
}

test("enrollment IDs include codes reserved by enquiries and dropouts", async () => {
  const students = [{ id: "old", student_code: "CT001", stage: "Enrolled" }, { id: "dropout", student_code: "CT002", stage: "Dropout" }, { id: "new", student_code: null }];
  assert.equal(getNextEnrolledStudentCode({ students }), "CT003");
  const db = database(students);
  const result = await save({ adminClient: db, recordId: "new", payload: { full_name: "Test" } });
  assert.equal(result.error, null);
  assert.equal(db.rows.find(row => row.id === "new").student_code, "CT003");
});

test("a simultaneous allocation is retried with a fresh available code", async () => {
  const db = database([{ id: "old", student_code: "CT001" }, { id: "new", student_code: null }], { compete: true });
  assert.equal((await save({ adminClient: db, recordId: "new", payload: {} })).error, null);
  assert.deepEqual(db.writes.map(row => row.student_code), ["CT002", "CT003"]);
});

test("retrying a previously saved student preserves their existing code", async () => {
  const db = database([{ id: "new", student_code: "CT002" }, { id: "old", student_code: "CT003" }]);
  await save({ adminClient: db, recordId: "new", payload: {} });
  assert.equal(db.writes[0].student_code, "CT002");
});

test("allocation reads every page before selecting an ID", async () => {
  const db = database([...Array.from({ length: 501 }, (_, i) => ({ id: `old-${i}`, student_code: `CT${String(i + 1).padStart(3, "0")}` })), { id: "new", student_code: null }]);
  await save({ adminClient: db, recordId: "new", payload: {} });
  assert.equal(db.writes[0].student_code, "CT502");
});

test("failed ID lookup never attempts a write", async () => {
  const db = database([], { readError: true });
  await assert.rejects(save({ adminClient: db, recordId: "new", payload: {} }), /Unable to check student IDs/);
  assert.equal(db.writes.length, 0);
});

test("repeated collisions are bounded and other write errors are not retried", async () => {
  const db = database([{ id: "new", student_code: null }], { alwaysCollision: true });
  assert.match((await save({ adminClient: db, recordId: "new", payload: {} })).error.message, /allocation is busy/);
  assert.equal(db.writes.length, 5);
  const denied = database([{ id: "new", student_code: null }], { writeError: { code: "42501", message: "denied" } });
  assert.equal((await save({ adminClient: denied, recordId: "new", payload: {} })).error.code, "42501");
  assert.equal(denied.writes.length, 1);
});

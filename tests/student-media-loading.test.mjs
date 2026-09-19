import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fetchStudentMedia } from "../src/services/studentMediaService.js";

test("login queries exclude embedded images in both normal and fallback loads", () => {
  const source = readFileSync(new URL("../src/context/AppContext.jsx", import.meta.url), "utf8");
  const start = source.indexOf("const deferredPortalTables =");
  const end = source.indexOf("const optionalPortalTables", start);
  const tables = vm.runInNewContext(`${source.slice(start, end)}\ndeferredPortalTables;`);
  for (const table of tables.filter(item => ["students", "documents"].includes(item.table))) {
    for (const query of [table.queryBuilder, table.fallbackQueryBuilder]) {
      let selection;
      query({ select(value) { selection = value; return { order() {} }; } });
      assert.ok(selection.includes("id"));
      assert.ok(!selection.includes("*"));
      for (const heavyField of ["photo_url", "aadhaar_document_url", "file_url"]) {
        assert.ok(!selection.split(",").includes(heavyField));
      }
    }
  }
});

function mediaClient(student, documents = [], error = null) {
  const calls = [];
  return { calls, from(table) {
    const call = { table }; calls.push(call);
    const query = {
      select(columns) { call.columns = columns; return query; },
      eq(column, value) { call.filter = [column, value]; return query; },
      in(column, values) { call.types = values; return query; },
      order() { return query; },
      abortSignal(signal) { call.signal = signal; return query; },
      async single() { return { data: student, error }; },
      then(resolve) { return Promise.resolve({ data: documents, error }).then(resolve); },
    };
    return query;
  } };
}

test("profile files load for only the selected student and avoid duplicate document downloads", async () => {
  const client = mediaClient({ photo_url: "photo", aadhaar_document_url: "identity" });
  const signal = new AbortController().signal;
  const urls = await fetchStudentMedia(client, { studentId: "student-1", enrollmentId: "enrollment-1", signal });
  assert.equal(urls["Student Photo"], "photo");
  assert.equal(client.calls.length, 1);
  assert.deepEqual(client.calls[0].filter, ["id", "student-1"]);
  assert.equal(client.calls[0].signal, signal);
});

test("missing profile file uses scoped document fallback and newest file wins", async () => {
  const client = mediaClient({ photo_url: "photo" }, [{ document_type: "Aadhaar ID Photo", file_url: "new" }, { document_type: "Aadhaar ID Photo", file_url: "old" }]);
  const urls = await fetchStudentMedia(client, { studentId: "student-1", enrollmentId: "enrollment-1" });
  assert.equal(urls["Aadhaar ID Photo"], "new");
  assert.deepEqual(client.calls[1].filter, ["enrollment_id", "enrollment-1"]);
  assert.deepEqual(client.calls[1].types, ["Aadhaar ID Photo"]);
});

test("failed media requests report failure instead of returning empty files", async () => {
  const client = mediaClient(null, [], new Error("offline"));
  await assert.rejects(fetchStudentMedia(client, { studentId: "student-1", enrollmentId: "enrollment-1" }), /offline/);
});

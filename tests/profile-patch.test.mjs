import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../src/context/AppContext.jsx", import.meta.url), "utf8");
const start = source.indexOf("    const normalizedStudentPatch =", source.indexOf("  const updateStudentProfile ="));
const end = source.indexOf("    if (Object.prototype", start);
const normalize = (studentPatch) => vm.runInNewContext(`${source.slice(start,end)} normalizedStudentPatch;`, {
  studentPatch, pickStudentDbColumns: (patch) => ({ full_name: "", photo_url: "", aadhaar_document_url: "", notes: "", ...patch }),
});
test("partial profile edits preserve omitted documents and notes", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(normalize({ full_name: "Updated" }))), { full_name: "Updated" });
});
test("timeline-only edits leave the student untouched; explicit removal is retained", () => {
  assert.equal(Object.keys(normalize({})).length, 0);
  assert.equal(normalize({ photo_url: "" }).photo_url, "");
});

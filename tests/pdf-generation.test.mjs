import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { jsPDF } from "jspdf";
import * as helpers from "../src/utils/paymentHelpers.js";
import { addMonthsPreservingDay, toIsoDate } from "../src/utils/dateMath.js";

test("enrollment PDF content generates using the installed jsPDF version", async () => {
  const source = readFileSync(new URL("../src/services/enrollmentAgreementPdf.js", import.meta.url), "utf8")
    .replace(/^import[\s\S]*?;\r?\n/gm, "").replace(/^export /gm, "");
  // Mock only the browser's logo rasterization; all PDF layout/text calls use real jsPDF.
  function PdfWithLogoAdapter(options) { const doc = new jsPDF(options); doc.addImage = () => doc; return doc; }
  class LogoImage { width = 1; height = 1; set src(_) { queueMicrotask(() => this.onload()); } }
  const build = vm.runInNewContext(source + "\nbuildEnrollmentPdfDocument;", { ...helpers, addMonthsPreservingDay, toIsoDate,
    jsPDF: PdfWithLogoAdapter, Image: LogoImage, shieldIcon: "test-logo", document: { createElement: () => ({ getContext: () => ({ drawImage() {} }), toDataURL: () => "test-logo-data" }) },
    Intl, Date, console, URL, Blob,
  });
  const result = await build({ student: { full_name: "Workflow Test Student", student_code: "TEST001", email: "test@example.com" },
    course: { course_name: "Data Science", duration: "3 Months", fee: 52000 },
    enrollment: { total_fee: 52000, original_fee: 52000, amount_paid: 35000, payment_plan: "EMI", installments_planned: 3, installments_paid: 2,
      enrolled_date: "2026-08-12", last_payment_date: "2026-09-12", next_due_date: "2026-10-12" } });
  const doc = result.doc || result;
  const pdf = doc.output();
  assert.ok(pdf.startsWith("%PDF-"));
  assert.ok(pdf.includes("Workflow Test Student"));
  assert.ok(pdf.includes("2/3"));
  assert.ok(doc.getNumberOfPages() >= 1);
});

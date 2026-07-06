import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import DocumentPreview from "../components/DocumentPreview";
import PageHeader from "../components/PageHeader";
import { useApp } from "../context/AppContext";
import { batchOptions, findCourseByReference, getCourseFormOptions } from "../data/courseCatalog";
import { paymentMethods, paymentPlans } from "../utils/constants";
import { aadhaarFileAccept, fileToDataUrl } from "../utils/fileHelpers";
import { formatCurrency } from "../utils/formatters";

const leadStatusOptions = ["New", "Follow-up", "Interested", "Not Interested", "Converted"];

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function createBlankForm() {
  return {
    full_name: "",
    email: "",
    phone: "",
    alternate_phone: "",
    college_name: "",
    current_activity: "Student",
    place: "",
    address: "",
    guardian_name: "",
    guardian_relation: "",
    guardian_phone: "",
    aadhaar_id: "",
    lead_source: "Manual Form",
    course_id: "",
    course_name: "",
    lead_date: getTodayIsoDate(),
    batch: "",
    enrolled_date: getTodayIsoDate(),
    pipeline_stage: "Enquiry",
    payment_plan: "One Time",
    payment_method: "UPI",
    total_fee: "",
    amount_paid: "",
    installments_planned: 1,
    installment_amount: "",
    next_due_date: "",
    follow_up_date: "",
    verification_status: "Pending",
    enrollment_status: "New",
    remarks: "",
  };
}

const identifyingStudentFields = ["full_name", "email", "phone", "alternate_phone", "aadhaar_id", "guardian_phone"];
const paymentReceiptTypes = ["Payment Receipt", "Payment proof"];

function uniqueValues(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function normalizeLookupValue(value) {
  return String(value || "").trim().toLowerCase();
}

function findDocumentPreview(record, documentTypes) {
  const types = Array.isArray(documentTypes) ? documentTypes : [documentTypes];
  return record?.documents?.find((item) => types.includes(item.document_type))?.file_url || "";
}

function findDocumentsByTypes(record, documentTypes) {
  return (record?.documents || []).filter((item) => documentTypes.includes(item.document_type));
}

function calculateInstallmentAmount(totalFee, amountPaid, paymentPlan, installmentsPlanned) {
  const numericFee = Number(totalFee || 0);
  const numericPaid = Number(amountPaid || 0);
  if (!numericFee || paymentPlan !== "EMI") return "";
  const remainingAmount = Math.max(numericFee - numericPaid, 0);
  if (!remainingAmount) return "0";
  const count = Number(installmentsPlanned || 0);
  if (!count || count < 1) return "";
  return String(Math.round(remainingAmount / count));
}

function FieldLabel({ children }) {
  return <p className="mb-2 text-sm font-semibold text-slate-700">{children}</p>;
}

function LabeledField({ label, children }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}

function normalizeInstallmentsCount(value, fallback = 1) {
  const count = Number(value || 0);
  return count > 0 ? count : fallback;
}

async function buildSingleDocumentFromFile(file, documentType, remarksPrefix) {
  if (!file) return null;

  return {
    document_type: documentType,
    file_url: await fileToDataUrl(file),
    remarks: `${remarksPrefix}: ${file.name}`,
    name: file.name,
  };
}

function buildConvertForm(record) {
  const { course, enrollment, student } = record;
  const paymentPlan = enrollment.payment_plan && enrollment.payment_plan !== "Pending" ? enrollment.payment_plan : "One Time";
  const totalFee = String(enrollment.total_fee || course?.fee || "");
  const installmentsPlanned = Number(enrollment.installments_planned || (paymentPlan === "EMI" ? 3 : 1));

  return {
    ...createBlankForm(),
    full_name: student.full_name || "",
    email: student.email || "",
    phone: student.phone || "",
    alternate_phone: student.alternate_phone || "",
    college_name: student.college_name || "",
    current_activity: student.current_activity || "Student",
    place: student.place || "",
    address: student.address || "",
    guardian_name: student.guardian_name || "",
    guardian_relation: student.guardian_relation || "",
    guardian_phone: student.guardian_phone || "",
    aadhaar_id: student.aadhaar_id || "",
    lead_source: student.lead_source || "Manual Form",
    course_id: course?.id || enrollment.course_id || "",
    course_name: course?.course_name || enrollment.course_name || "",
    lead_date: enrollment.lead_date || getTodayIsoDate(),
    batch: enrollment.batch || "",
    enrolled_date: enrollment.enrolled_date || getTodayIsoDate(),
    pipeline_stage: "Enrolled",
    payment_plan: paymentPlan,
    payment_method: enrollment.payment_method && enrollment.payment_method !== "Pending" ? enrollment.payment_method : "UPI",
    total_fee: totalFee,
    amount_paid: String(enrollment.amount_paid || 0),
    installments_planned: installmentsPlanned,
    installment_amount: String(
      enrollment.installment_amount
      || calculateInstallmentAmount(totalFee, enrollment.amount_paid || 0, paymentPlan, installmentsPlanned)
      || "",
    ),
    next_due_date: enrollment.next_due_date || "",
    follow_up_date: enrollment.follow_up_date || "",
    verification_status: enrollment.verification_status || "Pending",
    enrollment_status: enrollment.enrollment_status || "Active",
    remarks: enrollment.remarks || student.notes || "",
  };
}

export default function EnrollmentPageSimple() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { courses, createEnrollment, convertEnquiryToEnrollment, students, portalRecords } = useApp();
  const courseOptions = getCourseFormOptions(courses);
  const convertEnrollmentId = searchParams.get("convert") || "";
  const convertRecord = useMemo(
    () => portalRecords.find((record) => record.enrollment.id === convertEnrollmentId || record.id === convertEnrollmentId) || null,
    [convertEnrollmentId, portalRecords],
  );
  const isConvertMode = Boolean(convertRecord?.isEnquiryRecord);
  const [form, setForm] = useState(createBlankForm);
  const [photoPreview, setPhotoPreview] = useState("");
  const [aadhaarPreview, setAadhaarPreview] = useState("");
  const [paymentReceiptDocument, setPaymentReceiptDocument] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const selectedCourse = findCourseByReference(courseOptions, [form.course_id, form.course_name]);
  const totalFeeValue = Number(form.total_fee || selectedCourse?.fee || 0);
  const amountPaidValue = Number(form.amount_paid || 0);
  const remainingAmountValue = Math.max(totalFeeValue - amountPaidValue, 0);
  const paymentStatusValue = totalFeeValue > 0
    ? remainingAmountValue === 0
      ? "Paid"
      : amountPaidValue > 0
        ? "Partial"
        : "Pending"
    : "Pending";
  const latestRecordByStudentId = useMemo(() => {
    const map = new Map();

    portalRecords.forEach((record) => {
      if (!map.has(record.student.id)) {
        map.set(record.student.id, record);
      }
    });

    return map;
  }, [portalRecords]);

  const studentSuggestions = useMemo(
    () => ({
      full_name: uniqueValues(students.map((item) => item.full_name)),
      email: uniqueValues(students.map((item) => item.email)),
      phone: uniqueValues(students.map((item) => item.phone)),
      alternate_phone: uniqueValues(students.map((item) => item.alternate_phone)),
      college_name: uniqueValues(students.map((item) => item.college_name)),
      current_activity: uniqueValues(students.map((item) => item.current_activity)),
      place: uniqueValues(students.map((item) => item.place)),
      guardian_name: uniqueValues(students.map((item) => item.guardian_name)),
      guardian_relation: uniqueValues(students.map((item) => item.guardian_relation)),
      guardian_phone: uniqueValues(students.map((item) => item.guardian_phone)),
      aadhaar_id: uniqueValues(students.map((item) => item.aadhaar_id)),
      lead_source: uniqueValues(students.map((item) => item.lead_source)),
    }),
    [students],
  );

  const studentLookups = useMemo(() => {
    const lookups = Object.fromEntries(identifyingStudentFields.map((field) => [field, new Map()]));

    students.forEach((student) => {
      identifyingStudentFields.forEach((field) => {
        const normalizedValue = normalizeLookupValue(student[field]);
        if (normalizedValue && !lookups[field].has(normalizedValue)) {
          lookups[field].set(normalizedValue, student);
        }
      });
    });

    return lookups;
  }, [students]);

  const existingPaymentReceiptDocument = useMemo(() => findDocumentsByTypes(convertRecord, paymentReceiptTypes)[0] || null, [convertRecord]);

  useEffect(() => {
    if (!isConvertMode) return;

    setForm(buildConvertForm(convertRecord));
    setPhotoPreview(convertRecord.student.photo_url || findDocumentPreview(convertRecord, "Student Photo") || "");
    setAadhaarPreview(convertRecord.student.aadhaar_document_url || findDocumentPreview(convertRecord, "Aadhaar ID Photo") || "");
    setPaymentReceiptDocument(null);
  }, [convertRecord, isConvertMode]);

  useEffect(() => {
    if (isConvertMode) return;

    const matchedCourse = findCourseByReference(courseOptions, [form.course_id, form.course_name]);
    if (!matchedCourse) return;

    const shouldRemapId = Boolean(form.course_id) && matchedCourse.id !== form.course_id;
    const shouldFillName = matchedCourse.course_name && matchedCourse.course_name !== form.course_name;

    if (!shouldRemapId && !shouldFillName) return;

    setForm((prev) => ({
      ...prev,
      course_id: matchedCourse.id,
      course_name: matchedCourse.course_name || prev.course_name,
    }));
  }, [courseOptions, form.course_id, form.course_name, isConvertMode]);

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const syncPaymentFields = (nextValues) => {
    setForm((prev) => {
      const nextForm = {
        ...prev,
        ...nextValues,
      };
      const paymentPlan = nextForm.payment_plan || "One Time";
      const installmentsPlanned = paymentPlan === "EMI"
        ? normalizeInstallmentsCount(nextForm.installments_planned, normalizeInstallmentsCount(prev.installments_planned, 3))
        : 1;

      return {
        ...nextForm,
        installments_planned: installmentsPlanned,
        installment_amount: calculateInstallmentAmount(
          nextForm.total_fee,
          nextForm.amount_paid,
          paymentPlan,
          installmentsPlanned,
        ),
        next_due_date: paymentPlan === "EMI" ? nextForm.next_due_date : "",
      };
    });
  };

  const applyExistingStudentDetails = (matchedStudent) => {
    if (!matchedStudent || isConvertMode) return;

    const latestRecord = latestRecordByStudentId.get(matchedStudent.id);
    const latestEnrollment = latestRecord?.enrollment;
    const latestCourse = latestRecord?.course;

    setForm((prev) => ({
      ...prev,
      full_name: matchedStudent.full_name || prev.full_name,
      email: matchedStudent.email || prev.email,
      phone: matchedStudent.phone || prev.phone,
      alternate_phone: matchedStudent.alternate_phone || prev.alternate_phone,
      college_name: matchedStudent.college_name || prev.college_name,
      current_activity: matchedStudent.current_activity || prev.current_activity,
      place: matchedStudent.place || prev.place,
      lead_source: matchedStudent.lead_source || prev.lead_source,
      course_id: prev.course_id || latestCourse?.id || latestEnrollment?.course_id || "",
      course_name: prev.course_name || latestCourse?.course_name || "",
      remarks: prev.remarks || latestEnrollment?.remarks || "",
    }));
  };

  const tryAutofillStudent = (key, value) => {
    const matchedStudent = studentLookups[key]?.get(normalizeLookupValue(value));
    if (matchedStudent) {
      applyExistingStudentDetails(matchedStudent);
    }
  };

  const handleSuggestedStudentField = (key, value) => {
    updateForm(key, value);
    tryAutofillStudent(key, value);
  };

  const handleFileChange = async (setter, file) => {
    if (!file) {
      setter("");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setter(dataUrl);
  };

  const handlePaymentReceiptChange = async (file) => {
    const nextDocument = await buildSingleDocumentFromFile(file, "Payment Receipt", "Payment receipt upload");
    setPaymentReceiptDocument(nextDocument);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError("");
    setSubmitting(true);

    try {
      if (isConvertMode) {
        if (!photoPreview || !aadhaarPreview) {
          throw new Error("Student photo and Aadhaar upload are required before completing enrollment.");
        }

        const totalFee = Number(form.total_fee || selectedCourse?.fee || 0);
        const amountPaid = Number(form.amount_paid || 0);
        const installmentsPlanned = Number(form.installments_planned || 0);

        if (amountPaid > totalFee) {
          throw new Error("Amount paid cannot exceed the course fee.");
        }

        if (form.payment_plan === "EMI" && installmentsPlanned <= 0) {
          throw new Error("Number of installments must be greater than zero for EMI payments.");
        }

        const documents = paymentReceiptDocument?.file_url ? [paymentReceiptDocument] : [];

        await convertEnquiryToEnrollment({
          enrollmentId: convertRecord.enrollment.id,
          student: {
            full_name: form.full_name,
            email: form.email,
            phone: form.phone,
            alternate_phone: form.alternate_phone,
            college_name: form.college_name,
            current_activity: form.current_activity,
            place: form.place,
            address: form.address,
            guardian_name: form.guardian_name,
            guardian_relation: form.guardian_relation,
            guardian_phone: form.guardian_phone,
            aadhaar_id: form.aadhaar_id,
            photo_url: photoPreview,
            aadhaar_document_url: aadhaarPreview,
            notes: convertRecord?.student?.notes || "",
            lead_source: form.lead_source,
          },
          enrollment: {
            course_id: form.course_id,
            course_name: form.course_name || selectedCourse?.course_name || "",
            batch: form.batch,
            lead_date: convertRecord.enrollment.lead_date || getTodayIsoDate(),
            enrolled_date: form.enrolled_date || getTodayIsoDate(),
            joining_date: convertRecord.enrollment.joining_date || null,
            pipeline_stage: "Enrolled",
            payment_plan: form.payment_plan,
            payment_method: form.payment_method,
            total_fee: totalFee,
            amount_paid: amountPaid,
            installments_planned: form.payment_plan === "EMI" ? installmentsPlanned : 1,
            installment_amount: Number(form.installment_amount || 0),
            next_due_date: form.next_due_date || "",
            verification_status: convertRecord.enrollment.verification_status || "Pending",
            payment_status: paymentStatusValue,
            enrollment_status: convertRecord.enrollment.enrollment_status || "Active",
            remarks: form.remarks,
          },
          documents,
        });

        navigate(`/students/${convertRecord.student.id}`);
      } else {
        await createEnrollment({
          student: {
            full_name: form.full_name,
            email: form.email,
            phone: form.phone,
            alternate_phone: "",
            college_name: form.college_name,
            current_activity: form.current_activity,
            place: form.place,
            address: "",
            guardian_name: "",
            guardian_relation: "",
            guardian_phone: "",
            aadhaar_id: "",
            photo_url: "",
            aadhaar_document_url: "",
            notes: "",
            lead_source: form.lead_source,
          },
          enrollment: {
            course_id: form.course_id,
            course_name: form.course_name || selectedCourse?.course_name || "",
            batch: "",
            lead_date: form.lead_date || getTodayIsoDate(),
            enrolled_date: "",
            pipeline_stage: "Enquiry",
            payment_plan: "",
            payment_method: "",
            total_fee: 0,
            amount_paid: 0,
            installments_planned: 0,
            installment_amount: 0,
            follow_up_date: "",
            verification_status: "Pending",
            enrollment_status: form.enrollment_status || "New",
            remarks: form.remarks,
          },
          documents: [],
        });

        setForm(createBlankForm());
        setPhotoPreview("");
        setAadhaarPreview("");
        setPaymentReceiptDocument(null);
      }
    } catch (error) {
      setSubmitError(error.message || "Unable to save enrollment right now.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow={isConvertMode ? "Complete Admission" : "New Enquiry"}
        title="Student Form"
        description=""
      />

      {convertEnrollmentId && !isConvertMode ? (
        <section className="panel mb-6 p-6">
          <p className="text-sm font-semibold text-rose-600">This enquiry could not be loaded for conversion.</p>
          <Link to="/enquiries" className="button-secondary mt-4">
            Back to enquiries
          </Link>
        </section>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="panel p-6">
          <h2 className="section-title">Student Details</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <input
              list="student-name-suggestions"
              name="full_name"
              autoComplete="name"
              placeholder="Student name"
              value={form.full_name}
              onChange={(event) => handleSuggestedStudentField("full_name", event.target.value)}
              onBlur={(event) => tryAutofillStudent("full_name", event.target.value)}
              required
            />
            <input
              list="student-email-suggestions"
              name="email"
              autoComplete="email"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(event) => handleSuggestedStudentField("email", event.target.value)}
              onBlur={(event) => tryAutofillStudent("email", event.target.value)}
              required
            />
            <input
              list="student-phone-suggestions"
              name="phone"
              autoComplete="tel"
              inputMode="numeric"
              placeholder="Phone"
              value={form.phone}
              onChange={(event) => handleSuggestedStudentField("phone", event.target.value)}
              onBlur={(event) => tryAutofillStudent("phone", event.target.value)}
              required
            />
            <input
              list="student-current-activity-suggestions"
              name="current_activity"
              placeholder="Current qualification"
              value={form.current_activity}
              onChange={(event) => updateForm("current_activity", event.target.value)}
              required
            />
            <input
              list="student-college-suggestions"
              name="college_name"
              placeholder="College"
              value={form.college_name}
              onChange={(event) => handleSuggestedStudentField("college_name", event.target.value)}
              required
            />
            <input
              list="student-place-suggestions"
              name="place"
              autoComplete="address-level2"
              placeholder="City"
              value={form.place}
              onChange={(event) => handleSuggestedStudentField("place", event.target.value)}
              required
            />
            <select
              value={form.course_id}
              onChange={(event) => {
                const course = findCourseByReference(courseOptions, event.target.value);
                const nextFee = isConvertMode ? String(form.total_fee || course?.fee || "") : form.total_fee;
                setForm((prev) => ({
                  ...prev,
                  course_id: event.target.value,
                  course_name: course?.course_name || "",
                  total_fee: nextFee,
                  installment_amount: isConvertMode
                    ? calculateInstallmentAmount(nextFee, prev.amount_paid, prev.payment_plan, prev.installments_planned)
                    : prev.installment_amount,
                }));
              }}
              required
            >
              <option value="">Choose interested course</option>
              {courseOptions.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.course_name}
                </option>
              ))}
            </select>
            <input
              list="student-lead-source-suggestions"
              name="lead_source"
              placeholder="Lead source"
              value={form.lead_source}
              onChange={(event) => updateForm("lead_source", event.target.value)}
              required
            />
          </div>

          {!isConvertMode ? (
            <textarea
              rows="4"
              className="mt-4 w-full"
              placeholder="Remarks"
              value={form.remarks}
              onChange={(event) => updateForm("remarks", event.target.value)}
            />
          ) : (
            <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Profile completion before admission</p>
              <p className="mt-2 font-semibold text-slate-900">{convertRecord.profileCompletion}% complete</p>
              <p className="mt-2 text-sm text-slate-600">
                {convertRecord.missingInformation.length
                  ? `Missing: ${convertRecord.missingInformation.join(", ")}`
                  : "Core enquiry information is complete."}
              </p>
            </div>
          )}
        </section>

        <section className="panel p-6">
          <h2 className="section-title">Admission Details</h2>
          {isConvertMode ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <LabeledField label="Batch *">
                <select value={form.batch} onChange={(event) => updateForm("batch", event.target.value)} required>
                  <option value="">Select batch</option>
                  {batchOptions.map((batch) => (
                    <option key={batch} value={batch}>
                      {batch}
                    </option>
                  ))}
                </select>
              </LabeledField>
              <LabeledField label="Enrollment Date *">
                <input
                  type="date"
                  value={form.enrolled_date}
                  onChange={(event) => updateForm("enrolled_date", event.target.value)}
                  required
                />
              </LabeledField>
              <LabeledField label="Payment Status *">
                <input value={paymentStatusValue} readOnly aria-label="Payment Status" />
              </LabeledField>
              <LabeledField label="Payment Plan *">
                <select
                  value={form.payment_plan}
                  onChange={(event) => {
                    const nextPlan = event.target.value;
                    syncPaymentFields({
                      payment_plan: nextPlan,
                      installments_planned: nextPlan === "EMI" ? normalizeInstallmentsCount(form.installments_planned, 3) : 1,
                    });
                  }}
                  required
                >
                  {paymentPlans.filter((item) => item !== "Pending").map((plan) => (
                    <option key={plan} value={plan}>
                      {plan}
                    </option>
                  ))}
                </select>
              </LabeledField>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <LabeledField label="Enquiry Date *">
                <input
                  type="date"
                  value={form.lead_date}
                  onChange={(event) => updateForm("lead_date", event.target.value)}
                  required
                />
              </LabeledField>
              <LabeledField label="Lead Status">
                <select value={form.enrollment_status} onChange={(event) => updateForm("enrollment_status", event.target.value)}>
                  {leadStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </LabeledField>
            </div>
          )}
        </section>

        {isConvertMode ? (
          <>
            <section className="panel p-6">
              <h2 className="section-title">Payment Details</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <LabeledField label="Payment Method *">
                  <select value={form.payment_method} onChange={(event) => updateForm("payment_method", event.target.value)} required>
                    {paymentMethods.filter((item) => item !== "Pending").map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                </LabeledField>
                <LabeledField label="Course Fee (₹) *">
                  <input
                    type="number"
                    min="0"
                    placeholder="Enter total course fee"
                    value={form.total_fee}
                    onChange={(event) => syncPaymentFields({ total_fee: event.target.value })}
                    required
                  />
                </LabeledField>
                <LabeledField label="Amount Paid (₹) *">
                  <input
                    type="number"
                    min="0"
                    max={form.total_fee || undefined}
                    placeholder="Enter amount received"
                    value={form.amount_paid}
                    onChange={(event) => syncPaymentFields({ amount_paid: event.target.value })}
                    required
                  />
                </LabeledField>
                <LabeledField label="Remaining Amount (₹)">
                  <input value={String(remainingAmountValue)} readOnly aria-label="Remaining Amount" />
                </LabeledField>
                {form.payment_plan === "EMI" ? (
                  <>
                    <LabeledField label="Number of Installments">
                      <input
                        type="number"
                        min="1"
                        placeholder="Example: 4"
                        value={form.installments_planned}
                        onChange={(event) => syncPaymentFields({ installments_planned: event.target.value })}
                        required
                      />
                    </LabeledField>
                    <LabeledField label="Installment Amount (₹)">
                      <input
                        type="number"
                        placeholder="Calculated automatically"
                        value={form.installment_amount}
                        readOnly
                      />
                    </LabeledField>
                    <LabeledField label="Next Due Date">
                      <input
                        type="date"
                        value={form.next_due_date}
                        onChange={(event) => updateForm("next_due_date", event.target.value)}
                      />
                    </LabeledField>
                  </>
                ) : null}
              </div>

              {selectedCourse ? (
                <p className="mt-4 text-sm font-semibold text-sky-700">Selected fee: {formatCurrency(form.total_fee || selectedCourse.fee)}</p>
              ) : null}
            </section>

            <section className="panel p-6">
              <h2 className="section-title">Additional Student Details</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <textarea
                  name="address"
                  rows="4"
                  className="md:col-span-2"
                  placeholder="Address"
                  value={form.address}
                  onChange={(event) => updateForm("address", event.target.value)}
                  required
                />
                <input
                  list="student-alt-phone-suggestions"
                  name="alternate_phone"
                  autoComplete="tel"
                  inputMode="numeric"
                  placeholder="Alternate phone"
                  value={form.alternate_phone}
                  onChange={(event) => handleSuggestedStudentField("alternate_phone", event.target.value)}
                  onBlur={(event) => tryAutofillStudent("alternate_phone", event.target.value)}
                />
                <input
                  list="student-current-activity-suggestions"
                  name="current_activity_detail"
                  placeholder="Current activity"
                  value={form.current_activity}
                  onChange={(event) => updateForm("current_activity", event.target.value)}
                />
                <input
                  list="student-aadhaar-suggestions"
                  name="aadhaar_id"
                  autoComplete="off"
                  inputMode="numeric"
                  placeholder="Aadhaar number"
                  value={form.aadhaar_id}
                  onChange={(event) => handleSuggestedStudentField("aadhaar_id", event.target.value)}
                  onBlur={(event) => tryAutofillStudent("aadhaar_id", event.target.value)}
                  required
                />
              </div>
            </section>

            <section className="panel p-6">
              <h2 className="section-title">Guardian Details</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <input
                  list="student-guardian-name-suggestions"
                  name="guardian_name"
                  autoComplete="name"
                  placeholder="Guardian name"
                  value={form.guardian_name}
                  onChange={(event) => handleSuggestedStudentField("guardian_name", event.target.value)}
                  required
                />
                <input
                  list="student-guardian-relation-suggestions"
                  name="guardian_relation"
                  placeholder="Guardian relation"
                  value={form.guardian_relation}
                  onChange={(event) => handleSuggestedStudentField("guardian_relation", event.target.value)}
                  required
                />
                <input
                  list="student-guardian-phone-suggestions"
                  name="guardian_phone"
                  autoComplete="tel"
                  inputMode="numeric"
                  placeholder="Guardian phone"
                  value={form.guardian_phone}
                  onChange={(event) => handleSuggestedStudentField("guardian_phone", event.target.value)}
                  onBlur={(event) => tryAutofillStudent("guardian_phone", event.target.value)}
                  required
                />
              </div>
            </section>

            <section className="panel p-6">
              <h2 className="section-title">Document Uploads</h2>
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5">
                  <p className="font-semibold text-slate-900">Student photo</p>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    className="mt-4"
                    onChange={(event) => handleFileChange(setPhotoPreview, event.target.files?.[0])}
                    required={!photoPreview}
                  />
                  <DocumentPreview
                    src={photoPreview}
                    alt="Student preview"
                    title="Student photo"
                    className="mt-4 h-40 w-full rounded-2xl border border-slate-200 bg-white object-cover"
                  />
                </div>

                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5">
                  <p className="font-semibold text-slate-900">Aadhaar</p>
                  <input
                    type="file"
                    accept={aadhaarFileAccept}
                    className="mt-4"
                    onChange={(event) => handleFileChange(setAadhaarPreview, event.target.files?.[0])}
                    required={!aadhaarPreview}
                  />
                  <DocumentPreview
                    src={aadhaarPreview}
                    alt="Aadhaar preview"
                    title="Aadhaar document"
                    className="mt-4 h-40 w-full rounded-2xl border border-slate-200 bg-white object-cover"
                  />
                </div>

                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5">
                  <p className="font-semibold text-slate-900">Payment Receipt</p>
                  <input
                    type="file"
                    accept="image/*,.pdf,application/pdf"
                    className="mt-4"
                    onChange={(event) => handlePaymentReceiptChange(event.target.files?.[0])}
                  />
                  <p className="mt-3 text-sm text-slate-500">
                    Payment receipt is optional. Upload it when available.
                  </p>
                  <DocumentPreview
                    src={paymentReceiptDocument?.file_url || existingPaymentReceiptDocument?.file_url || ""}
                    alt="Payment receipt preview"
                    title="Payment receipt"
                    className="mt-4 h-40 w-full rounded-2xl border border-slate-200 bg-white object-cover"
                  />
                </div>
              </div>
            </section>

            <section className="panel p-6">
              <h2 className="section-title">Notes</h2>
              <div className="mt-6">
                <textarea
                  rows="5"
                  className="w-full"
                  placeholder="Enter remarks about the student (optional)"
                  value={form.remarks}
                  onChange={(event) => updateForm("remarks", event.target.value)}
                />
              </div>
            </section>
          </>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button type="submit" className="button-primary" disabled={submitting}>
            {submitting ? "Saving..." : isConvertMode ? "Complete Enrollment" : "Save Enquiry"}
          </button>
          {isConvertMode ? (
            <Link to="/enquiries" className="button-secondary">
              Back to enquiries
            </Link>
          ) : null}
        </div>
        {submitError ? <p className="text-sm font-semibold text-rose-600">{submitError}</p> : null}

        <datalist id="student-name-suggestions">
          {studentSuggestions.full_name.map((value) => <option key={value} value={value} />)}
        </datalist>
        <datalist id="student-email-suggestions">
          {studentSuggestions.email.map((value) => <option key={value} value={value} />)}
        </datalist>
        <datalist id="student-phone-suggestions">
          {studentSuggestions.phone.map((value) => <option key={value} value={value} />)}
        </datalist>
        <datalist id="student-alt-phone-suggestions">
          {studentSuggestions.alternate_phone.map((value) => <option key={value} value={value} />)}
        </datalist>
        <datalist id="student-college-suggestions">
          {studentSuggestions.college_name.map((value) => <option key={value} value={value} />)}
        </datalist>
        <datalist id="student-place-suggestions">
          {studentSuggestions.place.map((value) => <option key={value} value={value} />)}
        </datalist>
        <datalist id="student-current-activity-suggestions">
          {[...studentSuggestions.current_activity, "Student", "Final Year", "Working Professional", "Graduate", "Job Seeker"]
            .filter((value, index, values) => value && values.indexOf(value) === index)
            .map((value) => <option key={value} value={value} />)}
        </datalist>
        <datalist id="student-guardian-name-suggestions">
          {studentSuggestions.guardian_name.map((value) => <option key={value} value={value} />)}
        </datalist>
        <datalist id="student-guardian-relation-suggestions">
          {studentSuggestions.guardian_relation.map((value) => <option key={value} value={value} />)}
        </datalist>
        <datalist id="student-guardian-phone-suggestions">
          {studentSuggestions.guardian_phone.map((value) => <option key={value} value={value} />)}
        </datalist>
        <datalist id="student-aadhaar-suggestions">
          {studentSuggestions.aadhaar_id.map((value) => <option key={value} value={value} />)}
        </datalist>
        <datalist id="student-lead-source-suggestions">
          {[...studentSuggestions.lead_source, "Manual Form", "Walk-in", "Website", "Referral", "Counsellor"]
            .filter((value, index, values) => value && values.indexOf(value) === index)
            .map((value) => <option key={value} value={value} />)}
        </datalist>
      </form>
    </AppShell>
  );
}

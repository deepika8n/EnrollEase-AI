import { useEffect, useId, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DocumentPreview from "./DocumentPreview";
import { useApp } from "../context/AppContext";
import { batchOptions, findCourseByReference, getCourseFormOptions } from "../data/courseCatalog";
import { paymentMethods, paymentPlans } from "../utils/constants";
import {
  aadhaarFileAccept,
  extractPdfTextFromSource,
  fileToDataUrl,
  imageFileAccept,
  isImageSource,
  isPdfSource,
} from "../utils/fileHelpers";
import { getEnrollmentTimelineValidationMessage, getTodayIsoDate } from "../utils/enrollmentDateValidation";
import { formatCurrency } from "../utils/formatters";
import { resolveNextDueDate } from "../utils/paymentHelpers";
import { getNextEnrolledStudentCode } from "../utils/studentCode";

const currentActivityOptions = ["Student", "Working"];
const allowedImageExtensions = [".png", ".jpg", ".jpeg"];
const allowedImageMimeTypes = new Set(["image/png", "image/jpeg"]);
const allowedAadhaarExtensions = [".png", ".jpg", ".jpeg", ".pdf"];
const allowedAadhaarMimeTypes = new Set(["image/png", "image/jpeg", "application/pdf"]);
const identifyingStudentFields = ["full_name", "email", "phone", "alternate_phone", "aadhaar_id", "guardian_phone"];
const paymentReceiptTypes = ["Payment Receipt", "Payment proof"];

function createBlankForm() {
  return {
    student_code: "",
    full_name: "",
    email: "",
    phone: "",
    alternate_phone: "",
    college_name: "",
    current_activity: "",
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
    enrolled_date: "",
    last_payment_date: "",
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

function normalizeAadhaarDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatAadhaarInput(value) {
  const digits = normalizeAadhaarDigits(value).slice(0, 12);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

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

function calculatePaymentStatus(totalFee, amountPaid) {
  const numericFee = Number(totalFee || 0);
  const numericPaid = Number(amountPaid || 0);

  if (numericFee <= 0 || numericPaid <= 0) return "Pending";
  if (numericPaid >= numericFee) return "Paid";
  return "Partial";
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

function extractAadhaarNumberFromText(value) {
  const text = String(value || "");
  const groupedMatch = text.match(/\b\d{4}\s\d{4}\s\d{4}\b/);
  if (groupedMatch) {
    return normalizeAadhaarDigits(groupedMatch[0]);
  }

  const continuousMatch = text.match(/\b\d{12}\b/);
  if (continuousMatch) {
    return normalizeAadhaarDigits(continuousMatch[0]);
  }

  return "";
}

function fileMatchesAllowedTypes(file, mimeTypes, extensions) {
  if (!file) return false;

  const fileName = String(file.name || "").trim().toLowerCase();
  const fileType = String(file.type || "").trim().toLowerCase();
  const hasAllowedExtension = extensions.some((extension) => fileName.endsWith(extension));

  if (!fileType) {
    return hasAllowedExtension;
  }

  return mimeTypes.has(fileType) && hasAllowedExtension;
}

function assertAllowedFileType(file, fieldLabel, { mimeTypes, extensions, allowedLabel }) {
  if (!file) return;

  if (!fileMatchesAllowedTypes(file, mimeTypes, extensions)) {
    throw new Error(`${fieldLabel} must be ${allowedLabel}.`);
  }
}

function appendVerificationNote(remarks, status, warning = "") {
  const note = [`Aadhaar verification: ${status}`, warning].filter(Boolean).join(" | ");
  if (!note) return remarks || "";
  if (!remarks) return note;
  return remarks.includes(note) ? remarks : `${remarks}\n${note}`;
}

function sanitizeRemarks(value) {
  return String(value || "").trim();
}

function normalizeDigitsForPhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function findDuplicateRecord(portalRecords, { email, phone, aadhaarId }, options = {}) {
  const normalizedEmail = normalizeLookupValue(email);
  const normalizedPhone = normalizeDigitsForPhone(phone);
  const normalizedAadhaar = normalizeAadhaarDigits(aadhaarId);
  const excludeStudentId = options.excludeStudentId || "";
  const excludeEnrollmentId = options.excludeEnrollmentId || "";

  return portalRecords.find((record) => {
    if (record.isDropoutRecord) return false;
    if (record.student.id === excludeStudentId || record.enrollment.id === excludeEnrollmentId) return false;

    const emailMatch = normalizedEmail && normalizeLookupValue(record.student.email) === normalizedEmail;
    const phoneMatch = normalizedPhone && normalizeDigitsForPhone(record.student.phone) === normalizedPhone;
    const aadhaarMatch = normalizedAadhaar && record.isEnrolledRecord && normalizeAadhaarDigits(record.student.aadhaar_id) === normalizedAadhaar;

    return emailMatch || phoneMatch || aadhaarMatch;
  }) || null;
}

async function buildSingleDocumentFromFile(file, documentType, remarksPrefix, extraRemarks = "") {
  if (!file) return null;

  return {
    document_type: documentType,
    file_url: await fileToDataUrl(file),
    remarks: [`${remarksPrefix}: ${file.name}`, extraRemarks].filter(Boolean).join(" | "),
    name: file.name,
    file,
  };
}

async function verifyAadhaarDocument({ documentSource }) {
  if (!documentSource) {
    return {
      status: "Not Verified",
      warning: "Aadhaar could not be auto-verified. Manual verification required.",
      aadhaarId: "",
    };
  }

  if (!isPdfSource(documentSource)) {
    return {
      status: "Manual Review",
      warning: "Image Aadhaar uploaded. Manual verification required.",
      aadhaarId: "",
    };
  }

  try {
    const extractedText = await extractPdfTextFromSource(documentSource);
    if (!extractedText) {
      return {
        status: "Manual Review",
        warning: "Aadhaar could not be auto-verified. Manual verification required.",
        aadhaarId: "",
      };
    }

    const extractedAadhaarId = extractAadhaarNumberFromText(extractedText);
    if (extractedAadhaarId) {
      return {
        status: "Matched",
        warning: "",
        aadhaarId: extractedAadhaarId,
      };
    }

    return {
      status: "Manual Review",
      warning: "Aadhaar number could not be read from the uploaded PDF. Please upload a clearer Aadhaar PDF.",
      aadhaarId: "",
    };
  } catch {
    return {
      status: "Manual Review",
      warning: "Aadhaar could not be auto-verified. Manual verification required.",
      aadhaarId: "",
    };
  }
}

function buildConvertForm(record) {
  const { course, enrollment, student } = record;
  const paymentPlan = enrollment.payment_plan && enrollment.payment_plan !== "Pending" ? enrollment.payment_plan : "One Time";
  const totalFee = String(enrollment.total_fee || course?.fee || "");
  const amountPaid = Number(enrollment.amount_paid || 0);
  const installmentsPlanned = Number(enrollment.installments_planned || (paymentPlan === "EMI" ? 3 : 1));
  const paymentStatus = calculatePaymentStatus(totalFee, amountPaid);
  const nextDueDate = paymentPlan === "EMI"
    ? resolveNextDueDate({
      paymentStatus,
      paymentPlan,
      lastPaymentDate: enrollment.last_payment_date || "",
      history: enrollment.payment_history || [],
    })
    : "";

  return {
    ...createBlankForm(),
    student_code: student.student_code || "",
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
    last_payment_date: enrollment.last_payment_date || "",
    pipeline_stage: "Enrolled",
    payment_plan: paymentPlan,
    payment_method: enrollment.payment_method && enrollment.payment_method !== "Pending" ? enrollment.payment_method : "UPI",
    total_fee: totalFee,
    amount_paid: String(amountPaid),
    installments_planned: installmentsPlanned,
    installment_amount: String(
      enrollment.installment_amount
      || calculateInstallmentAmount(totalFee, amountPaid, paymentPlan, installmentsPlanned)
      || "",
    ),
    next_due_date: nextDueDate,
    follow_up_date: enrollment.follow_up_date || "",
    verification_status: enrollment.verification_status || "Pending",
    enrollment_status: enrollment.enrollment_status || "Active",
    remarks: enrollment.remarks || student.notes || "",
  };
}

export default function EnrollmentForm({
  convertEnrollmentId = "",
  returnPath = "",
  onCancel = null,
  onSuccess = null,
}) {
  const navigate = useNavigate();
  const formIdPrefix = useId().replace(/:/g, "");
  const { courses, createEnrollment, convertEnquiryToEnrollment, students, portalRecords, enrollments } = useApp();
  const courseOptions = getCourseFormOptions(courses);
  const convertRecord = useMemo(
    () => portalRecords.find((record) => record.enrollment.id === convertEnrollmentId || record.id === convertEnrollmentId) || null,
    [convertEnrollmentId, portalRecords],
  );
  const isConvertMode = Boolean(convertRecord?.isEnquiryRecord);
  const [form, setForm] = useState(createBlankForm);
  const [photoPreview, setPhotoPreview] = useState("");
  const [aadhaarPreview, setAadhaarPreview] = useState("");
  const [photoDocument, setPhotoDocument] = useState(null);
  const [aadhaarDocument, setAadhaarDocument] = useState(null);
  const [paymentReceiptDocument, setPaymentReceiptDocument] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [duplicateCandidate, setDuplicateCandidate] = useState(null);
  const [aadhaarVerificationNotice, setAadhaarVerificationNotice] = useState(null);
  const todayIsoDate = getTodayIsoDate();
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
  const nextEnrolledStudentCode = useMemo(
    () => getNextEnrolledStudentCode({ students, enrollments }),
    [enrollments, students],
  );

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

    setForm({
      ...buildConvertForm(convertRecord),
      student_code: convertRecord?.student?.student_code || nextEnrolledStudentCode,
    });
    setPhotoPreview(convertRecord.student.photo_url || findDocumentPreview(convertRecord, "Student Photo") || "");
    setAadhaarPreview(convertRecord.student.aadhaar_document_url || findDocumentPreview(convertRecord, "Aadhaar ID Photo") || "");
    setPhotoDocument(null);
    setAadhaarDocument(null);
    setPaymentReceiptDocument(null);
    setAadhaarVerificationNotice(null);
    setDuplicateCandidate(null);
    setSubmitError("");
  }, [convertRecord, isConvertMode, nextEnrolledStudentCode]);

  useEffect(() => {
    if (convertEnrollmentId || isConvertMode) return;

    setForm(createBlankForm());
    setPhotoPreview("");
    setAadhaarPreview("");
    setPhotoDocument(null);
    setAadhaarDocument(null);
    setPaymentReceiptDocument(null);
    setAadhaarVerificationNotice(null);
    setDuplicateCandidate(null);
    setSubmitError("");
  }, [convertEnrollmentId, isConvertMode]);

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

  const dismissForm = () => {
    if (onCancel) {
      onCancel();
      return;
    }

    navigate(returnPath || (convertEnrollmentId ? "/enquiries" : "/enrollment"));
  };

  const finalizeSuccess = (payload) => {
    if (onSuccess) {
      onSuccess(payload);
      return;
    }

    if (payload.mode === "convert" && payload.studentId) {
      navigate(`/students/${payload.studentId}`);
      return;
    }

    if (returnPath) {
      navigate(returnPath);
    }
  };

  const updateForm = (key, value) => {
    setDuplicateCandidate(null);
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
      const paymentStatus = calculatePaymentStatus(nextForm.total_fee, nextForm.amount_paid);
      const autoNextDueDate = paymentPlan === "EMI" && !Object.prototype.hasOwnProperty.call(nextValues, "next_due_date")
        ? resolveNextDueDate({
          paymentStatus,
          paymentPlan,
          lastPaymentDate: nextForm.last_payment_date || "",
        })
        : nextForm.next_due_date;

      return {
        ...nextForm,
        installments_planned: installmentsPlanned,
        installment_amount: calculateInstallmentAmount(
          nextForm.total_fee,
          nextForm.amount_paid,
          paymentPlan,
          installmentsPlanned,
        ),
        next_due_date: paymentPlan === "EMI" ? autoNextDueDate : "",
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
      student_code: matchedStudent.student_code || prev.student_code,
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

  const handleStudentPhotoChange = async (file) => {
    if (!file) return;

    try {
      setSubmitError("");
      assertAllowedFileType(file, "Student photo", {
        mimeTypes: allowedImageMimeTypes,
        extensions: allowedImageExtensions,
        allowedLabel: "a PNG, JPG, or JPEG image",
      });
      const nextDocument = await buildSingleDocumentFromFile(file, "Student Photo", "Student photo upload");
      setPhotoDocument(nextDocument);
      setPhotoPreview(nextDocument?.file_url || photoPreview);
    } catch (error) {
      setSubmitError(error.message || "Unable to upload student photo.");
    }
  };

  const handleAadhaarChange = async (file) => {
    if (!file) return;

    try {
      setSubmitError("");
      assertAllowedFileType(file, "Aadhaar upload", {
        mimeTypes: allowedAadhaarMimeTypes,
        extensions: allowedAadhaarExtensions,
        allowedLabel: "a PNG, JPG, JPEG, or PDF file",
      });
      const nextDocument = await buildSingleDocumentFromFile(file, "Aadhaar ID Photo", "Aadhaar upload");
      setAadhaarDocument(nextDocument);
      setAadhaarPreview(nextDocument?.file_url || aadhaarPreview);
      setAadhaarVerificationNotice(null);
    } catch (error) {
      setSubmitError(error.message || "Unable to upload Aadhaar document.");
    }
  };

  const handlePaymentReceiptChange = async (file) => {
    if (!file) return;

    try {
      setSubmitError("");
      assertAllowedFileType(file, "Payment receipt", {
        mimeTypes: allowedImageMimeTypes,
        extensions: allowedImageExtensions,
        allowedLabel: "a PNG, JPG, or JPEG image",
      });
      const nextDocument = await buildSingleDocumentFromFile(file, "Payment Receipt", "Payment receipt upload");
      setPaymentReceiptDocument(nextDocument);
    } catch (error) {
      setSubmitError(error.message || "Unable to upload payment receipt.");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError("");
    setSubmitting(true);
    setAadhaarVerificationNotice(null);

    try {
      let aadhaarVerification = null;
      let resolvedAadhaarDigits = "";
      const timelineValidationMessage = getEnrollmentTimelineValidationMessage({
        leadDate: form.lead_date,
        enrolledDate: isConvertMode ? form.enrolled_date : "",
        lastPaymentDate: isConvertMode ? form.last_payment_date : "",
        nextDueDate: isConvertMode && form.payment_plan === "EMI" ? form.next_due_date : "",
        paymentPlan: isConvertMode ? form.payment_plan : "",
        pipelineStage: isConvertMode ? "Enrolled" : "Enquiry",
        requireLeadDate: true,
        requireEnrolledDate: isConvertMode,
        today: todayIsoDate,
      });

      if (timelineValidationMessage) {
        throw new Error(timelineValidationMessage);
      }

      if (isConvertMode) {
        if (!photoPreview || !aadhaarPreview) {
          throw new Error("Student photo and Aadhaar upload are required before completing enrollment.");
        }
        if (!isImageSource(photoPreview)) {
          throw new Error("Student photo must be a PNG, JPG, or JPEG image.");
        }
        if (paymentReceiptDocument?.file_url && !isImageSource(paymentReceiptDocument.file_url)) {
          throw new Error("Payment receipt must be a PNG, JPG, or JPEG image.");
        }

        aadhaarVerification = await verifyAadhaarDocument({
          documentSource: aadhaarDocument?.file_url || aadhaarPreview,
        });
        resolvedAadhaarDigits = normalizeAadhaarDigits(
          aadhaarVerification.aadhaarId || convertRecord?.student?.aadhaar_id || "",
        );
      }

      const duplicateRecord = findDuplicateRecord(
        portalRecords,
        {
          email: form.email,
          phone: form.phone,
          aadhaarId: isConvertMode ? resolvedAadhaarDigits : "",
        },
        {
          excludeStudentId: convertRecord?.student?.id || "",
          excludeEnrollmentId: convertRecord?.enrollment?.id || "",
        },
      );

      if (duplicateRecord) {
        setDuplicateCandidate(duplicateRecord);
        throw new Error(`An active student record already exists for ${duplicateRecord.student.full_name}. Open the existing profile instead of creating a duplicate.`);
      }

      if (isConvertMode) {
        const totalFee = Number(form.total_fee || selectedCourse?.fee || 0);
        const amountPaid = Number(form.amount_paid || 0);
        const installmentsPlanned = Number(form.installments_planned || 0);
        const hasPaymentReceipt = Boolean(paymentReceiptDocument?.file_url || existingPaymentReceiptDocument?.file_url);

        if (totalFee <= 0) {
          throw new Error("Total fee must be greater than 0 before completing enrollment.");
        }
        if (amountPaid > totalFee) {
          throw new Error("Amount paid cannot exceed the course fee.");
        }
        if (remainingAmountValue < 0) {
          throw new Error("Remaining amount must never be negative.");
        }
        if (amountPaid > 0 && !hasPaymentReceipt) {
          throw new Error("Payment receipt is required when amount paid is greater than zero.");
        }
        if (form.payment_plan === "One Time" && Number(form.installments_planned || 1) > 1) {
          throw new Error("Installments are not required for one-time payments.");
        }
        if (form.payment_plan === "EMI" && installmentsPlanned <= 0) {
          throw new Error("Number of installments must be greater than zero for EMI payments.");
        }
        if (amountPaid > 0 && !form.last_payment_date) {
          throw new Error("Last payment date is required when amount paid is greater than zero.");
        }
        if (form.payment_plan === "EMI" && amountPaid > 0 && !form.next_due_date) {
          throw new Error("Next due date is required after recording an EMI payment.");
        }

        if (aadhaarVerification.warning) {
          setAadhaarVerificationNotice(aadhaarVerification.warning);
        }

        const documents = [
          photoDocument?.file_url ? photoDocument : null,
          aadhaarDocument?.file_url
            ? {
              ...aadhaarDocument,
              remarks: appendVerificationNote(aadhaarDocument.remarks, aadhaarVerification.status, aadhaarVerification.warning),
            }
            : null,
          paymentReceiptDocument?.file_url ? paymentReceiptDocument : null,
        ].filter(Boolean);
        await convertEnquiryToEnrollment({
          enrollmentId: convertRecord.enrollment.id,
          student: {
            student_code: form.student_code.trim(),
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
            aadhaar_id: resolvedAadhaarDigits.length === 12 ? formatAadhaarInput(resolvedAadhaarDigits) : "",
            photo_url: photoPreview,
            aadhaar_document_url: aadhaarPreview,
            notes: convertRecord?.student?.notes || "",
            lead_source: form.lead_source,
          },
          enrollment: {
            course_id: form.course_id,
            course_name: form.course_name || selectedCourse?.course_name || "",
            batch: form.batch,
            lead_date: form.lead_date,
            enrolled_date: form.enrolled_date,
            pipeline_stage: "Enrolled",
            payment_plan: form.payment_plan,
            payment_method: form.payment_method,
            total_fee: totalFee,
            amount_paid: amountPaid,
            installments_planned: form.payment_plan === "EMI" ? installmentsPlanned : 1,
            installment_amount: Number(form.payment_plan === "EMI" ? form.installment_amount || 0 : 0),
            last_payment_date: amountPaid > 0 ? form.last_payment_date : "",
            next_due_date: form.payment_plan === "EMI" ? form.next_due_date : "",
            verification_status: convertRecord.enrollment.verification_status || "Pending",
            payment_status: paymentStatusValue,
            enrollment_status: convertRecord.enrollment.enrollment_status || "Active",
            remarks: sanitizeRemarks(form.remarks),
          },
          documents,
        });

        finalizeSuccess({
          mode: "convert",
          enrollmentId: convertRecord.enrollment.id,
          studentId: convertRecord.student.id,
        });
      } else {
        await createEnrollment({
          student: {
            student_code: form.student_code.trim(),
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
            lead_date: form.lead_date,
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
        setPhotoDocument(null);
        setAadhaarDocument(null);
        setPaymentReceiptDocument(null);
        setDuplicateCandidate(null);
        setAadhaarVerificationNotice(null);
        setSubmitError("");

        finalizeSuccess({
          mode: "enquiry",
        });
      }
    } catch (error) {
      setSubmitError(error.message || "Unable to save enrollment right now.");
    } finally {
      setSubmitting(false);
    }
  };

  const nameSuggestionId = `${formIdPrefix}-student-name-suggestions`;
  const emailSuggestionId = `${formIdPrefix}-student-email-suggestions`;
  const phoneSuggestionId = `${formIdPrefix}-student-phone-suggestions`;
  const altPhoneSuggestionId = `${formIdPrefix}-student-alt-phone-suggestions`;
  const placeSuggestionId = `${formIdPrefix}-student-place-suggestions`;
  const guardianNameSuggestionId = `${formIdPrefix}-student-guardian-name-suggestions`;
  const guardianRelationSuggestionId = `${formIdPrefix}-student-guardian-relation-suggestions`;
  const guardianPhoneSuggestionId = `${formIdPrefix}-student-guardian-phone-suggestions`;

  if (convertEnrollmentId && !isConvertMode) {
    return (
      <section className="panel p-6">
        <p className="text-sm font-semibold text-brand-500">This enquiry could not be loaded for conversion.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className="button-secondary" onClick={dismissForm}>
            Back
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      {duplicateCandidate ? (
        <section className="panel mb-6 p-6">
          <p className="section-kicker">Duplicate detected</p>
          <h2 className="mt-3 text-lg font-semibold text-slate-950">An active student record already exists.</h2>
          <p className="mt-3 text-sm text-slate-600">
            {duplicateCandidate.student.full_name} already has an active record for {duplicateCandidate.course?.course_name || "the selected course"}.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className="button-primary" onClick={() => navigate(`/students/${duplicateCandidate.student.id}`)}>
              Open Existing Record
            </button>
            <button type="button" className="button-secondary" onClick={() => setDuplicateCandidate(null)}>
              Dismiss
            </button>
          </div>
        </section>
      ) : null}

      {aadhaarVerificationNotice ? (
        <section className="panel mb-6 p-6">
          <p className="section-kicker">Aadhaar Validation</p>
          <p className="mt-3 text-sm font-semibold text-brand-500">{aadhaarVerificationNotice}</p>
        </section>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="panel p-6">
          <h2 className="section-title">Student Details</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <input
              name="student_code"
              placeholder="Custom student ID"
              value={form.student_code}
              onChange={(event) => updateForm("student_code", event.target.value.trimStart())}
            />
            <input
              list={nameSuggestionId}
              name="full_name"
              autoComplete="name"
              placeholder="Student name"
              value={form.full_name}
              onChange={(event) => handleSuggestedStudentField("full_name", event.target.value)}
              onBlur={(event) => tryAutofillStudent("full_name", event.target.value)}
              required
            />
            <input
              list={emailSuggestionId}
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
              list={phoneSuggestionId}
              name="phone"
              autoComplete="tel"
              inputMode="numeric"
              placeholder="Phone"
              value={form.phone}
              onChange={(event) => handleSuggestedStudentField("phone", event.target.value)}
              onBlur={(event) => tryAutofillStudent("phone", event.target.value)}
              required
            />
            <select
              name="current_activity"
              value={form.current_activity}
              onChange={(event) => updateForm("current_activity", event.target.value)}
              required
            >
              <option value="">I am a</option>
              {currentActivityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <input
              list={placeSuggestionId}
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
          </div>

          {!isConvertMode ? (
            <textarea
              rows="4"
              className="mt-4 w-full"
              placeholder="Remarks"
              value={form.remarks}
              onChange={(event) => updateForm("remarks", event.target.value)}
            />
          ) : null}
        </section>

        <section className="panel p-6">
          <h2 className="section-title">Admission Details</h2>
          {isConvertMode ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <LabeledField label="Lead Date *">
                <input
                  type="date"
                  value={form.lead_date}
                  max={todayIsoDate}
                  onChange={(event) => updateForm("lead_date", event.target.value)}
                  required
                />
              </LabeledField>
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
                  max={todayIsoDate}
                  onChange={(event) => syncPaymentFields({ enrolled_date: event.target.value })}
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
                  max={todayIsoDate}
                  onChange={(event) => updateForm("lead_date", event.target.value)}
                  required
                />
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
                <LabeledField label="Course Fee (Rs) *">
                  <input
                    type="number"
                    min="0"
                    placeholder="Enter total course fee"
                    value={form.total_fee}
                    onChange={(event) => syncPaymentFields({ total_fee: event.target.value })}
                    required
                  />
                </LabeledField>
                <LabeledField label="Amount Paid (Rs) *">
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
                <LabeledField label="Remaining Amount (Rs)">
                  <input value={String(remainingAmountValue)} readOnly aria-label="Remaining Amount" />
                </LabeledField>
                <LabeledField label="Last Payment Date">
                  <input
                    type="date"
                    max={todayIsoDate}
                    value={form.last_payment_date}
                    onChange={(event) => syncPaymentFields({ last_payment_date: event.target.value })}
                  />
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
                    <LabeledField label="Installment Amount (Rs)">
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
                <p className="mt-4 text-sm font-semibold text-brand-500">Selected fee: {formatCurrency(form.total_fee || selectedCourse.fee)}</p>
              ) : null}
            </section>

            <section className="panel p-6">
              <h2 className="section-title">Document Uploads</h2>
              <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                <div className="flex min-h-[22rem] flex-col rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5">
                  <div>
                    <p className="font-semibold text-slate-900">Student photo</p>
                    <p className="mt-1 text-sm text-slate-500">Upload only PNG, JPG, or JPEG.</p>
                  </div>
                  <input
                    type="file"
                    accept={imageFileAccept}
                    className="mt-4"
                    onChange={(event) => handleStudentPhotoChange(event.target.files?.[0])}
                    required={!photoPreview}
                  />
                  <DocumentPreview
                    src={photoPreview}
                    alt="Student preview"
                    title="Student photo"
                    className="mt-4 min-h-[220px] w-full flex-1 rounded-[24px] border border-slate-200 bg-white object-cover"
                  />
                </div>

                <div className="flex min-h-[22rem] flex-col rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5">
                  <div>
                    <p className="font-semibold text-slate-900">Aadhaar document</p>
                    <p className="mt-1 text-sm text-slate-500">Upload PNG, JPG, JPEG, or PDF.</p>
                  </div>
                  <input
                    type="file"
                    accept={aadhaarFileAccept}
                    className="mt-4"
                    onChange={(event) => handleAadhaarChange(event.target.files?.[0])}
                    required={!aadhaarPreview}
                  />
                  <DocumentPreview
                    src={aadhaarPreview}
                    alt="Aadhaar preview"
                    title="Aadhaar document"
                    enablePdfZoom
                    className="mt-4 min-h-[260px] w-full flex-1"
                  />
                </div>

                <div className="flex min-h-[22rem] flex-col rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5">
                  <div>
                    <p className="font-semibold text-slate-900">Payment receipt</p>
                    <p className="mt-1 text-sm text-slate-500">Optional. Upload only PNG, JPG, or JPEG.</p>
                  </div>
                  <input
                    type="file"
                    accept={imageFileAccept}
                    className="mt-4"
                    onChange={(event) => handlePaymentReceiptChange(event.target.files?.[0])}
                  />
                  <DocumentPreview
                    src={paymentReceiptDocument?.file_url || existingPaymentReceiptDocument?.file_url || ""}
                    alt="Payment receipt preview"
                    title="Payment receipt"
                    className="mt-4 min-h-[220px] w-full flex-1 rounded-[24px] border border-slate-200 bg-white object-contain"
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
          {onCancel || isConvertMode ? (
            <button type="button" className="button-secondary" onClick={dismissForm}>
              Cancel
            </button>
          ) : null}
        </div>
        {submitError ? <p className="text-sm font-semibold text-brand-500">{submitError}</p> : null}

        <datalist id={nameSuggestionId}>
          {studentSuggestions.full_name.map((value) => <option key={value} value={value} />)}
        </datalist>
        <datalist id={emailSuggestionId}>
          {studentSuggestions.email.map((value) => <option key={value} value={value} />)}
        </datalist>
        <datalist id={phoneSuggestionId}>
          {studentSuggestions.phone.map((value) => <option key={value} value={value} />)}
        </datalist>
        <datalist id={altPhoneSuggestionId}>
          {studentSuggestions.alternate_phone.map((value) => <option key={value} value={value} />)}
        </datalist>
        <datalist id={placeSuggestionId}>
          {studentSuggestions.place.map((value) => <option key={value} value={value} />)}
        </datalist>
        <datalist id={guardianNameSuggestionId}>
          {studentSuggestions.guardian_name.map((value) => <option key={value} value={value} />)}
        </datalist>
        <datalist id={guardianRelationSuggestionId}>
          {studentSuggestions.guardian_relation.map((value) => <option key={value} value={value} />)}
        </datalist>
        <datalist id={guardianPhoneSuggestionId}>
          {studentSuggestions.guardian_phone.map((value) => <option key={value} value={value} />)}
        </datalist>
      </form>
    </>
  );
}

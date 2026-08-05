import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import DocumentPreview from "../components/DocumentPreview";
import { batchOptions } from "../data/courseCatalog";
import { paymentMethods, paymentPlans } from "../utils/constants";
import { getEnrollmentTimelineValidationMessage, getTodayIsoDate } from "../utils/enrollmentDateValidation";
import {
  aadhaarFileAccept,
  extractPdfTextFromSource,
  fileToDataUrl,
  imageFileAccept,
  isImageSource,
  isPdfSource,
} from "../utils/fileHelpers";
import { formatCurrency } from "../utils/formatters";
import { resolveNextDueDate } from "../utils/paymentHelpers";
import { fetchStudentIntakeRequest, submitStudentIntakeRequest } from "../services/studentIntakeService";

const currentActivityOptions = ["Student", "Working"];
const allowedImageExtensions = [".png", ".jpg", ".jpeg"];
const allowedImageMimeTypes = new Set(["image/png", "image/jpeg"]);
const allowedAadhaarExtensions = [".png", ".jpg", ".jpeg", ".pdf"];
const allowedAadhaarMimeTypes = new Set(["image/png", "image/jpeg", "application/pdf"]);
const formPanelClass = "rounded-[32px] border border-rose-100/90 bg-[linear-gradient(145deg,rgba(255,244,247,0.98),rgba(255,232,240,0.94))] shadow-[0_24px_60px_rgba(15,23,42,0.10)]";
const fieldSurfaceClasses = {
  full_name: "border-violet-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,243,255,0.94))] shadow-[0_10px_24px_rgba(139,92,246,0.08)]",
  email: "border-emerald-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(236,253,245,0.94))] shadow-[0_10px_24px_rgba(16,185,129,0.08)]",
  phone: "border-cyan-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(236,254,255,0.94))] shadow-[0_10px_24px_rgba(34,211,238,0.08)]",
  alternate_phone: "border-orange-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,247,237,0.94))] shadow-[0_10px_24px_rgba(249,115,22,0.08)]",
  college_name: "border-indigo-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(238,242,255,0.94))] shadow-[0_10px_24px_rgba(99,102,241,0.08)]",
  current_activity: "border-amber-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,251,235,0.94))] shadow-[0_10px_24px_rgba(245,158,11,0.08)]",
  place: "border-rose-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,241,242,0.94))] shadow-[0_10px_24px_rgba(244,63,94,0.07)]",
  course_name: "border-teal-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,253,250,0.94))] shadow-[0_10px_24px_rgba(20,184,166,0.08)]",
  lead_date: "border-sky-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,249,255,0.94))] shadow-[0_10px_24px_rgba(56,189,248,0.08)]",
  batch: "border-lime-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,254,231,0.94))] shadow-[0_10px_24px_rgba(132,204,22,0.08)]",
  enrolled_date: "border-violet-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,243,255,0.94))] shadow-[0_10px_24px_rgba(139,92,246,0.08)]",
  payment_status: "border-emerald-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(236,253,245,0.94))] shadow-[0_10px_24px_rgba(16,185,129,0.08)]",
  payment_plan: "border-cyan-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(236,254,255,0.94))] shadow-[0_10px_24px_rgba(34,211,238,0.08)]",
  payment_method: "border-orange-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,247,237,0.94))] shadow-[0_10px_24px_rgba(249,115,22,0.08)]",
  total_fee: "border-indigo-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(238,242,255,0.94))] shadow-[0_10px_24px_rgba(99,102,241,0.08)]",
  amount_paid: "border-amber-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,251,235,0.94))] shadow-[0_10px_24px_rgba(245,158,11,0.08)]",
  remaining_amount: "border-rose-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,241,242,0.94))] shadow-[0_10px_24px_rgba(244,63,94,0.07)]",
  last_payment_date: "border-sky-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,249,255,0.94))] shadow-[0_10px_24px_rgba(56,189,248,0.08)]",
  installments_planned: "border-lime-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,254,231,0.94))] shadow-[0_10px_24px_rgba(132,204,22,0.08)]",
  installment_amount: "border-teal-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,253,250,0.94))] shadow-[0_10px_24px_rgba(20,184,166,0.08)]",
  next_due_date: "border-fuchsia-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,245,255,0.94))] shadow-[0_10px_24px_rgba(217,70,239,0.07)]",
  guardian_name: "border-blue-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,246,255,0.94))] shadow-[0_10px_24px_rgba(59,130,246,0.08)]",
  guardian_relation: "border-lime-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,254,231,0.94))] shadow-[0_10px_24px_rgba(132,204,22,0.08)]",
  guardian_phone: "border-orange-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,247,237,0.94))] shadow-[0_10px_24px_rgba(249,115,22,0.08)]",
  address: "border-fuchsia-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,245,255,0.94))] shadow-[0_10px_24px_rgba(217,70,239,0.07)]",
  remarks: "border-pink-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(253,242,248,0.94))] shadow-[0_10px_24px_rgba(236,72,153,0.07)]",
};

function createBlankForm() {
  return {
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
    course_name: "",
    lead_date: "",
    batch: "",
    enrolled_date: "",
    payment_plan: "One Time",
    payment_method: "UPI",
    total_fee: "",
    amount_paid: "",
    installments_planned: 1,
    installment_amount: "",
    next_due_date: "",
    last_payment_date: "",
    remarks: "",
  };
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

function normalizeInstallmentsCount(value, fallback = 1) {
  const count = Number(value || 0);
  return count > 0 ? count : fallback;
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

function extractAadhaarNumberFromText(value) {
  const text = String(value || "");
  const groupedMatch = text.match(/\b\d{4}\s\d{4}\s\d{4}\b/);
  if (groupedMatch) {
    return groupedMatch[0].replace(/\D/g, "");
  }

  const continuousMatch = text.match(/\b\d{12}\b/);
  if (continuousMatch) {
    return continuousMatch[0].replace(/\D/g, "");
  }

  return "";
}

function loadImageStatsFromDataUrl(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth || image.width || 0;
      const height = image.naturalHeight || image.height || 0;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });

      if (!context || !width || !height) {
        resolve({
          width,
          height,
          aspectRatio: width && height ? width / height : 0,
          whiteRatio: 0,
          vividRatio: 0,
        });
        return;
      }

      const sampleWidth = Math.min(120, width);
      const sampleHeight = Math.max(1, Math.round((sampleWidth / Math.max(width, 1)) * height));
      canvas.width = sampleWidth;
      canvas.height = sampleHeight;
      context.drawImage(image, 0, 0, sampleWidth, sampleHeight);

      const { data } = context.getImageData(0, 0, sampleWidth, sampleHeight);
      let whitePixels = 0;
      let vividPixels = 0;
      const totalPixels = Math.max(data.length / 4, 1);

      for (let index = 0; index < data.length; index += 4) {
        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];
        const maxChannel = Math.max(red, green, blue);
        const minChannel = Math.min(red, green, blue);
        const spread = maxChannel - minChannel;

        if (red >= 238 && green >= 238 && blue >= 238) {
          whitePixels += 1;
        }

        if (spread >= 28 && maxChannel <= 245) {
          vividPixels += 1;
        }
      }

      resolve({
        width,
        height,
        aspectRatio: width && height ? width / height : 0,
        whiteRatio: whitePixels / totalPixels,
        vividRatio: vividPixels / totalPixels,
      });
    };
    image.onerror = () => reject(new Error("Unable to read the uploaded image."));
    image.src = source;
  });
}

async function validateStudentPhotoFile(file) {
  const source = await fileToDataUrl(file);
  const stats = await loadImageStatsFromDataUrl(source);
  const portraitLike = stats.aspectRatio >= 0.6 && stats.aspectRatio <= 1.35;
  const looksLikeDocument = stats.whiteRatio >= 0.52 && stats.vividRatio <= 0.18;
  const looksLikeTallScreenshot = stats.aspectRatio > 0 && stats.aspectRatio <= 0.52;

  if (!portraitLike || looksLikeDocument || looksLikeTallScreenshot) {
    throw new Error("Student photo must be a clear face photo only. Document pages, letters, and screenshots are not allowed.");
  }

  return source;
}

async function validateAadhaarFile(file) {
  const source = await fileToDataUrl(file);

  if (isPdfSource(source)) {
    const extractedText = await extractPdfTextFromSource(source);
    const normalizedText = String(extractedText || "").toLowerCase();
    const hasAadhaarKeyword = ["aadhaar", "aadhar", "uidai", "government of india"].some((keyword) => normalizedText.includes(keyword));
    const aadhaarNumber = extractAadhaarNumberFromText(extractedText);

    if (!hasAadhaarKeyword && !aadhaarNumber) {
      throw new Error("Aadhaar upload must be an Aadhaar image or Aadhaar PDF only.");
    }

    return source;
  }

  const stats = await loadImageStatsFromDataUrl(source);
  const looksLikeTallScreenshot = stats.aspectRatio > 0 && stats.aspectRatio <= 0.52;
  const looksLikeInterfaceCapture = stats.whiteRatio <= 0.18 && stats.vividRatio <= 0.12;

  if (looksLikeTallScreenshot || looksLikeInterfaceCapture) {
    throw new Error("Aadhaar upload must be an Aadhaar image or Aadhaar PDF only. Screenshots and unrelated images are not allowed.");
  }

  return source;
}

function buildFormFromRequest(data) {
  const student = data?.student || {};
  const enrollment = data?.enrollment || {};
  const course = data?.course || {};
  const paymentPlan = enrollment.payment_plan && enrollment.payment_plan !== "Pending" ? enrollment.payment_plan : "One Time";
  const totalFee = String(enrollment.total_fee || course.fee || "");
  const amountPaid = String(enrollment.amount_paid || 0);
  const installmentsPlanned = Number(enrollment.installments_planned || (paymentPlan === "EMI" ? 3 : 1));

  return {
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
    course_name: course.course_name || enrollment.course_name || "",
    lead_date: enrollment.lead_date || getTodayIsoDate(),
    batch: enrollment.batch || "",
    enrolled_date: enrollment.enrolled_date || getTodayIsoDate(),
    payment_plan: paymentPlan,
    payment_method: enrollment.payment_method && enrollment.payment_method !== "Pending" ? enrollment.payment_method : "UPI",
    total_fee: totalFee,
    amount_paid: amountPaid,
    installments_planned: installmentsPlanned,
    installment_amount: calculateInstallmentAmount(totalFee, amountPaid, paymentPlan, installmentsPlanned),
    next_due_date: enrollment.next_due_date || "",
    last_payment_date: enrollment.last_payment_date || "",
    remarks: enrollment.remarks || "",
  };
}

function LabeledField({ label, children }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-700">{label}</p>
      {children}
    </div>
  );
}

export default function StudentIntakePage() {
  const { enrollmentId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [requestData, setRequestData] = useState(null);
  const [form, setForm] = useState(createBlankForm);
  const [photoFile, setPhotoFile] = useState(null);
  const [aadhaarFile, setAadhaarFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [aadhaarPreview, setAadhaarPreview] = useState("");
  const todayIsoDate = getTodayIsoDate();

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!enrollmentId || !token) {
        setError("This student form link is incomplete.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await fetchStudentIntakeRequest({ enrollmentId, token });
        if (!active) return;

        setRequestData(data);
        setForm(buildFormFromRequest(data));
        setPhotoPreview(data.student?.photo_url || "");
        setAadhaarPreview(data.student?.aadhaar_document_url || "");
        setError("");
      } catch (requestError) {
        if (active) {
          setError(requestError.message || "Unable to open the student form.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [enrollmentId, token]);

  const selectedCourse = requestData?.course || null;
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

  const summary = useMemo(() => ({
    courseName: requestData?.course?.course_name || requestData?.enrollment?.course_name || form.course_name || "Selected Course",
    batch: requestData?.enrollment?.batch || requestData?.course?.batch || "Pending",
    email: requestData?.student?.email || form.email || "",
  }), [form.course_name, form.email, requestData]);

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

  const handleStudentPhotoChange = async (file) => {
    if (!file) return;

    try {
      setError("");
      assertAllowedFileType(file, "Student photo", {
        mimeTypes: allowedImageMimeTypes,
        extensions: allowedImageExtensions,
        allowedLabel: "a PNG, JPG, or JPEG image",
      });
      const previewSource = await validateStudentPhotoFile(file);
      setPhotoFile(file);
      setPhotoPreview(previewSource);
    } catch (fileError) {
      setPhotoFile(null);
      setError(fileError.message || "Unable to upload student photo.");
    }
  };

  const handleAadhaarChange = async (file) => {
    if (!file) return;

    try {
      setError("");
      assertAllowedFileType(file, "Aadhaar upload", {
        mimeTypes: allowedAadhaarMimeTypes,
        extensions: allowedAadhaarExtensions,
        allowedLabel: "a PNG, JPG, JPEG, or PDF file",
      });
      const previewSource = await validateAadhaarFile(file);
      setAadhaarFile(file);
      setAadhaarPreview(previewSource);
    } catch (fileError) {
      setAadhaarFile(null);
      setError(fileError.message || "Unable to upload Aadhaar document.");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    try {
      const timelineValidationMessage = getEnrollmentTimelineValidationMessage({
        leadDate: form.lead_date,
        enrolledDate: form.enrolled_date,
        lastPaymentDate: form.last_payment_date,
        nextDueDate: form.payment_plan === "EMI" ? form.next_due_date : "",
        paymentPlan: form.payment_plan,
        pipelineStage: "Enrolled",
        requireLeadDate: true,
        requireEnrolledDate: true,
        today: todayIsoDate,
      });

      if (timelineValidationMessage) {
        throw new Error(timelineValidationMessage);
      }

      if (!form.full_name.trim()) throw new Error("Student name is required.");
      if (!form.email.trim()) throw new Error("Email is required.");
      if (!form.phone.trim()) throw new Error("Phone number is required.");
      if (!form.current_activity.trim()) throw new Error("Please select current activity.");
      if (!form.batch.trim()) throw new Error("Batch is required.");
      if (totalFeeValue <= 0) throw new Error("Course fee must be greater than 0.");
      if (amountPaidValue > totalFeeValue) throw new Error("Amount paid cannot exceed the course fee.");
      if (!photoPreview || !aadhaarPreview) throw new Error("Student photo and Aadhaar upload are required.");
      if (!isImageSource(photoPreview)) throw new Error("Student photo must be a PNG, JPG, or JPEG image.");
      if (amountPaidValue > 0 && !form.last_payment_date) throw new Error("Last payment date is required when amount paid is greater than zero.");
      if (form.payment_plan === "EMI" && Number(form.installments_planned || 0) <= 0) {
        throw new Error("Number of installments must be greater than zero for EMI payments.");
      }
      if (form.payment_plan === "EMI" && amountPaidValue > 0 && !form.next_due_date) {
        throw new Error("Next due date is required after recording an EMI payment.");
      }

      setSubmitting(true);
      const studentPhotoDataUrl = photoFile ? await fileToDataUrl(photoFile) : photoPreview;
      const aadhaarDataUrl = aadhaarFile ? await fileToDataUrl(aadhaarFile) : aadhaarPreview;

      await submitStudentIntakeRequest({
        enrollmentId,
        token,
        submission: {
          student: {
            full_name: form.full_name.trim(),
            email: form.email.trim().toLowerCase(),
            phone: form.phone.trim(),
            alternate_phone: form.alternate_phone.trim(),
            college_name: form.college_name.trim(),
            current_activity: form.current_activity.trim(),
            place: form.place.trim(),
            address: form.address.trim(),
            guardian_name: form.guardian_name.trim(),
            guardian_relation: form.guardian_relation.trim(),
            guardian_phone: form.guardian_phone.trim(),
          },
          enrollment: {
            course_name: form.course_name.trim(),
            lead_date: form.lead_date,
            batch: form.batch.trim(),
            enrolled_date: form.enrolled_date,
            payment_status: paymentStatusValue,
            payment_plan: form.payment_plan,
            payment_method: form.payment_method,
            total_fee: totalFeeValue,
            amount_paid: amountPaidValue,
            installments_planned: form.payment_plan === "EMI" ? Number(form.installments_planned || 0) : 1,
            installment_amount: Number(form.payment_plan === "EMI" ? form.installment_amount || 0 : 0),
            next_due_date: form.payment_plan === "EMI" ? form.next_due_date : "",
            last_payment_date: amountPaidValue > 0 ? form.last_payment_date : "",
            remarks: form.remarks.trim(),
          },
          documents: [
            {
              document_type: "Student Photo",
              file_url: studentPhotoDataUrl,
              remarks: `Student self-submitted photo: ${(photoFile?.name || "existing photo").trim()}`,
            },
            {
              document_type: "Aadhaar ID Photo",
              file_url: aadhaarDataUrl,
              remarks: `Student self-submitted Aadhaar: ${(aadhaarFile?.name || "existing Aadhaar").trim()}`,
            },
          ],
        },
      });

      setSuccessMessage("Your enrollment form has been submitted successfully.");
    } catch (submitError) {
      setError(submitError.message || "Unable to submit the student form.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
        <div className="panel w-full max-w-lg px-8 py-12 text-center">
          <h1 className="text-3xl font-semibold text-slate-950">Student Form</h1>
          <p className="mt-3 text-sm text-slate-600">Loading enrollment form...</p>
        </div>
      </div>
    );
  }

  if (error && !requestData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
        <div className="panel w-full max-w-xl px-8 py-12 text-center">
          <h1 className="text-3xl font-semibold text-slate-950">Student Form</h1>
          <p className="mt-4 text-sm font-semibold text-rose-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl">
        <section className={`mb-6 p-6 ${formPanelClass}`}>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">Complete Admission</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-slate-950">Student Form</h1>
          <p className="mt-3 text-sm text-slate-600">
            Complete the same enrollment details shared by the admissions team and upload the required documents.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-sky-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,249,255,0.94))] p-4 shadow-[0_10px_24px_rgba(56,189,248,0.08)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Course</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{summary.courseName}</p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(236,253,245,0.94))] p-4 shadow-[0_10px_24px_rgba(16,185,129,0.08)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Batch</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{summary.batch}</p>
            </div>
            <div className="rounded-2xl border border-violet-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,243,255,0.94))] p-4 shadow-[0_10px_24px_rgba(139,92,246,0.08)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Email</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{summary.email || "Pending"}</p>
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className={`${formPanelClass} p-6`}>
            <h2 className="section-title">Student Details</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <input
                value={form.full_name}
                onChange={(event) => updateForm("full_name", event.target.value)}
                placeholder="Student name"
                required
                className={fieldSurfaceClasses.full_name}
              />
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateForm("email", event.target.value)}
                placeholder="Email"
                required
                className={fieldSurfaceClasses.email}
              />
              <input
                value={form.phone}
                onChange={(event) => updateForm("phone", event.target.value)}
                placeholder="Phone"
                required
                className={fieldSurfaceClasses.phone}
              />
              <select
                value={form.current_activity}
                onChange={(event) => updateForm("current_activity", event.target.value)}
                required
                className={fieldSurfaceClasses.current_activity}
              >
                <option value="">I am a</option>
                {currentActivityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <input
                value={form.place}
                onChange={(event) => updateForm("place", event.target.value)}
                placeholder="City"
                required
                className={fieldSurfaceClasses.place}
              />
              <input
                value={form.course_name}
                onChange={(event) => updateForm("course_name", event.target.value)}
                placeholder="Course"
                readOnly
                className={fieldSurfaceClasses.course_name}
              />
            </div>
          </section>

          <section className={`${formPanelClass} p-6`}>
            <h2 className="section-title">Admission Details</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <LabeledField label="Lead Date *">
                <input
                  type="date"
                  value={form.lead_date}
                  max={todayIsoDate}
                  onChange={(event) => updateForm("lead_date", event.target.value)}
                  required
                  className={fieldSurfaceClasses.lead_date}
                />
              </LabeledField>
              <LabeledField label="Batch *">
                <select value={form.batch} onChange={(event) => updateForm("batch", event.target.value)} required className={fieldSurfaceClasses.batch}>
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
                  className={fieldSurfaceClasses.enrolled_date}
                />
              </LabeledField>
              <LabeledField label="Payment Status *">
                <input value={paymentStatusValue} readOnly aria-label="Payment Status" className={fieldSurfaceClasses.payment_status} />
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
                  className={fieldSurfaceClasses.payment_plan}
                >
                  {paymentPlans.filter((item) => item !== "Pending").map((plan) => (
                    <option key={plan} value={plan}>
                      {plan}
                    </option>
                  ))}
                </select>
              </LabeledField>
            </div>
          </section>

          <section className={`${formPanelClass} p-6`}>
            <h2 className="section-title">Payment Details</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <LabeledField label="Payment Method *">
                <select value={form.payment_method} onChange={(event) => updateForm("payment_method", event.target.value)} required className={fieldSurfaceClasses.payment_method}>
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
                  value={form.total_fee}
                  onChange={(event) => syncPaymentFields({ total_fee: event.target.value })}
                  placeholder="Enter total course fee"
                  required
                  className={fieldSurfaceClasses.total_fee}
                />
              </LabeledField>
              <LabeledField label="Amount Paid (Rs) *">
                <input
                  type="number"
                  min="0"
                  max={form.total_fee || undefined}
                  value={form.amount_paid}
                  onChange={(event) => syncPaymentFields({ amount_paid: event.target.value })}
                  placeholder="Enter amount paid"
                  required
                  className={fieldSurfaceClasses.amount_paid}
                />
              </LabeledField>
              <LabeledField label="Remaining Amount (Rs)">
                <input value={String(remainingAmountValue)} readOnly aria-label="Remaining Amount" className={fieldSurfaceClasses.remaining_amount} />
              </LabeledField>
              <LabeledField label="Last Payment Date">
                <input
                  type="date"
                  value={form.last_payment_date}
                  max={todayIsoDate}
                  onChange={(event) => syncPaymentFields({ last_payment_date: event.target.value })}
                  className={fieldSurfaceClasses.last_payment_date}
                />
              </LabeledField>
              {form.payment_plan === "EMI" ? (
                <>
                  <LabeledField label="Number of Installments">
                    <input
                      type="number"
                      min="1"
                        value={form.installments_planned}
                        onChange={(event) => syncPaymentFields({ installments_planned: event.target.value })}
                        placeholder="Example: 4"
                        required
                        className={fieldSurfaceClasses.installments_planned}
                      />
                    </LabeledField>
                    <LabeledField label="Installment Amount (Rs)">
                      <input
                        type="number"
                        value={form.installment_amount}
                        placeholder="Calculated automatically"
                        readOnly
                        className={fieldSurfaceClasses.installment_amount}
                      />
                    </LabeledField>
                    <LabeledField label="Next Due Date">
                      <input
                        type="date"
                        value={form.next_due_date}
                        onChange={(event) => updateForm("next_due_date", event.target.value)}
                        className={fieldSurfaceClasses.next_due_date}
                      />
                    </LabeledField>
                </>
              ) : null}
            </div>

            {selectedCourse ? (
              <p className="mt-4 text-sm font-semibold text-brand-500">Selected fee: {formatCurrency(form.total_fee || selectedCourse.fee)}</p>
            ) : null}
          </section>

          <section className={`${formPanelClass} p-6`}>
            <h2 className="section-title">Document Uploads</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
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
            </div>
          </section>

          <section className={`${formPanelClass} p-6`}>
            <h2 className="section-title">Notes</h2>
            <div className="mt-6">
              <textarea
                rows="5"
                className={`w-full ${fieldSurfaceClasses.remarks}`}
                value={form.remarks}
                onChange={(event) => updateForm("remarks", event.target.value)}
                placeholder="Enter remarks about the student (optional)"
              />
            </div>
          </section>

          {error ? <p className="text-sm font-semibold text-brand-500">{error}</p> : null}
          {successMessage ? <p className="text-sm font-semibold text-emerald-600">{successMessage}</p> : null}

          <div className="flex flex-wrap gap-3">
            <button type="submit" className="button-primary" disabled={submitting || Boolean(successMessage)}>
              {submitting ? "Submitting..." : successMessage ? "Submitted" : "Complete Enrollment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import DocumentPreview from "../components/DocumentPreview";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import StudentAvatar from "../components/StudentAvatar";
import Timeline from "../components/Timeline";
import { useApp } from "../context/AppContext";
import { normalizeBatchName } from "../data/courseCatalog";
import { openEnrollmentPdf } from "../services/pdfServiceFixed";
import {
  getEnrollmentTimelineValidationErrors,
  getTodayIsoDate,
} from "../utils/enrollmentDateValidation";
import { getDocumentSourceKind } from "../utils/fileHelpers";
import { formatCurrency, formatDate } from "../utils/formatters";
import { toIsoDate } from "../utils/dateMath";
import {
  formatPaymentTypeDisplay,
  inferPaymentPlan,
  normalizeDiscountType,
  normalizePaymentHistoryList,
  resolveDiscountAmount,
  resolveAmountPaid,
  resolveLastPaymentDate,
  resolveNextDueDate,
  resolvePayableFee,
  resolveRemainingAmount,
  toNumberOrNull,
} from "../utils/paymentHelpers";

function DetailCard({ label, value }) {
  const hasDisplayValue = value !== null && value !== undefined && String(value).trim() !== "";

  return (
    <div className="min-w-0 overflow-hidden rounded-[24px] border border-slate-200 bg-surface-50 p-4">
      <p className="surface-label">{label}</p>
      <p className="mt-2 min-w-0 text-base font-semibold leading-snug text-slate-900 [overflow-wrap:anywhere]">
        {hasDisplayValue ? value : "N/A"}
      </p>
    </div>
  );
}

function PaymentHistoryMetric({ label, value }) {
  const hasDisplayValue = value !== null && value !== undefined && String(value).trim() !== "";

  return (
    <div className="min-w-0 rounded-[18px] border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 min-w-0 text-base font-semibold leading-snug text-slate-900 [overflow-wrap:anywhere]">
        {hasDisplayValue ? value : "N/A"}
      </p>
    </div>
  );
}

function EditField({ label, children }) {
  return (
    <label className="block">
      <p className="mb-2 text-sm font-semibold text-slate-700">{label}</p>
      {children}
    </label>
  );
}

function formatCurrencyValue(value) {
  return value === null || value === undefined ? "N/A" : formatCurrency(value);
}

function deriveOriginalFeeFromPayable(payableFee, discountType = "", discountValue = 0) {
  const payableValue = toNumberOrNull(payableFee);
  const value = toNumberOrNull(discountValue);
  const normalizedType = normalizeDiscountType(discountType);

  if (payableValue === null || value === null || value <= 0 || !normalizedType) return null;

  if (normalizedType === "Amount") {
    return payableValue + value;
  }

  const percentage = Math.min(value, 100);
  if (percentage <= 0 || percentage >= 100) return null;

  return Math.round(payableValue / (1 - percentage / 100));
}

function stripSystemVerificationLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (line.startsWith("Aadhaar verification:")) return false;
      if (line.includes("Manual verification required.")) return false;
      if (line.includes("Image Aadhaar uploaded.")) return false;
      if (line.includes("Aadhaar could not be auto-verified.")) return false;
      return true;
    })
    .join("\n")
    .trim();
}

function normalizeNoteSegment(value = "") {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function dedupeEnrollmentNoteSegments(value = "") {
  const seenSegments = new Set();

  return String(value || "")
    .split("|")
    .map((segment) => segment.trim())
    .filter((segment) => {
      if (!segment) return false;

      const normalizedSegment = normalizeNoteSegment(segment);
      if (seenSegments.has(normalizedSegment)) return false;

      seenSegments.add(normalizedSegment);
      return true;
    })
    .join(" | ");
}

function getVisibleEnrollmentNote(enrollmentRemarks, studentNotes) {
  const cleanedEnrollmentRemarks = dedupeEnrollmentNoteSegments(stripSystemVerificationLines(enrollmentRemarks));
  if (cleanedEnrollmentRemarks) return cleanedEnrollmentRemarks;

  const cleanedStudentNotes = dedupeEnrollmentNoteSegments(stripSystemVerificationLines(studentNotes));
  if (cleanedStudentNotes) return cleanedStudentNotes;

  return "No remarks added.";
}

function buildProfileForm(student = {}, enrollment = {}) {
  return {
    student_code: student?.student_code || "",
    full_name: student?.full_name || "",
    phone: student?.phone || "",
    email: student?.email || "",
    current_activity: student?.current_activity || "",
    place: student?.place || "",
    remarks: dedupeEnrollmentNoteSegments(stripSystemVerificationLines(enrollment?.remarks || "")),
  };
}

function buildTimelineDateForm(enrollment = {}) {
  return {
    lead_date: toIsoDate(enrollment?.lead_date || enrollment?.created_at || "") || "",
    enrolled_date: toIsoDate(enrollment?.enrolled_date || "") || "",
    last_payment_date: toIsoDate(enrollment?.last_payment_date || "") || "",
    next_due_date: toIsoDate(enrollment?.next_due_date || "") || "",
  };
}

function PreviewModal({ preview, onClose }) {
  if (!preview) return null;
  const previewKind = getDocumentSourceKind(preview.src);
  const supportsZoom = previewKind === "image";
  const zoomLevels = [100, 125, 150, 200, 250, 300];
  const [zoom, setZoom] = useState(zoomLevels[0]);
  const zoomIndex = zoomLevels.indexOf(zoom);
  const canZoomOut = zoomIndex > 0;
  const canZoomIn = zoomIndex < zoomLevels.length - 1;

  useEffect(() => {
    setZoom(zoomLevels[0]);
  }, [preview?.src]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" onClick={onClose} role="presentation">
      <div
        className="relative max-h-[92vh] w-full max-w-5xl rounded-[28px] bg-white p-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={preview.title}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="font-semibold text-slate-900">{preview.title}</p>
          <div className="flex items-center gap-3">
            {supportsZoom ? (
              <>
                <button
                  type="button"
                  className="button-secondary disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => canZoomOut && setZoom(zoomLevels[zoomIndex - 1])}
                  disabled={!canZoomOut}
                >
                  -
                </button>
                <button type="button" className="button-secondary" onClick={() => setZoom(zoomLevels[0])}>
                  {zoom}%
                </button>
                <button
                  type="button"
                  className="button-secondary disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => canZoomIn && setZoom(zoomLevels[zoomIndex + 1])}
                  disabled={!canZoomIn}
                >
                  +
                </button>
              </>
            ) : null}
            <button type="button" className="button-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        {supportsZoom ? (
          <div className="max-h-[76vh] min-h-[420px] w-full overflow-auto rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex min-h-full min-w-full items-start justify-center">
              <img
                src={preview.src}
                alt={preview.title}
                style={{ width: `${zoom}%`, maxWidth: "none" }}
                className="h-auto rounded-[24px] border border-slate-200 bg-white shadow-sm"
              />
            </div>
          </div>
        ) : (
          <DocumentPreview
            src={preview.src}
            alt={preview.title}
            title={preview.title}
            enablePdfZoom
            className="max-h-[76vh] min-h-[420px] w-full rounded-[24px] border border-slate-200 bg-slate-50 object-contain"
          />
        )}
      </div>
    </div>
  );
}

export default function StudentProfilePageFixed() {
  const { id } = useParams();
  const { portalRecords, emailLogs, logEmail, updateStudentProfile } = useApp();
  const [preview, setPreview] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [sendingEmailAction, setSendingEmailAction] = useState("");
  const [profileForm, setProfileForm] = useState(() => buildProfileForm());
  const [editingTimelineDates, setEditingTimelineDates] = useState(false);
  const [savingTimelineDates, setSavingTimelineDates] = useState(false);
  const [timelineDateError, setTimelineDateError] = useState("");
  const [timelineDateForm, setTimelineDateForm] = useState(() => buildTimelineDateForm());

  const record = portalRecords.find((item) => item.student.id === id);
  const student = record?.student;
  const enrollment = record?.enrollment;
  const course = record?.course;
  const docs = record?.documents || [];
  const studentPhotoUrl = student?.photo_url || docs.find((doc) => doc.document_type === "Student Photo")?.file_url || "";
  const aadhaarDocumentUrl = student?.aadhaar_document_url || docs.find((doc) => doc.document_type === "Aadhaar ID Photo")?.file_url || "";
  const emails = emailLogs.filter((item) => item.enrollment_id === enrollment?.id);
  const isPreEnrollment = Boolean(record?.isEnquiryRecord);
  const todayIsoDate = getTodayIsoDate();

  const normalized = useMemo(() => {
    if (!record || !student || !enrollment) return null;

    const savedPayableFee = toNumberOrNull(enrollment.total_fee) ?? 0;
    const catalogFee = toNumberOrNull(course?.fee);
    const storedOriginalFee = toNumberOrNull(enrollment.original_fee);
    const hasStoredDiscount = Boolean(enrollment.discount_type && toNumberOrNull(enrollment.discount_value));
    const storedDiscountAmount = toNumberOrNull(enrollment.discount_amount);
    const derivedOriginalFee = deriveOriginalFeeFromPayable(
      savedPayableFee,
      enrollment.discount_type,
      enrollment.discount_value,
    );
    const catalogDiscountAmount = catalogFee && savedPayableFee && catalogFee > savedPayableFee
      ? catalogFee - savedPayableFee
      : 0;
    const originalFee = (() => {
      if (
        hasStoredDiscount
        && derivedOriginalFee !== null
        && savedPayableFee
        && (storedOriginalFee === null || storedOriginalFee <= savedPayableFee)
      ) {
        return derivedOriginalFee;
      }
      if (catalogDiscountAmount && (storedOriginalFee === null || storedOriginalFee <= savedPayableFee)) return catalogFee;
      if (storedDiscountAmount && savedPayableFee && (storedOriginalFee === null || storedOriginalFee <= savedPayableFee)) {
        return savedPayableFee + storedDiscountAmount;
      }
      if (storedOriginalFee !== null) return storedOriginalFee;
      if (catalogFee !== null && (!savedPayableFee || catalogFee >= savedPayableFee)) return catalogFee;
      if (hasStoredDiscount && derivedOriginalFee !== null) return derivedOriginalFee;
      return savedPayableFee;
    })();
    const calculatedDiscountAmount = resolveDiscountAmount(
      originalFee,
      enrollment.discount_type,
      enrollment.discount_value,
    );
    const discountAmount = calculatedDiscountAmount || storedDiscountAmount || catalogDiscountAmount;
    const courseFee = savedPayableFee || resolvePayableFee(originalFee, enrollment.discount_type, enrollment.discount_value) || 0;
    const amountPaid = resolveAmountPaid(enrollment.amount_paid, enrollment.payment_history);
    const currentStage = record.currentStage;
    const paymentPlan = inferPaymentPlan({
      paymentPlan: enrollment.payment_plan || "",
      installmentsPlanned: enrollment.installments_planned || 0,
      history: enrollment.payment_history,
      amountPaid,
    });
    const installmentsPlanned = Number(enrollment.installments_planned) || (paymentPlan === "EMI" ? 3 : paymentPlan ? 1 : 0);
    const paymentHistory = normalizePaymentHistoryList(enrollment.payment_history, {
      totalFee: courseFee,
      paymentPlan,
      paymentMethod: enrollment.payment_method || "",
      installmentsPlanned,
      amountPaid,
    });
    const latestPayment = paymentHistory[0] || null;
    const paymentMethod = enrollment.payment_method || latestPayment?.payment_method || latestPayment?.mode || "";
    const lastPaymentDate = resolveLastPaymentDate({
      lastPaymentDate: enrollment.last_payment_date || "",
      history: paymentHistory,
      amountPaid,
      enrolledDate: enrollment.enrolled_date || "",
      leadDate: enrollment.lead_date || enrollment.created_at || "",
    });
    const remainingAmount = resolveRemainingAmount(courseFee, amountPaid);
    const nextDueDate = resolveNextDueDate({
      paymentStatus: enrollment.payment_status || "",
      paymentPlan,
      lastPaymentDate,
      history: paymentHistory,
    });
    const installmentsPaid = Number(enrollment.installments_paid) || latestPayment?.installments_paid || (paymentPlan === "EMI" ? paymentHistory.length : amountPaid > 0 ? 1 : 0);
    const remainingInstallments = paymentPlan === "EMI"
      ? Math.max(installmentsPlanned - installmentsPaid, 0)
      : 0;
    const installmentAmount = paymentPlan === "EMI"
      ? (remainingInstallments > 0 ? Math.round((remainingAmount || 0) / remainingInstallments) : 0)
      : 0;

    return {
      currentStage,
      courseFee,
      originalFee,
      discountAmount,
      amountPaid,
      remainingAmount,
      installmentAmount,
      remainingInstallments,
      paymentHistory,
      student: {
        ...student,
        photo_url: studentPhotoUrl,
        aadhaar_document_url: aadhaarDocumentUrl,
      },
      enrollment: {
        ...enrollment,
        lead_date: enrollment.lead_date || enrollment.created_at || "",
        enrolled_date: enrollment.enrolled_date || "",
        payment_plan: paymentPlan,
        payment_method: paymentMethod,
        total_fee: courseFee,
        original_fee: originalFee,
        discount_type: enrollment.discount_type || "",
        discount_value: enrollment.discount_value || 0,
        discount_amount: discountAmount,
        amount_paid: amountPaid,
        installments_planned: installmentsPlanned,
        installments_paid: installmentsPaid,
        installment_amount: installmentAmount,
        next_due_date: nextDueDate,
        last_payment_date: lastPaymentDate,
        payment_history: paymentHistory,
        enrollment_status: enrollment.enrollment_status || (currentStage === "Enrolled" ? "Active" : currentStage === "Dropout" ? "Dropped" : "Follow-up"),
      },
    };
  }, [aadhaarDocumentUrl, course?.fee, enrollment, record?.currentStage, student, studentPhotoUrl]);
  const timelineValidationErrors = useMemo(() => {
    if (!enrollment) return {};

    return getEnrollmentTimelineValidationErrors({
      leadDate: enrollment.lead_date || enrollment.created_at || "",
      enrolledDate: enrollment.enrolled_date || "",
      followUpDate: enrollment.follow_up_date || "",
      lastPaymentDate: enrollment.last_payment_date || "",
      nextDueDate: enrollment.next_due_date || "",
      paymentPlan: enrollment.payment_plan || "",
      pipelineStage: record?.currentStage || enrollment.pipeline_stage || "",
      requireLeadDate: true,
      requireEnrolledDate: record?.currentStage === "Enrolled",
      today: todayIsoDate,
    });
  }, [enrollment, record?.currentStage, todayIsoDate]);
  const timelineValidationMessages = Object.values(timelineValidationErrors);

  useEffect(() => {
    setProfileForm(buildProfileForm(student, enrollment));
    setEditingProfile(false);
    setProfileError("");
    setTimelineDateForm(buildTimelineDateForm(enrollment));
    setEditingTimelineDates(false);
    setTimelineDateError("");
  }, [student, enrollment]);

  if (!record || !student || !enrollment || !normalized) {
    return (
      <AppShell>
        <EmptyState title="Student not found" description="This profile does not exist in the current portal data." />
      </AppShell>
    );
  }

  const handleSendMail = async () => {
    try {
      setSendingEmailAction("mail");
      await logEmail("Profile Send Mail", normalized.enrollment, {
        logType: "Profile Send Mail",
        successTitle: "Send Mail completed successfully.",
      });
    } finally {
      setSendingEmailAction("");
    }
  };

  const handleSendConfirmation = async () => {
    try {
      setSendingEmailAction("confirmation");
      await logEmail("Admission Confirmation", normalized.enrollment, {
        logType: "Admission Confirmation",
        successTitle: "Send Confirmation completed successfully.",
      });
    } finally {
      setSendingEmailAction("");
    }
  };

  return (
    <AppShell>
      <PreviewModal preview={preview} onClose={() => setPreview(null)} />
      <PageHeader
        eyebrow="Student profile"
        title={student.full_name}
        description="A complete branded view of personal details, payment progress, and student history."
        actions={[
          <button
            key="edit"
            type="button"
            className="button-secondary"
            onClick={() => {
              if (editingProfile) {
                setProfileForm(buildProfileForm(student, enrollment));
                setProfileError("");
                setEditingProfile(false);
                return;
              }
              setProfileError("");
              setEditingProfile(true);
            }}
          >
            {editingProfile ? "Cancel edit" : "Edit profile"}
          </button>,
          <button
            key="send-mail"
            type="button"
            className="button-secondary disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleSendMail}
            disabled={Boolean(sendingEmailAction)}
          >
            {sendingEmailAction === "mail" ? "Sending..." : "Send Mail"}
          </button>,
          <button
            key="confirmation"
            type="button"
            className="button-secondary disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleSendConfirmation}
            disabled={Boolean(sendingEmailAction)}
          >
            {sendingEmailAction === "confirmation" ? "Sending..." : "Send Confirmation"}
          </button>,
          <button
            key="pdf"
            type="button"
            className="button-primary"
            onClick={() =>
              openEnrollmentPdf({
                instituteName: "CERTISURED",
                student: normalized.student,
                course,
                enrollment: normalized.enrollment,
                documents: docs,
              })
            }
          >
            Open PDF
          </button>,
          <Link key="back" to="/records" className="button-secondary">
            Back to students
          </Link>,
        ]}
      />

      {(() => {
        const handleProfileFieldChange = (key, value) => {
          setProfileError("");
          setProfileForm((prev) => ({ ...prev, [key]: value }));
        };

        const handleProfileSave = async () => {
          try {
            setSavingProfile(true);
            setProfileError("");
            await updateStudentProfile({
              studentId: student.id,
              enrollmentId: enrollment.id,
              studentPatch: {
                student_code: profileForm.student_code.trim(),
                full_name: profileForm.full_name,
                phone: profileForm.phone,
                email: profileForm.email,
                current_activity: profileForm.current_activity,
                place: profileForm.place,
              },
              enrollmentPatch: {
                remarks: profileForm.remarks,
              },
            });
            setEditingProfile(false);
          } catch (error) {
            setProfileError(error.message || "Unable to update student profile.");
          } finally {
            setSavingProfile(false);
          }
        };

        const handleTimelineDateChange = (key, value) => {
          setTimelineDateError("");
          setTimelineDateForm((prev) => ({ ...prev, [key]: value }));
        };

        const handleTimelineDateSave = async () => {
          try {
            setSavingTimelineDates(true);
            setTimelineDateError("");
            if (!timelineDateForm.lead_date) {
              throw new Error("Lead date is required.");
            }

            await updateStudentProfile({
              studentId: student.id,
              enrollmentId: enrollment.id,
              enrollmentPatch: {
                lead_date: timelineDateForm.lead_date,
                enrolled_date: timelineDateForm.enrolled_date,
                last_payment_date: timelineDateForm.last_payment_date,
                next_due_date: timelineDateForm.next_due_date,
              },
            });
            setEditingTimelineDates(false);
          } catch (error) {
            setTimelineDateError(error.message || "Unable to update timeline dates.");
          } finally {
            setSavingTimelineDates(false);
          }
        };

        const timelineItems = [
          {
            id: "lead",
            title: "Lead created",
            description: `Initial enquiry recorded for ${course?.course_name || "selected program"}.`,
            date: normalized.enrollment.lead_date,
          },
          normalized.enrollment.enrolled_date
            ? {
              id: "enrolled",
              title: "Enrollment confirmed",
              description: `${student.full_name} moved into the enrolled pipeline.`,
              date: normalized.enrollment.enrolled_date,
            }
            : null,
          normalized.enrollment.last_payment_date
            ? {
              id: "payment",
              title: "Last payment recorded",
              description: `Latest payment method: ${normalized.enrollment.payment_method || "N/A"}.`,
              date: normalized.enrollment.last_payment_date,
            }
            : null,
          normalized.enrollment.next_due_date
            ? {
              id: "due",
              title: "Next payment checkpoint",
              description: `Remaining amount ${formatCurrencyValue(normalized.remainingAmount)} is still open.`,
              date: normalized.enrollment.next_due_date,
            }
            : null,
        ].filter(Boolean);

        return (
          <>
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <section className="panel overflow-hidden p-0">
            <div className="bg-[linear-gradient(135deg,#061f37_0%,#0b3558_55%,#1a5a82_100%)] p-5 md:p-6">
              <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
                <StudentAvatar
                  src={studentPhotoUrl}
                  name={student.full_name}
                  className="h-20 w-20 rounded-[22px] object-cover shadow-[0_16px_34px_rgba(4,23,40,0.25)] md:h-24 md:w-24"
                  fallbackClassName="h-20 w-20 rounded-[22px] shadow-[0_16px_34px_rgba(4,23,40,0.18)] md:h-24 md:w-24"
                  textClassName="text-xl"
                />
                <div className="min-w-0 self-center">
                  <p className="font-display text-2xl font-semibold leading-tight text-white md:text-3xl">{student.full_name}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="panel p-6">
            <h2 className="section-title">Complete profile</h2>
            {editingProfile ? (
              <div className="mt-6 space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <EditField label="Custom student ID">
                    <input value={profileForm.student_code} onChange={(event) => handleProfileFieldChange("student_code", event.target.value)} />
                  </EditField>
                  <EditField label="Student name">
                    <input value={profileForm.full_name} onChange={(event) => handleProfileFieldChange("full_name", event.target.value)} />
                  </EditField>
                  <EditField label="Contact number">
                    <input value={profileForm.phone} onChange={(event) => handleProfileFieldChange("phone", event.target.value)} />
                  </EditField>
                  <EditField label="Email ID">
                    <input type="email" value={profileForm.email} onChange={(event) => handleProfileFieldChange("email", event.target.value)} />
                  </EditField>
                  <EditField label="Currently doing">
                    <input value={profileForm.current_activity} onChange={(event) => handleProfileFieldChange("current_activity", event.target.value)} />
                  </EditField>
                  <EditField label="City">
                    <input value={profileForm.place} onChange={(event) => handleProfileFieldChange("place", event.target.value)} />
                  </EditField>
                </div>
                <EditField label="Enrollment note">
                  <textarea
                    rows="4"
                    className="w-full"
                    value={profileForm.remarks}
                    onChange={(event) => handleProfileFieldChange("remarks", event.target.value)}
                  />
                </EditField>
                <div className="flex flex-wrap gap-3">
                  <button type="button" className="button-primary" onClick={handleProfileSave} disabled={savingProfile}>
                    {savingProfile ? "Saving..." : "Save changes"}
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      setProfileForm(buildProfileForm(student, enrollment));
                      setProfileError("");
                      setEditingProfile(false);
                    }}
                    disabled={savingProfile}
                  >
                    Cancel
                  </button>
                </div>
                {profileError ? <p className="text-sm font-semibold text-brand-500">{profileError}</p> : null}
              </div>
            ) : isPreEnrollment ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-[24px] border border-slate-200 bg-surface-50 p-5">
                  <p className="surface-label">Profile Completion</p>
                  <p className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em] text-slate-950">{record.profileCompletion}%</p>
                  <p className="mt-2 text-sm text-slate-600">This enquiry is still collecting the required admission information.</p>
                  <div className="mt-4 h-2 rounded-full bg-surface-200">
                    <div className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-accent-500" style={{ width: `${record.profileCompletion}%` }} />
                  </div>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-surface-50 p-5">
                  <p className="surface-label">Missing Information</p>
                  {record.missingInformation.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {record.missingInformation.map((item) => (
                        <span key={item} className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-600">Core enquiry information is complete. Continue with admission details to enroll this student.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {timelineValidationMessages.length ? (
                  <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    {timelineValidationMessages.join(" ")}
                  </div>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2">
                  <DetailCard label="Lead date" value={formatDate(normalized.enrollment.lead_date)} />
                  <DetailCard label="Enrolled date" value={formatDate(normalized.enrollment.enrolled_date)} />
                  <DetailCard label="Custom student ID" value={student.student_code} />
                  <DetailCard label="Contact number" value={student.phone} />
                  <DetailCard label="Email ID" value={student.email} />
                  <DetailCard label="City" value={student.place} />
                  <DetailCard label="Currently doing" value={student.current_activity} />
                </div>
              </div>
            )}
          </section>

          <section className="panel p-6">
            <h2 className="section-title">Document previews</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div className="flex h-full flex-col">
                <p className="mb-3 min-h-[3.75rem] text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Student photo</p>
                {studentPhotoUrl ? (
                  <button
                    type="button"
                    className="block w-full flex-1"
                    onClick={() => setPreview({ src: studentPhotoUrl, title: `${student.full_name} photo`, fileName: `${student.full_name}-photo` })}
                  >
                    <DocumentPreview
                      src={studentPhotoUrl}
                      alt={`${student.full_name} photo`}
                      title={`${student.full_name} photo`}
                      fileName={`${student.full_name}-photo`}
                      className="h-56 w-full rounded-[28px] border border-slate-200 bg-slate-50 object-cover"
                    />
                  </button>
                ) : (
                  <DocumentPreview
                    src=""
                    alt="Student photo"
                    title="Student photo"
                    className="h-56 w-full flex-1 rounded-[28px] border border-slate-200 bg-slate-50"
                  />
                )}
              </div>
              <div className="flex h-full flex-col">
                <p className="mb-3 min-h-[3.75rem] text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Aadhaar document</p>
                {aadhaarDocumentUrl ? (
                  <button
                    type="button"
                    className="block w-full flex-1"
                    onClick={() => setPreview({ src: aadhaarDocumentUrl, title: "Aadhaar document", fileName: `${student.full_name}-aadhaar` })}
                  >
                    <DocumentPreview
                      src={aadhaarDocumentUrl}
                      alt="Aadhaar"
                      title="Aadhaar document"
                      fileName={`${student.full_name}-aadhaar`}
                      className="h-56 w-full rounded-[28px] border border-slate-200 bg-slate-50 object-cover"
                    />
                  </button>
                ) : (
                  <DocumentPreview
                    src=""
                    alt="Aadhaar"
                    title="Aadhaar document"
                    className="h-56 w-full flex-1 rounded-[28px] border border-slate-200 bg-slate-50"
                  />
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="panel p-6">
            <h2 className="section-title">Enrollment and payment summary</h2>
            {isPreEnrollment ? (
              <div className="mt-6 rounded-[24px] border border-slate-200 bg-surface-50 p-5">
                <p className="surface-label">Payment Status</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">Payment not initiated</p>
                <p className="mt-2 text-sm text-slate-600">Payment details become available after this enquiry is converted to enrolled status.</p>
              </div>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {normalized.discountAmount > 0 ? (
                  <>
                    <DetailCard label="Original fee" value={formatCurrencyValue(normalized.originalFee)} />
                    <DetailCard label="Discount" value={formatCurrencyValue(normalized.discountAmount)} />
                  </>
                ) : null}
                <DetailCard label={normalized.discountAmount > 0 ? "Final payable fee" : "Course fee"} value={formatCurrencyValue(normalized.courseFee)} />
                <DetailCard label="Amount paid" value={formatCurrencyValue(normalized.amountPaid)} />
                <DetailCard label="Remaining amount" value={formatCurrencyValue(normalized.remainingAmount)} />
                <DetailCard label="Payment type" value={formatPaymentTypeDisplay(normalized.enrollment.payment_plan)} />
                <DetailCard label="Payment method" value={normalized.enrollment.payment_method} />
                <DetailCard
                  label="Installments paid"
                  value={normalized.enrollment.payment_plan === "EMI" ? `${normalized.enrollment.installments_paid || 0}/${normalized.enrollment.installments_planned || 0}` : (normalized.enrollment.payment_plan ? "One time payment" : "N/A")}
                />
                {normalized.enrollment.payment_plan === "EMI" ? (
                  <>
                    <DetailCard label="Remaining installments" value={String(normalized.remainingInstallments)} />
                    <DetailCard label="Installment amount" value={formatCurrencyValue(normalized.installmentAmount)} />
                  </>
                ) : null}
                <DetailCard label="Next due date" value={formatDate(normalized.enrollment.next_due_date)} />
                <DetailCard label="Last payment" value={formatDate(normalized.enrollment.last_payment_date)} />
              </div>
            )}

            <div className="mt-5 rounded-[24px] border border-slate-200 bg-surface-50 p-4">
              <p className="surface-label">Enrollment note</p>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{getVisibleEnrollmentNote(enrollment.remarks, student.notes)}</p>
            </div>

            {enrollment.dropout_reason ? (
              <div className="mt-4 rounded-[24px] border border-brand-200 bg-brand-50 p-4">
                <p className="surface-label">Dropout reason</p>
                <p className="mt-2 text-sm font-semibold text-brand-600">{enrollment.dropout_reason}</p>
              </div>
            ) : null}
          </section>

          <section className="panel p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="section-title">Student timeline</h2>
                <p className="mt-1 text-sm text-slate-600">A concise operational history for this student record.</p>
              </div>
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  if (editingTimelineDates) {
                    setTimelineDateForm(buildTimelineDateForm(enrollment));
                    setTimelineDateError("");
                    setEditingTimelineDates(false);
                    return;
                  }
                  setTimelineDateForm(buildTimelineDateForm(normalized.enrollment));
                  setTimelineDateError("");
                  setEditingTimelineDates(true);
                }}
              >
                {editingTimelineDates ? "Cancel dates" : "Edit dates"}
              </button>
            </div>
            {editingTimelineDates ? (
              <div className="mt-6 space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <EditField label="Lead date">
                    <input
                      type="date"
                      value={timelineDateForm.lead_date}
                      max={todayIsoDate}
                      onChange={(event) => handleTimelineDateChange("lead_date", event.target.value)}
                    />
                  </EditField>
                  <EditField label="Enrolled date">
                    <input
                      type="date"
                      value={timelineDateForm.enrolled_date}
                      max={todayIsoDate}
                      onChange={(event) => handleTimelineDateChange("enrolled_date", event.target.value)}
                    />
                  </EditField>
                  <EditField label="Last payment date">
                    <input
                      type="date"
                      value={timelineDateForm.last_payment_date}
                      max={todayIsoDate}
                      onChange={(event) => handleTimelineDateChange("last_payment_date", event.target.value)}
                    />
                  </EditField>
                  <EditField label="Next due date">
                    <input
                      type="date"
                      value={timelineDateForm.next_due_date}
                      onChange={(event) => handleTimelineDateChange("next_due_date", event.target.value)}
                    />
                  </EditField>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" className="button-primary" onClick={handleTimelineDateSave} disabled={savingTimelineDates}>
                    {savingTimelineDates ? "Saving..." : "Save dates"}
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      setTimelineDateForm(buildTimelineDateForm(normalized.enrollment));
                      setTimelineDateError("");
                      setEditingTimelineDates(false);
                    }}
                    disabled={savingTimelineDates}
                  >
                    Cancel
                  </button>
                </div>
                {timelineDateError ? <p className="text-sm font-semibold text-brand-500">{timelineDateError}</p> : null}
              </div>
            ) : (
              <div className="mt-6">
                <Timeline items={timelineItems} />
              </div>
            )}
          </section>

          <section className="panel p-6">
            <h2 className="section-title">Payment history</h2>
            <div className="mt-5 space-y-4">
              {isPreEnrollment ? (
                <div className="rounded-[24px] border border-slate-200 bg-surface-50 p-4 text-sm text-slate-500">
                  Payment not initiated.
                </div>
              ) : normalized.paymentHistory.length ? normalized.paymentHistory.map((payment) => (
                <div key={payment.id} className="rounded-[24px] border border-slate-200 bg-surface-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-900">{payment.label}</p>
                      <p className="text-sm text-slate-500">
                        {formatDate(payment.date)} - {payment.payment_method || payment.mode || "N/A"}
                      </p>
                    </div>
                    <StatusBadge value={payment.status} />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                    <PaymentHistoryMetric label="Course fee" value={formatCurrencyValue(payment.course_fee)} />
                    <PaymentHistoryMetric label="Paid" value={formatCurrencyValue(payment.paid_amount ?? payment.amount)} />
                    <PaymentHistoryMetric label="Pay type" value={payment.payment_type || formatPaymentTypeDisplay(normalized.enrollment.payment_plan)} />
                    <PaymentHistoryMetric label="Pay through" value={payment.payment_method || payment.mode} />
                    <PaymentHistoryMetric label="Pending" value={formatCurrencyValue(payment.pending_amount)} />
                  </div>
                </div>
              )) : (
                <div className="rounded-[24px] border border-slate-200 bg-surface-50 p-4 text-sm text-slate-500">
                  No payment entries recorded yet.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
          </>
        );
      })()}
    </AppShell>
  );
}

import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import DocumentPreview from "../components/DocumentPreview";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import StudentAvatar from "../components/StudentAvatar";
import { useApp } from "../context/AppContext";
import { openEnrollmentPdf } from "../services/pdfServiceFixed";
import { downloadDocumentFile, openDocumentFile } from "../utils/fileHelpers";
import { formatCurrency, formatDate } from "../utils/formatters";
import {
  formatPaymentTypeDisplay,
  inferPaymentPlan,
  normalizePaymentHistoryList,
  resolveAmountPaid,
  resolveLastPaymentDate,
  resolveNextDueDate,
  resolveRemainingAmount,
  toNumberOrNull,
} from "../utils/paymentHelpers";

function DetailCard({ label, value }) {
  const hasDisplayValue = value !== null && value !== undefined && String(value).trim() !== "";

  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 font-semibold text-slate-900">{hasDisplayValue ? value : "N/A"}</p>
    </div>
  );
}

function formatCurrencyValue(value) {
  return value === null || value === undefined ? "N/A" : formatCurrency(value);
}

function PreviewModal({ preview, onClose }) {
  if (!preview) return null;

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
            <button type="button" className="button-secondary" onClick={() => openDocumentFile(preview.src)}>
              View
            </button>
            <button type="button" className="button-secondary" onClick={() => downloadDocumentFile(preview.src, preview.fileName)}>
              Download
            </button>
            <button type="button" className="button-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <DocumentPreview
          src={preview.src}
          alt={preview.title}
          title={preview.title}
          className="max-h-[76vh] min-h-[420px] w-full rounded-[24px] border border-slate-200 bg-slate-50 object-contain"
        />
      </div>
    </div>
  );
}

export default function StudentProfilePageFixed() {
  const { id } = useParams();
  const { portalRecords, emailLogs, agentLogs } = useApp();
  const [preview, setPreview] = useState(null);

  const record = portalRecords.find((item) => item.student.id === id);
  const student = record?.student;
  const enrollment = record?.enrollment;
  const course = record?.course;
  const docs = record?.documents || [];
  const paymentReceiptTypes = ["Payment Receipt", "Payment proof"];
  const studentPhotoUrl = student?.photo_url || docs.find((doc) => doc.document_type === "Student Photo")?.file_url || "";
  const aadhaarDocumentUrl = student?.aadhaar_document_url || docs.find((doc) => doc.document_type === "Aadhaar ID Photo")?.file_url || "";
  const paymentReceiptDocument = docs.find((doc) => paymentReceiptTypes.includes(doc.document_type)) || null;
  const paymentReceiptUrl = paymentReceiptDocument?.file_url || "";
  const emails = emailLogs.filter((item) => item.enrollment_id === enrollment?.id);
  const logs = agentLogs.filter((item) => !item.enrollment_id || item.enrollment_id === enrollment?.id).slice(0, 3);
  const isPreEnrollment = Boolean(record?.isEnquiryRecord);

  const normalized = useMemo(() => {
    if (!record || !student || !enrollment) return null;

    const courseFee = toNumberOrNull(enrollment.total_fee) ?? toNumberOrNull(course?.fee);
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
      lastPaymentDate,
      enrolledDate: enrollment.enrolled_date || "",
      leadDate: enrollment.lead_date || enrollment.created_at || "",
      fallbackDate: enrollment.next_due_date || "",
    });
    const installmentsPaid = Number(enrollment.installments_paid) || latestPayment?.installments_paid || (paymentPlan === "EMI" ? paymentHistory.length : amountPaid > 0 ? 1 : 0);

    return {
      currentStage,
      courseFee,
      amountPaid,
      remainingAmount,
      paymentHistory,
      student: {
        ...student,
        photo_url: studentPhotoUrl,
        aadhaar_document_url: aadhaarDocumentUrl,
      },
      enrollment: {
        ...enrollment,
        lead_date: enrollment.lead_date || enrollment.created_at || "",
        enrolled_date: enrollment.enrolled_date || (currentStage === "Enrolled" ? (enrollment.created_at || enrollment.lead_date || "") : ""),
        payment_plan: paymentPlan,
        payment_method: paymentMethod,
        total_fee: courseFee,
        amount_paid: amountPaid,
        installments_planned: installmentsPlanned,
        installments_paid: installmentsPaid,
        next_due_date: nextDueDate,
        last_payment_date: lastPaymentDate,
        payment_history: paymentHistory,
        enrollment_status: enrollment.enrollment_status || (currentStage === "Enrolled" ? "Active" : currentStage === "Dropout" ? "Dropped" : "Follow-up"),
      },
    };
  }, [aadhaarDocumentUrl, course?.fee, enrollment, record?.currentStage, student, studentPhotoUrl]);

  if (!record || !student || !enrollment || !normalized) {
    return (
      <AppShell>
        <EmptyState title="Student not found" description="This profile does not exist in the current portal data." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PreviewModal preview={preview} onClose={() => setPreview(null)} />
      <PageHeader
        eyebrow="Student profile"
        title={student.full_name}
        description=""
        actions={[
          <button
            key="pdf"
            type="button"
            className="button-primary"
            onClick={() =>
              openEnrollmentPdf({
                instituteName: "EnrollEase AI Institute",
                student: normalized.student,
                course,
                enrollment: normalized.enrollment,
              })
            }
          >
            Open PDF
          </button>,
          <Link key="back" to="/students" className="button-secondary">
            Back to students
          </Link>,
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <section className="panel overflow-hidden p-0">
            <div className="bg-[linear-gradient(135deg,#e0f2fe_0%,#f8fafc_55%,#ffffff_100%)] p-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-center">
                <StudentAvatar
                  src={studentPhotoUrl}
                  name={student.full_name}
                  className="h-28 w-28 rounded-[28px] object-cover shadow-[0_18px_45px_rgba(59,130,246,0.22)]"
                  fallbackClassName="h-28 w-28 rounded-[28px] shadow-[0_18px_45px_rgba(59,130,246,0.16)]"
                  textClassName="text-2xl"
                />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge value={normalized.currentStage} />
                    <StatusBadge value={isPreEnrollment ? "Payment not initiated" : normalized.enrollment.payment_status} />
                    {!isPreEnrollment ? <StatusBadge value={normalized.enrollment.verification_status} /> : null}
                  </div>
                  <p className="mt-4 text-sm uppercase tracking-[0.24em] text-slate-500">{student.place}</p>
                  <p className="mt-2 font-display text-3xl font-bold text-slate-950">{student.full_name}</p>
                  <p className="mt-2 text-slate-600">{course?.course_name || "Course pending"} - {enrollment.batch || "Batch pending"}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="panel p-6">
            <h2 className="section-title">Complete profile</h2>
            {isPreEnrollment ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm text-slate-500">Profile Completion</p>
                  <p className="mt-2 font-display text-4xl font-bold text-slate-950">{record.profileCompletion}%</p>
                  <p className="mt-2 text-sm text-slate-600">This enquiry is still collecting the required admission information.</p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm text-slate-500">Missing Information</p>
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
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <DetailCard label="Lead date" value={formatDate(normalized.enrollment.lead_date)} />
                <DetailCard label="Enrolled date" value={formatDate(normalized.enrollment.enrolled_date)} />
                <DetailCard label="Contact number" value={student.phone} />
                <DetailCard label="Alternate number" value={student.alternate_phone} />
                <DetailCard label="Email ID" value={student.email} />
                <DetailCard label="Address" value={student.address} />
                <DetailCard label="College name" value={student.college_name} />
                <DetailCard label="Currently doing" value={student.current_activity} />
                <DetailCard label="Guardian name" value={student.guardian_name} />
                <DetailCard label="Guardian relation" value={student.guardian_relation} />
                <DetailCard label="Guardian number" value={student.guardian_phone} />
                <DetailCard label="Aadhaar ID" value={student.aadhaar_id} />
              </div>
            )}
          </section>

          <section className="panel p-6">
            <h2 className="section-title">Document previews</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              <div>
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Student photo</p>
                {studentPhotoUrl ? (
                  <button
                    type="button"
                    className="block w-full"
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
                    className="h-56 w-full rounded-[28px] border border-slate-200 bg-slate-50"
                  />
                )}
              </div>
              <div>
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Aadhaar document</p>
                {aadhaarDocumentUrl ? (
                  <button
                    type="button"
                    className="block w-full"
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
                    className="h-56 w-full rounded-[28px] border border-slate-200 bg-slate-50"
                  />
                )}
              </div>
              <div>
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Payment receipt</p>
                {paymentReceiptUrl ? (
                  <button
                    type="button"
                    className="block w-full"
                    onClick={() => setPreview({ src: paymentReceiptUrl, title: "Payment receipt", fileName: `${student.full_name}-payment-receipt` })}
                  >
                    <DocumentPreview
                      src={paymentReceiptUrl}
                      alt="Payment receipt"
                      title="Payment receipt"
                      fileName={`${student.full_name}-payment-receipt`}
                      className="h-56 w-full rounded-[28px] border border-slate-200 bg-slate-50 object-cover"
                    />
                  </button>
                ) : (
                  <DocumentPreview
                    src=""
                    alt="Payment receipt"
                    title="Payment receipt"
                    className="h-56 w-full rounded-[28px] border border-slate-200 bg-slate-50"
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
              <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm text-slate-500">Payment Status</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">Payment not initiated</p>
                <p className="mt-2 text-sm text-slate-600">Payment details become available after this enquiry is converted to enrolled status.</p>
              </div>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <DetailCard label="Course fee" value={formatCurrencyValue(normalized.courseFee)} />
                <DetailCard label="Amount paid" value={formatCurrencyValue(normalized.amountPaid)} />
                <DetailCard label="Remaining amount" value={formatCurrencyValue(normalized.remainingAmount)} />
                <DetailCard label="Payment type" value={formatPaymentTypeDisplay(normalized.enrollment.payment_plan)} />
                <DetailCard label="Payment method" value={normalized.enrollment.payment_method} />
                <DetailCard
                  label="Installments"
                  value={normalized.enrollment.payment_plan === "EMI" ? `${normalized.enrollment.installments_paid || 0}/${normalized.enrollment.installments_planned || 0}` : (normalized.enrollment.payment_plan ? "One time payment" : "N/A")}
                />
                <DetailCard label="Next due date" value={formatDate(normalized.enrollment.next_due_date)} />
                <DetailCard label="Last payment" value={formatDate(normalized.enrollment.last_payment_date)} />
              </div>
            )}

            <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Enrollment note</p>
              <p className="mt-2 text-sm text-slate-700">{enrollment.remarks || student.notes || "No remarks added."}</p>
            </div>

            {enrollment.dropout_reason ? (
              <div className="mt-4 rounded-[24px] border border-rose-100 bg-rose-50 p-4">
                <p className="text-sm text-rose-600">Dropout reason</p>
                <p className="mt-2 text-sm font-semibold text-rose-900">{enrollment.dropout_reason}</p>
              </div>
            ) : null}
          </section>

          <section className="panel p-6">
            <h2 className="section-title">Payment history</h2>
            <div className="mt-5 space-y-4">
              {isPreEnrollment ? (
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  Payment not initiated.
                </div>
              ) : normalized.paymentHistory.length ? normalized.paymentHistory.map((payment) => (
                <div key={payment.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-900">{payment.label}</p>
                      <p className="text-sm text-slate-500">
                        {formatDate(payment.date)} - {payment.payment_method || payment.mode || "N/A"}
                      </p>
                    </div>
                    <StatusBadge value={payment.status} />
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <DetailCard label="Course fee" value={formatCurrencyValue(payment.course_fee)} />
                    <DetailCard label="Paid" value={formatCurrencyValue(payment.paid_amount ?? payment.amount)} />
                    <DetailCard label="Pay type" value={payment.payment_type || formatPaymentTypeDisplay(normalized.enrollment.payment_plan)} />
                    <DetailCard label="Pay through" value={payment.payment_method || payment.mode} />
                    <DetailCard label="Pending" value={formatCurrencyValue(payment.pending_amount)} />
                  </div>
                </div>
              )) : (
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No payment entries recorded yet.
                </div>
              )}
            </div>
          </section>

          <section className="panel p-6">
            <h2 className="section-title">Documents and communication</h2>
            <div className="mt-5 space-y-4">
              {docs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <p className="font-semibold text-slate-900">{doc.document_type}</p>
                    <p className="text-sm text-slate-500">{doc.remarks || "No extra note"}</p>
                  </div>
                  <StatusBadge value={doc.verification_status} />
                </div>
              ))}
              {isPreEnrollment && !docs.length ? (
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  Documents will appear here after the enquiry is converted to enrolled status.
                </div>
              ) : null}
              {emails.map((email) => (
                <div key={email.id} className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <p className="font-semibold text-slate-900">{email.email_type}</p>
                  <p className="mt-1 text-sm text-slate-500">{email.status} - {formatDate(email.sent_at)}</p>
                </div>
              ))}
              {logs.map((log) => (
                <div key={log.id} className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">AI note</p>
                  <p className="mt-2 text-sm text-slate-700">{log.agent_response}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

import { useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import DocumentPreview from "../components/DocumentPreview";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useApp } from "../context/AppContext";

const paymentReceiptTypes = ["Payment Receipt", "Payment proof"];

function findDocumentUrl(record, documentTypes) {
  const types = Array.isArray(documentTypes) ? documentTypes : [documentTypes];
  return record?.documents?.find((item) => types.includes(item.document_type))?.file_url || "";
}

export default function VerificationPage() {
  const { portalRecords, updateEnrollmentStatus } = useApp();
  const [pendingActionId, setPendingActionId] = useState("");
  const records = useMemo(() => {
    const priority = {
      Pending: 0,
      "Missing Documents": 1,
      "Requested Correction": 2,
      Approved: 3,
      Rejected: 4,
    };

    return portalRecords.filter((record) => record.verificationEligible).sort((left, right) => {
      const leftPriority = priority[left.enrollment.verification_status] ?? 99;
      const rightPriority = priority[right.enrollment.verification_status] ?? 99;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return new Date(right.enrollment.lead_date || right.enrollment.created_at) - new Date(left.enrollment.lead_date || left.enrollment.created_at);
    });
  }, [portalRecords]);

  const handleStatusUpdate = async (recordId, actionKey, patch) => {
    const nextPendingActionId = `${recordId}:${actionKey}`;
    setPendingActionId(nextPendingActionId);

    try {
      await updateEnrollmentStatus(recordId, patch);
    } finally {
      setPendingActionId("");
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Verification panel"
        title="Approve, reject, or request corrections"
        description="Review document status and update the same enrollment records used everywhere else in the portal."
      />

      <div className="grid gap-6">
        {records.map((record) => {
          const { course, documents, enrollment, student } = record;
          const isApproved = enrollment.verification_status === "Approved";
          const isCorrectionRequested = enrollment.verification_status === "Requested Correction";
          const isRejected = enrollment.verification_status === "Rejected";
          const isCompleted = enrollment.enrollment_status === "Completed";

          return (
            <div key={record.id} className="panel p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-400">{course?.course_name}</p>
                  <h2 className="mt-2 font-display text-3xl font-bold text-slate-900">{student?.full_name}</h2>
                  <p className="mt-2 text-slate-600">{enrollment.remarks || student?.notes || "No reviewer note added yet."}</p>
                  <p className="mt-3 text-sm text-slate-500">
                    {documents.length} document(s) attached | Stage: {record.currentStage} | Status: {enrollment.enrollment_status}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <StatusBadge value={record.currentStage} />
                  <StatusBadge value={enrollment.payment_status} />
                  <StatusBadge value={enrollment.verification_status} />
                </div>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <DocumentPreview
                  src={student?.photo_url || findDocumentUrl(record, "Student Photo")}
                  alt={`${student?.full_name} photo`}
                  title="Student photo"
                  fileName={`${student?.full_name || "student"}-photo`}
                  className="h-36 w-full rounded-[24px] border border-slate-200 bg-slate-50 object-cover"
                />
                <DocumentPreview
                  src={student?.aadhaar_document_url || findDocumentUrl(record, "Aadhaar ID Photo")}
                  alt="Aadhaar document"
                  title="Aadhaar document"
                  fileName={`${student?.full_name || "student"}-aadhaar`}
                  className="h-36 w-full rounded-[24px] border border-slate-200 bg-slate-50 object-cover"
                />
                <DocumentPreview
                  src={findDocumentUrl(record, paymentReceiptTypes)}
                  alt="Payment receipt"
                  title="Payment receipt"
                  fileName={`${student?.full_name || "student"}-payment-receipt`}
                  className="h-36 w-full rounded-[24px] border border-slate-200 bg-slate-50 object-cover"
                />
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  className="button-primary"
                  type="button"
                  disabled={isApproved && !isCompleted}
                  title={isApproved && !isCompleted ? "This record is already approved." : "Approve this record."}
                  onClick={() =>
                    handleStatusUpdate(record.id, "approve", {
                      verification_status: "Approved",
                      enrollment_status: isCompleted ? "Completed" : "Active",
                      pipeline_stage: "Enrolled",
                    })
                  }
                >
                  {pendingActionId === `${record.id}:approve` ? "Approving..." : "Approve"}
                </button>
                <button
                  className="button-secondary"
                  type="button"
                  disabled={isCorrectionRequested}
                  title={isCorrectionRequested ? "Correction is already requested." : "Request corrections for this record."}
                  onClick={() =>
                    handleStatusUpdate(record.id, "correction", {
                      verification_status: "Requested Correction",
                      enrollment_status: "Follow-up",
                    })
                  }
                >
                  {pendingActionId === `${record.id}:correction` ? "Requesting..." : "Request correction"}
                </button>
                <button
                  className="button-secondary"
                  type="button"
                  disabled={isRejected}
                  title={isRejected ? "This record is already rejected." : "Reject this record."}
                  onClick={() =>
                    handleStatusUpdate(record.id, "reject", {
                      verification_status: "Rejected",
                      enrollment_status: "Dropped",
                      pipeline_stage: "Dropout",
                    })
                  }
                >
                  {pendingActionId === `${record.id}:reject` ? "Rejecting..." : "Reject"}
                </button>
                <button
                  className="button-secondary"
                  type="button"
                  disabled={isCompleted}
                  title={isCompleted ? "This record is already completed." : "Mark this record as completed."}
                  onClick={() =>
                    handleStatusUpdate(record.id, "complete", {
                      verification_status: "Approved",
                      enrollment_status: "Completed",
                      pipeline_stage: "Enrolled",
                    })
                  }
                >
                  {pendingActionId === `${record.id}:complete` ? "Completing..." : "Mark completed"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}

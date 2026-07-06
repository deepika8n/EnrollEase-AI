import { useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import DocumentPreview from "../components/DocumentPreview";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useApp } from "../context/AppContext";
import { documentTypes } from "../utils/constants";
import { formatDate } from "../utils/formatters";
import { downloadDocumentFile, getDocumentSourceKind, isOpenableSource, openDocumentFile } from "../utils/fileHelpers";

function sanitizeFilePart(value, fallback) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function getFileExtension(source, sourceKind) {
  if (sourceKind === "pdf") return "pdf";

  if (sourceKind === "image") {
    const dataMatch = String(source || "").match(/^data:image\/([a-z0-9.+-]+);/i);
    if (dataMatch?.[1]) {
      const dataExtension = dataMatch[1].toLowerCase();
      if (dataExtension === "jpeg") return "jpg";
      if (dataExtension === "svg+xml") return "svg";
      return dataExtension;
    }

    const urlMatch = String(source || "").match(/\.([a-z0-9]+)(?:$|[?#])/i);
    if (urlMatch?.[1]) {
      return urlMatch[1].toLowerCase() === "jpeg" ? "jpg" : urlMatch[1].toLowerCase();
    }

    return "jpg";
  }

  return "file";
}

function buildDownloadName(studentName, documentType, source, sourceKind) {
  const studentPart = sanitizeFilePart(studentName, "student");
  const documentPart = sanitizeFilePart(documentType, "document");
  const extension = getFileExtension(source, sourceKind);
  return `${studentPart}-${documentPart}.${extension}`;
}

export default function DocumentsPage() {
  const { portalRecords, uploadDocument } = useApp();
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedType, setSelectedType] = useState(documentTypes[0]);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState("");
  const [uploading, setUploading] = useState(false);
  const eligibleRecords = useMemo(
    () => portalRecords.filter((record) => record.documentEligible),
    [portalRecords],
  );
  const documentRecords = useMemo(
    () =>
      eligibleRecords.flatMap((record) =>
        record.documents.map((document) => ({
          ...document,
          studentName: record.student.full_name || "Unknown student",
          documentStatus: document.verification_status || record.enrollment.verification_status || "Pending",
        }))),
    [eligibleRecords],
  );

  const enrollmentOptions = useMemo(
    () =>
      eligibleRecords.map((record) => ({
        id: record.enrollment.id,
        label: `${record.student.full_name || "Unknown"} - ${record.enrollment.batch || "Batch pending"}`,
      })),
    [eligibleRecords],
  );
  const documentMetrics = useMemo(() => {
    const approved = documentRecords.filter((item) => item.documentStatus === "Approved").length;
    const pending = documentRecords.filter((item) => item.documentStatus === "Pending").length;
    const correction = documentRecords.filter((item) => item.documentStatus === "Requested Correction").length;

    return [
      { label: "Total files", value: documentRecords.length, tone: "text-slate-900" },
      { label: "Approved", value: approved, tone: "text-emerald-600" },
      { label: "Pending review", value: pending + correction, tone: "text-amber-600" },
    ];
  }, [documentRecords]);
  const sortedDocuments = useMemo(
    () =>
      [...documentRecords].sort(
        (left, right) => new Date(right.uploaded_at || right.created_at || 0) - new Date(left.uploaded_at || left.created_at || 0),
      ),
    [documentRecords],
  );
  const canUpload = Boolean(selectedFile && selectedEnrollmentId);

  const handleUpload = async () => {
    if (!canUpload) return;
    setUploading(true);
    try {
      await uploadDocument({
        enrollmentId: selectedEnrollmentId,
        file: selectedFile,
        documentType: selectedType,
      });
      setSelectedFile(null);
      setSelectedEnrollmentId("");
      setSelectedType(documentTypes[0]);
    } finally {
      setUploading(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Admission vault"
        title="Documents"
        description="Manage student proofs, identity documents, and payment files in one clean verification workspace."
      />

      <div className="grid gap-6">
        <div className="panel overflow-hidden">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.45fr_0.95fr] lg:p-8">
            <div className="space-y-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.26em] text-sky-600">Document intake</p>
                <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-slate-900">Upload files for verification</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                  Add student photos, ID proofs, certificates, and payment receipts without leaving the admission workflow.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Choose file</span>
                  <input
                    className="mt-3"
                    type="file"
                    accept="image/*,.pdf,application/pdf"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                  />
                </label>
                <label className="rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Student enrollment</span>
                  <select className="mt-3" title="Choose enrollment" value={selectedEnrollmentId} onChange={(event) => setSelectedEnrollmentId(event.target.value)}>
                    <option value="">Select enrollment</option>
                    {enrollmentOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm">
                  <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Document type</span>
                  <select className="mt-3" title="Choose document type" value={selectedType} onChange={(event) => setSelectedType(event.target.value)}>
                    {documentTypes.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="button-primary min-w-[180px]"
                  type="button"
                  onClick={handleUpload}
                  disabled={!canUpload || uploading}
                  title={canUpload ? "Upload document" : "Choose a file and enrollment first."}
                >
                  {uploading ? "Uploading..." : "Upload document"}
                </button>
                <p className="text-sm text-slate-500">Files remain linked to the existing `documents` table and storage flow.</p>
              </div>
            </div>

            <div className="rounded-[28px] border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-slate-50 p-5 shadow-inner">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Workspace overview</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                {documentMetrics.map((metric) => (
                  <div key={metric.label} className="rounded-[24px] border border-white/80 bg-white/90 px-5 py-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{metric.label}</p>
                    <p className={`mt-3 font-display text-3xl font-bold ${metric.tone}`}>{metric.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {sortedDocuments.length ? (
          <div className="grid gap-6 xl:grid-cols-2">
            {sortedDocuments.map((document) => {
              const canOpenFile = isOpenableSource(document.file_url);
              const sourceKind = getDocumentSourceKind(document.file_url);
              const studentName = document.studentName || "Unknown student";
              const documentStatus = document.documentStatus || "Pending";
              const remarks = document.remarks || "No remarks available";
              const downloadName = buildDownloadName(studentName, document.document_type, document.file_url, sourceKind);

              return (
                <div key={document.id} className="panel overflow-hidden border border-sky-100/80 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
                  <div className="space-y-6 p-6 lg:p-7">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-600">Student name</p>
                        <h2 className="mt-2 break-words font-display text-2xl font-bold tracking-tight text-slate-900">{studentName}</h2>
                        <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Document type</p>
                          <p className="mt-2 break-words text-sm font-semibold text-slate-800">{document.document_type}</p>
                        </div>
                      </div>
                      <StatusBadge value={documentStatus} />
                    </div>

                    <div className="rounded-[28px] border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4">
                      <DocumentPreview
                        src={document.file_url}
                        alt={document.document_type}
                        title={document.document_type}
                        fileName={downloadName}
                        className="h-[250px] w-full rounded-[22px] border border-slate-200 bg-white object-contain shadow-sm"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-[24px] bg-slate-50 px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Uploaded date</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{formatDate(document.uploaded_at || document.created_at)}</p>
                      </div>
                      <div className="rounded-[24px] bg-slate-50 px-4 py-4 md:col-span-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Remarks</p>
                        <p className="mt-2 break-words text-sm leading-6 text-slate-600">{remarks}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {canOpenFile ? (
                        <button
                          type="button"
                          className="button-primary min-w-[132px]"
                          onClick={() => openDocumentFile(document.file_url)}
                        >
                          View
                        </button>
                      ) : (
                        <button type="button" className="button-primary min-w-[132px] opacity-60" disabled>
                          View
                        </button>
                      )}
                      {canOpenFile ? (
                        <button
                          type="button"
                          className="button-secondary min-w-[132px]"
                          onClick={() => downloadDocumentFile(document.file_url, downloadName)}
                        >
                          Download
                        </button>
                      ) : (
                        <button type="button" className="button-secondary min-w-[132px]" disabled>
                          Download
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No documents uploaded yet"
            description="Student files will appear here once the admission team starts attaching identity proofs, certificates, and payment records."
          />
        )}
      </div>
    </AppShell>
  );
}

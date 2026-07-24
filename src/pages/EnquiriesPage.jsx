import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import PageHeader from "../components/PageHeader";
import { useApp } from "../context/AppContext";
import {
  compareIsoDates,
  getDisplayEnquiryFollowUpDate,
  getFinalEnquiryFollowUpDate,
  getInitialEnquiryFollowUpDate,
  getTodayIsoDate,
} from "../utils/enrollmentDateValidation";
import { parseCsv } from "../utils/fileHelpers";
import { formatDate, formatShortDate } from "../utils/formatters";

const GIRL_NAME_PREFIXES = [
  "priya",
  "aditi",
  "neha",
  "kavya",
  "ishita",
  "deepu",
  "deepa",
  "deepika",
  "deepthi",
  "chandana",
  "triveni",
  "trivei",
  "rosy",
  "rose",
  "riya",
  "rhea",
  "roshni",
  "sneha",
  "divya",
  "navya",
];
const BOY_NAME_PREFIXES = [
  "karthik",
  "sameer",
  "rahul",
  "joseph",
  "mehul",
  "dhanu",
  "dhananjaya",
  "rohit",
  "roshan",
  "rakesh",
  "rajesh",
  "raj",
  "arjun",
  "akhil",
  "ajay",
  "nikhil",
  "naveen",
  "vivek",
  "vishal",
  "varun",
  "harsha",
  "tejas",
  "charan",
  "ganesh",
  "sai",
  "manoj",
  "yash",
];

function buildInitials(name = "") {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function matchesKnownNameToken(token = "", prefixes = []) {
  const normalizedToken = String(token || "").trim().toLowerCase();
  return prefixes.some((name) => normalizedToken.startsWith(name) || normalizedToken.endsWith(name));
}

function getStudentTone(student = {}) {
  const rawGender = String(student.gender || student.sex || student.student_gender || "").trim().toLowerCase();
  const firstName = String(student.full_name || "").trim().split(/\s+/)[0]?.toLowerCase() || "";
  const isGirlName = matchesKnownNameToken(firstName, GIRL_NAME_PREFIXES);
  const isBoyName = matchesKnownNameToken(firstName, BOY_NAME_PREFIXES);

  if (rawGender === "female" || rawGender === "girl" || rawGender === "f" || isGirlName) {
    return {
      badgeClass: "border-[#fbcfe8] bg-[#fff1f6] text-[#9d174d]",
      nameClass: "text-[#be185d]",
    };
  }

  if (rawGender === "male" || rawGender === "boy" || rawGender === "m" || isBoyName) {
    return {
      badgeClass: "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]",
      nameClass: "text-[#2563eb]",
    };
  }

  return {
    badgeClass: "border-slate-200 bg-slate-50 text-slate-600",
    nameClass: "text-slate-900",
  };
}

function isFollowUpSuccessful(log) {
  return ["Sent", "Queued"].includes(String(log?.status || "").trim());
}

function isFollowUpQueued(log) {
  return String(log?.status || "").trim() === "Queued";
}

const FOLLOW_UP_SUCCESS_HIGHLIGHT_MS = 5 * 60 * 1000;

function isValidStudentEmail(email = "") {
  const safeEmail = String(email || "").trim().toLowerCase();
  if (!safeEmail || safeEmail.endsWith("@enrollease.local")) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail);
}

function isCsvFile(file) {
  if (!file) return false;

  const fileName = String(file.name || "").trim().toLowerCase();
  const fileType = String(file.type || "").trim().toLowerCase();

  if (!fileName.endsWith(".csv")) {
    return false;
  }

  if (!fileType) {
    return true;
  }

  return ["text/csv", "application/vnd.ms-excel"].includes(fileType);
}

function getFollowUpMeta(record, logs = [], nowMs = Date.now()) {
  const storedFollowUpDate = record?.enrollment?.follow_up_date || "";
  const leadDate = record?.enrollment?.lead_date || record?.enrollment?.created_at || "";
  const initialFollowUpDate = getInitialEnquiryFollowUpDate(leadDate);
  const finalFollowUpDate = getFinalEnquiryFollowUpDate(leadDate);
  const todayIsoDate = getTodayIsoDate();
  const nextFollowUpDate = getDisplayEnquiryFollowUpDate({
    leadDate,
    followUpDate: storedFollowUpDate,
    today: todayIsoDate,
  }) || storedFollowUpDate;
  const safeEmail = String(record?.student?.email || "").trim();
  const hasReachableEmail = isValidStudentEmail(safeEmail);
  const successfulLogs = logs.filter(isFollowUpSuccessful);
  const latestLog = logs[0] || null;
  const latestSuccessfulLog = successfulLogs[0] || null;
  const latestQueuedLog = logs.find(isFollowUpQueued) || null;
  const completedCycles = Math.min(successfulLogs.length, 2);
  const latestSuccessfulLogMs = latestSuccessfulLog?.sent_at ? new Date(latestSuccessfulLog.sent_at).valueOf() : 0;
  const recentSuccess = Boolean(latestSuccessfulLogMs) && nowMs - latestSuccessfulLogMs <= FOLLOW_UP_SUCCESS_HIGHLIGHT_MS;
  let requiredCycles = 0;
  if (initialFollowUpDate && compareIsoDates(todayIsoDate, initialFollowUpDate) >= 0) {
    requiredCycles = 1;
  }
  if (finalFollowUpDate && compareIsoDates(todayIsoDate, finalFollowUpDate) >= 0) {
    requiredCycles = 2;
  }

  const due = hasReachableEmail && requiredCycles > completedCycles;
  const isQueued = Boolean(latestQueuedLog) && (!latestSuccessfulLog || latestSuccessfulLog === latestQueuedLog);
  const isHealthy = hasReachableEmail && recentSuccess;

  let statusLabel = "Scheduled";
  let reason = initialFollowUpDate
    ? `First follow-up is scheduled for ${formatDate(initialFollowUpDate)}.`
    : "Follow-up date is not available.";
  if (!hasReachableEmail) {
    reason = "Student email is missing or invalid.";
    statusLabel = "Email missing";
  } else if (latestLog && !isFollowUpSuccessful(latestLog)) {
    reason = `Last follow-up attempt failed on ${formatDate(latestLog.sent_at)}.`;
    statusLabel = "Retry needed";
  } else if (recentSuccess) {
    reason = nextFollowUpDate
      ? `Follow-up was sent recently. Next follow-up is ${formatDate(nextFollowUpDate)}.`
      : `Follow-up was sent recently on ${formatDate(latestSuccessfulLog?.sent_at)}.`;
    statusLabel = "Just sent";
  } else if (isQueued) {
    reason = `Follow-up request is queued from ${formatDate(latestQueuedLog?.sent_at)}.`;
    statusLabel = "Queued";
  } else if (due && completedCycles === 0) {
    reason = `First follow-up is due now for ${formatDate(initialFollowUpDate || nextFollowUpDate)}.`;
    statusLabel = "1st follow-up pending";
  } else if (due && completedCycles === 1) {
    reason = `Second follow-up is due now for ${formatDate(finalFollowUpDate || nextFollowUpDate)}.`;
    statusLabel = "2nd follow-up pending";
  } else if (completedCycles >= 2) {
    reason = `Both follow-ups were sent. Latest send was on ${formatDate(latestSuccessfulLog?.sent_at)}.`;
    statusLabel = "2 follow-ups sent";
  } else if (completedCycles === 1) {
    reason = nextFollowUpDate
      ? `First follow-up sent. Next follow-up is scheduled for ${formatDate(nextFollowUpDate)}.`
      : `First follow-up sent on ${formatDate(latestSuccessfulLog?.sent_at)}.`;
    statusLabel = "1st follow-up sent";
  }

  return {
    completedCycles,
    due,
    isQueued,
    hasReachableEmail,
    isHealthy,
    recentSuccess,
    latestLog,
    latestSuccessfulLog,
    nextFollowUpDate,
    reason,
    statusLabel,
  };
}

export default function EnquiriesPage() {
  const {
    portalRecords,
    importStudentsFromCsv,
    deleteEnquiry,
    emailLogs,
    sendDashboardFollowUpEmail,
    updateEnrollmentStatus,
  } = useApp();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [followUpSendingId, setFollowUpSendingId] = useState("");
  const [dropoutId, setDropoutId] = useState("");
  const [selectedFollowUpId, setSelectedFollowUpId] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [statusClockMs, setStatusClockMs] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setStatusClockMs(Date.now());
    }, 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const followUpLogsByEnrollment = useMemo(() => {
    const grouped = new Map();

    emailLogs
      .filter((item) => String(item.email_type || "").toLowerCase().includes("follow-up"))
      .sort((left, right) => new Date(right.sent_at || 0) - new Date(left.sent_at || 0))
      .forEach((log) => {
        const key = log.enrollment_id || "";
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key).push(log);
      });

    return grouped;
  }, [emailLogs]);

  const enquiries = useMemo(
    () =>
      portalRecords.filter((record) => {
        if (record.currentStage !== "Enquiry") {
          return false;
        }

        const normalizedFilter = nameFilter.trim().toLowerCase();
        if (!normalizedFilter) {
          return true;
        }

        return String(record.student.full_name || "").toLowerCase().includes(normalizedFilter);
      }),
    [nameFilter, portalRecords],
  );

  const selectedFollowUpRecord = enquiries.find((record) => record.enrollment.id === selectedFollowUpId) || null;
  const selectedFollowUpMeta = selectedFollowUpRecord
    ? getFollowUpMeta(selectedFollowUpRecord, followUpLogsByEnrollment.get(selectedFollowUpRecord.enrollment.id) || [], statusClockMs)
    : null;

  const handleCsvUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      if (!isCsvFile(file)) {
        throw new Error("Only CSV files are allowed.");
      }

      setUploading(true);
      const text = await file.text();
      const rows = parseCsv(text).map((row) => ({
        ...row,
        pipeline_stage: "Enquiry",
        enrollment_status: row.enrollment_status || "Follow-up",
        payment_plan: "",
        payment_method: "",
      }));
      await importStudentsFromCsv(rows);
    } catch (error) {
      window.alert(error.message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleDeleteEnquiry = async (record) => {
    const studentName = record?.student?.full_name || "this enquiry";
    const confirmed = window.confirm(`Delete enquiry for ${studentName}? This will also remove it from Supabase.`);
    if (!confirmed) return;

    try {
      setDeletingId(record.enrollment.id);
      await deleteEnquiry(record.enrollment.id);
    } catch (error) {
      window.alert(error.message || "Unable to delete this enquiry right now.");
    } finally {
      setDeletingId("");
    }
  };

  const handleSendFollowUp = async (record) => {
    try {
      setFollowUpSendingId(record.enrollment.id);
      await sendDashboardFollowUpEmail(record.enrollment.id);
    } catch (error) {
      window.alert(error.message || "Unable to send follow-up email right now.");
    } finally {
      setFollowUpSendingId("");
    }
  };

  const handleMarkDropout = async (record) => {
    const confirmed = window.confirm(`Mark ${record.student.full_name} as dropout?`);
    if (!confirmed) return;

    try {
      setDropoutId(record.enrollment.id);
      await updateEnrollmentStatus(record.enrollment.id, {
        pipeline_stage: "Dropout",
        enrollment_status: "Dropped",
        dropout_reason: "Marked as dropout from enquiry follow-up queue.",
      });
    } catch (error) {
      window.alert(error.message || "Unable to mark this enquiry as dropout.");
    } finally {
      setDropoutId("");
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Enquiries"
        title="Follow-up queue"
        description="Track and convert live enquiry records from one place."
        actions={[
          <button key="upload" type="button" className="button-secondary" onClick={() => fileInputRef.current?.click()}>
            {uploading ? "Uploading..." : "Upload CSV"}
          </button>,
          <button
            key="new"
            type="button"
            className="button-primary"
            onClick={() => navigate("/enrollment?from=enquiries")}
          >
            Add new enquiry
          </button>,
        ]}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleCsvUpload}
      />

      <section className="mb-4 flex items-center justify-between gap-3">
        <div className="w-full max-w-sm">
          <input
            type="text"
            value={nameFilter}
            onChange={(event) => setNameFilter(event.target.value)}
            placeholder="Filter by student name"
            aria-label="Filter enquiries by student name"
            className="rounded-xl px-3 py-2.5 text-sm"
          />
        </div>
      </section>

      <div className="space-y-4">
        {enquiries.map((record) => (
          <section key={record.id} className="panel p-4">
            {(() => {
              const tone = getStudentTone(record.student);
              const initials = buildInitials(record.student.full_name);
              const followUpLogs = followUpLogsByEnrollment.get(record.enrollment.id) || [];
              const followUpMeta = getFollowUpMeta(record, followUpLogs, statusClockMs);

              return (
                <>
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex min-w-0 items-center gap-2.5 xl:w-[21%]">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-semibold uppercase tracking-[0.06em] ${tone.badgeClass}`}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className={`truncate text-[0.98rem] font-semibold ${tone.nameClass}`}>{record.student.full_name}</p>
                        <p className="text-[13px] text-slate-500">{record.course?.course_name || "Course pending"}</p>
                      </div>
                    </div>

                    <div className="grid flex-1 gap-2 text-sm sm:grid-cols-3 xl:max-w-[31rem]">
                      <div className="rounded-xl bg-slate-50 p-2">
                        <p className="text-[12px] text-slate-500">Lead date</p>
                        <p className="mt-0.5 font-semibold text-slate-900">{formatDate(record.enrollment.lead_date)}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2">
                        <p className="text-[12px] text-slate-500">Next follow-up</p>
                        <p className="mt-0.5 font-semibold text-slate-900">{formatDate(followUpMeta.nextFollowUpDate)}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2">
                        <p className="text-[12px] text-slate-500">I am a</p>
                        <p className="mt-0.5 font-semibold text-slate-900">{record.student.current_activity || "Not shared yet"}</p>
                      </div>
                    </div>

                    <div className="xl:w-[24%]">
                      <div className="rounded-[18px] border border-slate-200 bg-white p-2.5">
                        <p className="text-[12px] text-slate-500">Counsellor note</p>
                        <p className="mt-1 text-sm text-slate-700">{record.enrollment.remarks || record.student.notes || "No remarks added yet."}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 xl:w-[18%] xl:justify-end">
                      <button
                        type="button"
                        className={`status-pill flex items-center gap-2 ${
                          followUpMeta.recentSuccess
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-rose-200 bg-rose-50 text-rose-600"
                        }`}
                        onClick={() => setSelectedFollowUpId(record.enrollment.id)}
                      >
                        <span
                          className={`inline-flex h-2.5 w-2.5 rounded-full animate-pulse ${
                            followUpMeta.recentSuccess ? "bg-emerald-500" : "bg-red-500"
                          }`}
                          aria-hidden="true"
                        />
                        Follow-up
                      </button>
                      <button
                        type="button"
                        className="button-primary px-3.5 py-2 text-sm"
                        onClick={() => navigate(`/enrollment?convert=${record.enrollment.id}&from=enquiries`)}
                      >
                        Convert To Enrolled
                      </button>
                      <button
                        type="button"
                        className="button-secondary px-3.5 py-2 text-sm"
                        onClick={() => handleMarkDropout(record)}
                        disabled={dropoutId === record.enrollment.id}
                      >
                        {dropoutId === record.enrollment.id ? "Updating..." : "Dropout"}
                      </button>
                      <button
                        type="button"
                        className="button-secondary px-3.5 py-2 text-sm"
                        onClick={() => handleDeleteEnquiry(record)}
                        disabled={deletingId === record.enrollment.id}
                      >
                        {deletingId === record.enrollment.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-4 border-t border-slate-100 pt-2.5 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                    <span>{record.student.place}</span>
                    <span>{record.student.phone}</span>
                    <span>{formatShortDate(followUpMeta.nextFollowUpDate)}</span>
                  </div>
                </>
              );
            })()}
          </section>
        ))}
      </div>

      {selectedFollowUpRecord ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-kicker">Follow-up Status</p>
                <h2 className="mt-3 text-2xl font-semibold text-slate-950">{selectedFollowUpRecord.student.full_name}</h2>
                <p className="mt-2 text-sm text-slate-500">{selectedFollowUpRecord.student.email || "No email available"}</p>
              </div>
              <button type="button" className="button-secondary px-3 py-2 text-sm" onClick={() => setSelectedFollowUpId("")}>
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Next follow-up</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {selectedFollowUpMeta?.nextFollowUpDate ? formatDate(selectedFollowUpMeta.nextFollowUpDate) : "Due now"}
                </p>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-3 w-3 rounded-full animate-pulse ${selectedFollowUpMeta?.recentSuccess ? "bg-emerald-500" : "bg-red-500"}`}
                    aria-hidden="true"
                  />
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Mail status</p>
                </div>
                <p className="mt-2 text-lg font-semibold text-slate-900">{selectedFollowUpMeta?.statusLabel}</p>
                <p className="mt-2 text-sm text-slate-500">{selectedFollowUpMeta?.reason}</p>
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold text-slate-900">Send follow-up email</p>
                <button
                  type="button"
                  className="button-primary px-4 py-2 text-sm"
                  onClick={() => handleSendFollowUp(selectedFollowUpRecord)}
                  disabled={followUpSendingId === selectedFollowUpRecord.enrollment.id || !selectedFollowUpMeta?.hasReachableEmail}
                >
                  {followUpSendingId === selectedFollowUpRecord.enrollment.id ? "Sending..." : "Send Follow-up"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

    </AppShell>
  );
}

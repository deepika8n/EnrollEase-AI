import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import PageHeader from "../components/PageHeader";
import { useApp } from "../context/AppContext";
import { normalizeBatchName } from "../data/courseCatalog";
import {
  buildCopilotRecordSet,
  generateAdmissionsCopilotResponse,
  getAdmissionsUrgency,
} from "../services/aiCopilotService";
import { formatCurrency, formatDate } from "../utils/formatters";
import { resolveAmountPaid, resolveRemainingAmount } from "../utils/paymentHelpers";

const AI_COPILOT_MARQUEE_IMAGE = "https://www.k2view.com/hs-fs/hubfs/AI%20Agents.jpg?width=1024&height=512&name=AI%20Agents.jpg";

function ActionChip({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active
        ? "rounded-full bg-[linear-gradient(135deg,#0b3558,#1d6fa5)] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(11,53,88,0.22)] transition duration-300 hover:-translate-y-0.5"
        : "rounded-full border border-sky-100 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-600 shadow-[0_8px_20px_rgba(148,163,184,0.12)] transition duration-300 hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50/80 hover:text-brand-500"}
    >
      {children}
    </button>
  );
}

function DetailPill({ label, value }) {
  const normalized = String(label || "").toLowerCase();
  let tone = "from-slate-50 via-white to-slate-100 border-white/80";

  if (normalized.includes("payment")) {
    tone = "from-violet-50 via-fuchsia-50 to-indigo-100 border-violet-100/90";
  } else if (normalized.includes("follow")) {
    tone = "from-emerald-50 via-teal-50 to-cyan-100 border-emerald-100/90";
  } else if (normalized.includes("due")) {
    tone = "from-amber-50 via-yellow-50 to-orange-100 border-amber-100/90";
  }

  return (
    <div className={`group rounded-[18px] border bg-gradient-to-br ${tone} px-4 py-3 shadow-[0_10px_24px_rgba(148,163,184,0.12)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_32px_rgba(125,211,252,0.2)]`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500 transition duration-300 group-hover:tracking-[0.28em] group-hover:text-slate-700">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900 transition duration-300 group-hover:text-sky-950">{value}</p>
    </div>
  );
}

function urgencyBadgeClass(level = "low") {
  if (level === "critical") return "border-rose-200 bg-rose-50 text-rose-700";
  if (level === "high") return "border-amber-200 bg-amber-50 text-amber-700";
  if (level === "medium") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function getRecordSearchText(record) {
  return [
    record.student?.full_name,
    record.student?.student_code,
    record.student?.email,
    record.course?.course_name,
    normalizeBatchName(record.enrollment?.batch),
    record.currentStage,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getRecordPaymentSnapshot(record) {
  const totalFee = Number(record?.enrollment?.total_fee || record?.course?.fee || 0);
  const amountPaid = Number(resolveAmountPaid(record?.enrollment?.amount_paid, record?.enrollment?.payment_history) || 0);
  const dueAmount = Number(resolveRemainingAmount(totalFee, amountPaid) || 0);
  return { totalFee, dueAmount };
}

function toEmailHtml(text = "") {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .map((line) => (line
      ? `<p style="margin:0 0 14px;font-size:15px;line-height:1.8;color:#42556d;">${line}</p>`
      : "<div style=\"height:8px\"></div>"))
    .join("");
}

function extractDraftSubject(text = "", fallbackSubject = "Admissions Update - CERTISURED") {
  const subjectLine = String(text || "")
    .split("\n")
    .find((line) => line.trim().toLowerCase().startsWith("subject:"));

  const subject = subjectLine?.replace(/^subject:\s*/i, "").trim();
  return subject || fallbackSubject;
}

function stripDraftSubject(text = "") {
  return String(text || "")
    .split("\n")
    .filter((line) => !line.trim().toLowerCase().startsWith("subject:"))
    .join("\n")
    .trim();
}

function RecordListItem({ record, active, onSelect }) {
  const urgency = getAdmissionsUrgency(record);
  const payment = getRecordPaymentSnapshot(record);

  return (
    <button
      type="button"
      onClick={() => onSelect(record.id)}
      className={`group w-full rounded-[20px] border px-4 py-4 text-left transition duration-300 ${
        active
          ? "border-sky-200 bg-[linear-gradient(145deg,#f3fbff,#eef4ff_55%,#f7f5ff)] shadow-[0_18px_38px_rgba(59,130,246,0.16)]"
          : "border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,251,255,0.94))] shadow-[0_10px_24px_rgba(148,163,184,0.1)] hover:-translate-y-1 hover:border-sky-200 hover:bg-[linear-gradient(145deg,#fcfeff,#f0f9ff_55%,#f8faff)] hover:shadow-[0_18px_32px_rgba(96,165,250,0.14)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate bg-gradient-to-r from-slate-950 via-sky-900 to-cyan-700 bg-clip-text text-sm font-semibold text-transparent transition duration-300 group-hover:from-sky-900 group-hover:to-indigo-700">
            {record.student?.full_name || "Unnamed student"}
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 transition duration-300 group-hover:tracking-[0.22em] group-hover:text-sky-700">
            {record.currentStage || "Unknown"} · {record.course?.course_name || record.enrollment?.course_name || "Course pending"}
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${urgencyBadgeClass(urgency.level)}`}>
          {urgency.level}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <p>Batch: {normalizeBatchName(record.enrollment?.batch) || "N/A"}</p>
        <p>Payment: {record.enrollment?.payment_status || "Pending"}</p>
        <p>Follow-up: {formatDate(record.enrollment?.follow_up_date)}</p>
        <p>Due: {payment.totalFee ? formatCurrency(payment.dueAmount) : "N/A"}</p>
      </div>
    </button>
  );
}

export default function AiCopilotPage() {
  const { portalRecords, logEmail } = useApp();
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [search, setSearch] = useState("");
  const [intent, setIntent] = useState("summary");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingDraft, setSendingDraft] = useState(false);
  const [result, setResult] = useState({
    mode: "guided_local",
    answer: "",
    matchedRecords: [],
    suggestions: [],
  });

  const copilotRecords = useMemo(
    () => buildCopilotRecordSet(portalRecords),
    [portalRecords],
  );

  const filteredRecords = useMemo(() => {
    const searchQuery = search.trim().toLowerCase();
    const sortedRecords = [...copilotRecords].sort((left, right) => {
      const leftName = String(left.student?.full_name || "").toLowerCase();
      const rightName = String(right.student?.full_name || "").toLowerCase();
      return leftName.localeCompare(rightName);
    });

    if (!searchQuery) return sortedRecords;
    return sortedRecords.filter((record) => getRecordSearchText(record).includes(searchQuery));
  }, [copilotRecords, search]);

  const selectedRecord = useMemo(
    () => copilotRecords.find((record) => record.id === selectedRecordId) || null,
    [copilotRecords, selectedRecordId],
  );

  const selectedPayment = selectedRecord ? getRecordPaymentSnapshot(selectedRecord) : null;
  const selectedUrgency = selectedRecord ? getAdmissionsUrgency(selectedRecord) : null;

  useEffect(() => {
    if (!selectedRecordId && filteredRecords.length) {
      setSelectedRecordId(filteredRecords[0].id);
      return;
    }

    if (selectedRecordId && !copilotRecords.some((record) => record.id === selectedRecordId)) {
      setSelectedRecordId(filteredRecords[0]?.id || "");
    }
  }, [copilotRecords, filteredRecords, selectedRecordId]);

  const handleGenerate = async (nextIntent = intent) => {
    setIntent(nextIntent);
    setLoading(true);

    try {
      const response = await generateAdmissionsCopilotResponse({
        intent: nextIntent,
        query,
        portalRecord: selectedRecord,
        portalRecords: copilotRecords,
      });
      setResult({
        mode: response.mode,
        answer: response.answer,
        matchedRecords: response.matchedRecords || [],
        suggestions: response.suggestions || [],
      });
    } catch (error) {
      setResult({
        mode: "error",
        answer: error.message || "Agent response could not be generated right now.",
        matchedRecords: [],
        suggestions: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const emailRecipientRecords = useMemo(() => {
    const matchedIds = new Set((result.matchedRecords || []).map((record) => record.id).filter(Boolean));
    const matchedFullRecords = matchedIds.size
      ? copilotRecords.filter((record) => matchedIds.has(record.id))
      : [];

    return matchedFullRecords.length ? matchedFullRecords : (selectedRecord ? [selectedRecord] : []);
  }, [copilotRecords, result.matchedRecords, selectedRecord]);

  const handleSendDraftEmail = async () => {
    if (!emailRecipientRecords.length || !result.answer) return;

    try {
      setSendingDraft(true);
      const emailType = intent === "follow_up" ? "AI Follow-up Draft" : "AI Copilot Update";
      const fallbackSubject = intent === "follow_up"
        ? "Admissions Follow-up - CERTISURED"
        : "Admissions Update - CERTISURED";
      const subject = extractDraftSubject(result.answer, fallbackSubject);
      const emailText = stripDraftSubject(result.answer) || result.answer;
      const emailHtml = `
        <div style="margin:0;padding:24px;background:#eef4fb;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#10233c;">
          <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dbe8f7;border-radius:28px;overflow:hidden;box-shadow:0 22px 50px rgba(15,23,42,0.08);padding:32px;">
            ${toEmailHtml(emailText)}
          </div>
        </div>
      `;

      for (const record of emailRecipientRecords) {
        await logEmail(emailType, record.enrollment, {
          student: record.student,
          course: record.course || record.enrollment?.course_name || "",
          currentStage: record.currentStage || "",
          subject,
          text: emailText,
          html: emailHtml,
          logType: emailType,
          silent: emailRecipientRecords.length > 1,
          successTitle: "Agent email sent successfully.",
        });
      }

      setResult((prev) => ({
        ...prev,
        suggestions: [
          `Email sent to ${emailRecipientRecords.length} matched student${emailRecipientRecords.length === 1 ? "" : "s"}.`,
          ...(prev.suggestions || []),
        ],
      }));
    } finally {
      setSendingDraft(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="AI Agent"
        title="Admissions Agent"
        description="Ask anything and get answers only from the current app data."
      />

      <div className="ai-copilot-marquee my-6">
        <div className="ai-copilot-marquee-track" aria-hidden="true">
          <img
            src={AI_COPILOT_MARQUEE_IMAGE}
            alt=""
            className="ai-copilot-marquee-image"
            loading="eager"
          />
        </div>
      </div>

      <section className="relative overflow-hidden rounded-[36px] bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.26),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(250,204,21,0.22),transparent_24%),radial-gradient(circle_at_top_right,rgba(147,197,253,0.2),transparent_26%),linear-gradient(180deg,#f8fbff_0%,#eef4fb_100%)] p-4 md:p-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(255,255,255,0.52),transparent)]" />
        <div className="grid gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
          <aside className="panel border-white/70 bg-white/88 p-5 shadow-[0_24px_60px_rgba(148,163,184,0.18)] backdrop-blur-sm">
            <p className="section-kicker">Records</p>
            <h2 className="mt-1 bg-gradient-to-r from-sky-900 via-cyan-700 to-emerald-600 bg-clip-text text-lg font-semibold text-transparent">
              Current records
            </h2>

            <div className="mt-4">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, course, batch"
                aria-label="Search records"
              />
            </div>

            <div className="mt-4 max-h-[68vh] space-y-3 overflow-y-auto pr-1">
              {filteredRecords.length ? (
                filteredRecords.map((record) => (
                  <RecordListItem
                    key={record.id}
                    record={record}
                    active={record.id === selectedRecordId}
                    onSelect={setSelectedRecordId}
                  />
                ))
              ) : (
                <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                  No records match this search.
                </div>
              )}
            </div>
          </aside>

          <div className="space-y-6">
            <section className="panel border-white/75 bg-white/88 p-5 shadow-[0_26px_60px_rgba(148,163,184,0.16)] backdrop-blur-sm md:p-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <p className="section-kicker">Selected record</p>
                  {selectedRecord ? (
                    <>
                      <h2 className="mt-1 bg-gradient-to-r from-slate-950 via-sky-900 to-cyan-700 bg-clip-text text-2xl font-semibold text-transparent transition duration-500 hover:tracking-[0.01em]">
                        {selectedRecord.student?.full_name || "Unnamed student"}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {selectedRecord.course?.course_name || selectedRecord.enrollment?.course_name || "Course pending"} · {selectedRecord.currentStage || "Unknown"} · {normalizeBatchName(selectedRecord.enrollment?.batch) || "Batch pending"}
                      </p>
                      {selectedUrgency ? (
                        <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] shadow-[0_8px_20px_rgba(148,163,184,0.12)] ${urgencyBadgeClass(selectedUrgency.level)}`}>
                          {selectedUrgency.level}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <h2 className="mt-1 text-2xl font-semibold text-slate-950">Select a record</h2>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <DetailPill label="Payment" value={selectedRecord?.enrollment?.payment_status || "Pending"} />
                  <DetailPill label="Follow-up" value={formatDate(selectedRecord?.enrollment?.follow_up_date)} />
                  <DetailPill label="Due amount" value={selectedPayment?.totalFee ? formatCurrency(selectedPayment.dueAmount) : "N/A"} />
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr),minmax(280px,0.8fr)]">
              <div className="panel border-white/75 bg-white/88 p-5 shadow-[0_26px_60px_rgba(148,163,184,0.16)] backdrop-blur-sm md:p-6">
                <div className="flex flex-wrap gap-2.5">
                  <ActionChip active={intent === "summary"} onClick={() => void handleGenerate("summary")}>Summary</ActionChip>
                  <ActionChip active={intent === "next_step"} onClick={() => void handleGenerate("next_step")}>Next step</ActionChip>
                  <ActionChip active={intent === "follow_up"} onClick={() => void handleGenerate("follow_up")}>Draft follow-up</ActionChip>
                </div>

                <div className="mt-5">
                  <textarea
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Ask anything like: show overdue payments, show dropout students, who needs action, show Sudhanu"
                    className="min-h-[120px]"
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" className="button-primary" onClick={() => void handleGenerate(intent)} disabled={loading}>
                    {loading ? "Thinking..." : "Ask agent"}
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      setQuery("");
                      setResult({
                        mode: "guided_local",
                        answer: "",
                        matchedRecords: [],
                        suggestions: [],
                      });
                    }}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => void handleSendDraftEmail()}
                    disabled={!emailRecipientRecords.length || !result.answer || sendingDraft}
                  >
                    {sendingDraft ? "Sending..." : emailRecipientRecords.length > 1 ? `Send ${emailRecipientRecords.length} emails` : "Send email"}
                  </button>
                </div>

                {result.answer ? (
                  <div className="mt-6 rounded-[24px] border border-sky-100/90 bg-[linear-gradient(145deg,rgba(239,249,255,0.98),rgba(247,250,255,0.96)_55%,rgba(238,242,255,0.98))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_16px_38px_rgba(125,211,252,0.14)] transition duration-300 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_22px_44px_rgba(96,165,250,0.18)]">
                    <p className="bg-gradient-to-r from-sky-700 via-cyan-600 to-indigo-600 bg-clip-text text-[11px] font-bold uppercase tracking-[0.24em] text-transparent">
                      Answer
                    </p>
                    <div className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700 transition duration-300 hover:text-slate-800">
                      {result.answer}
                    </div>
                  </div>
                ) : null}

                {result.matchedRecords?.length ? (
                  <div className="mt-6 rounded-[24px] border border-sky-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,250,255,0.94))] p-5 shadow-[0_16px_40px_rgba(148,163,184,0.12)]">
                    <p className="bg-gradient-to-r from-emerald-700 via-cyan-600 to-sky-700 bg-clip-text text-[11px] font-bold uppercase tracking-[0.24em] text-transparent">
                      Matched records
                    </p>
                    <div className="mt-4 grid gap-3">
                      {result.matchedRecords.map((record) => (
                        <button
                          key={record.id}
                          type="button"
                          className="group rounded-[20px] border border-slate-200 bg-[linear-gradient(145deg,#fbfdff,#f5f9fd_55%,#f5f3ff)] px-4 py-4 text-left shadow-[0_10px_24px_rgba(148,163,184,0.08)] transition duration-300 hover:-translate-y-1 hover:border-sky-200 hover:shadow-[0_18px_32px_rgba(96,165,250,0.14)]"
                          onClick={() => setSelectedRecordId(record.id)}
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="bg-gradient-to-r from-slate-950 via-sky-900 to-violet-700 bg-clip-text text-sm font-semibold text-transparent">
                                {record.studentName}
                              </p>
                              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 transition duration-300 group-hover:tracking-[0.22em] group-hover:text-sky-700">
                                {record.stage} · {record.courseName} · {normalizeBatchName(record.batch) || "N/A"}
                              </p>
                            </div>
                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${urgencyBadgeClass(record.urgencyLevel)}`}>
                              {record.urgencyLevel}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                            <p>Payment: {record.paymentStatus}</p>
                            <p>Due: {record.dueAmount > 0 ? formatCurrency(record.dueAmount) : "No due amount"}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-6">
                <div className="panel border-white/75 bg-white/88 p-5 shadow-[0_26px_60px_rgba(148,163,184,0.16)] backdrop-blur-sm md:p-6">
                  <p className="section-kicker">Action items</p>
                  <div className="mt-4 space-y-3">
                    {result.suggestions.length ? (
                      result.suggestions.map((item) => (
                        <div key={item} className="rounded-[20px] border border-cyan-100 bg-[linear-gradient(145deg,#ffffff,#f0f9ff_52%,#ecfeff)] px-4 py-3 text-sm text-slate-700 shadow-[0_10px_24px_rgba(148,163,184,0.08)] transition duration-300 hover:-translate-y-1 hover:border-sky-200 hover:shadow-[0_18px_32px_rgba(34,211,238,0.14)]">
                          {item}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                        Ask the agent and actions will show here.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

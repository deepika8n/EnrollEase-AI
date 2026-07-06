import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import StudentAvatar from "../components/StudentAvatar";
import { useApp } from "../context/AppContext";
import { addDays } from "../utils/dateMath";
import { downloadTextFile, parseCsv } from "../utils/fileHelpers";
import { formatDate, formatShortDate } from "../utils/formatters";

const csvTemplate = [
  "full_name,email,phone,alternate_phone,course_name,batch,college_name,current_activity,place,address,guardian_name,guardian_relation,guardian_phone,aadhaar_id,pipeline_stage,payment_plan,payment_method,total_fee,amount_paid,installments_planned,lead_date,enrolled_date,follow_up_date,verification_status,enrollment_status,dropout_reason,remarks,notes",
  "Sample Enquiry,sample.enquiry@example.com,9876543210,9876543211,Data Science,Morning,Sample College,Final Year BTech,Hyderabad,Sample Address,Guardian Name,Father,9876543200,1234 5678 9000,Enquiry,One Time,UPI,52000,0,1,2026-06-20,,2026-06-23,Pending,Follow-up,,Imported through CSV,Interested in next batch",
].join("\n");

export default function EnquiriesPage() {
  const { portalRecords, importStudentsFromCsv, updateEnrollmentStatus } = useApp();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const enquiries = useMemo(
    () => portalRecords.filter((record) => record.currentStage === "Enquiry"),
    [portalRecords],
  );

  const handleCsvUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
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

  return (
    <AppShell>
      <PageHeader
        eyebrow="Enquiries"
        title="Follow-up queue"
        description=""
        actions={[
          <button key="upload" type="button" className="button-secondary" onClick={() => fileInputRef.current?.click()}>
            {uploading ? "Uploading..." : "Upload CSV"}
          </button>,
          <button
            key="template"
            type="button"
            className="button-secondary"
            onClick={() => downloadTextFile("enrollease-enquiry-template.csv", csvTemplate, "text/csv;charset=utf-8")}
          >
            Download template
          </button>,
          <Link key="new" to="/enrollments/new" className="button-primary">
            Add new enquiry
          </Link>,
        ]}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleCsvUpload}
      />

      <section className="panel mb-6 p-6">
        <h2 className="section-title">Import enquiries</h2>
        <p className="mt-3 text-sm text-slate-600">
          Upload enquiry leads here first. Later, when someone confirms admission, use `Convert To Enrolled` to complete the admission details on the same record.
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {enquiries.map((record) => (
          <section key={record.id} className="panel p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <StudentAvatar
                  src={record.student.photo_url}
                  name={record.student.full_name}
                  className="h-14 w-14 rounded-2xl object-cover"
                  textClassName="text-sm"
                />
                <div>
                  <p className="font-semibold text-slate-900">{record.student.full_name}</p>
                  <p className="text-sm text-slate-500">{record.course?.course_name || "Course pending"}</p>
                </div>
              </div>
              <StatusBadge value="Follow-up" />
            </div>

            <div className="mt-6 grid gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-slate-500">Lead date</p>
                <p className="mt-1 font-semibold text-slate-900">{formatDate(record.enrollment.lead_date)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-slate-500">Next follow-up</p>
                <p className="mt-1 font-semibold text-slate-900">{formatDate(record.enrollment.follow_up_date)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-slate-500">Current activity</p>
                <p className="mt-1 font-semibold text-slate-900">{record.student.current_activity || "Not shared yet"}</p>
              </div>
            </div>

            <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">Counsellor note</p>
              <p className="mt-2 text-sm text-slate-700">{record.enrollment.remarks || record.student.notes || "No remarks added yet."}</p>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className="button-secondary"
                onClick={() =>
                  updateEnrollmentStatus(record.id, {
                    follow_up_date: addDays(
                      record.enrollment.follow_up_date || record.enrollment.lead_date || new Date().toISOString().slice(0, 10),
                      3,
                    ),
                  })
                }
              >
                Push +3 days
              </button>
              <Link to={`/enrollments/new?convert=${record.enrollment.id}`} className="button-primary">
                Convert To Enrolled
              </Link>
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-xs uppercase tracking-[0.18em] text-slate-400">
              <span>{record.student.place}</span>
              <span>{record.student.phone}</span>
              <span>{formatShortDate(record.enrollment.follow_up_date)}</span>
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}

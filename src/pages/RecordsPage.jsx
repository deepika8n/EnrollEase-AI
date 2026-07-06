import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import DataTable from "../components/DataTable";
import DocumentPreview from "../components/DocumentPreview";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useApp } from "../context/AppContext";
import { openEnrollmentPdf } from "../services/pdfServiceFixed";
import { formatCurrency, formatDate } from "../utils/formatters";

const paymentReceiptTypes = ["Payment Receipt", "Payment proof"];

function findDocumentUrl(record, documentTypes) {
  const types = Array.isArray(documentTypes) ? documentTypes : [documentTypes];
  return record?.documents?.find((item) => types.includes(item.document_type))?.file_url || "";
}

export default function RecordsPage() {
  const { portalRecords, logEmail } = useApp();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ query: "", course: "", payment: "", stage: "" });

  const records = useMemo(() => {
    return portalRecords
      .filter((record) => {
        const query = filters.query.trim().toLowerCase();
        const matchesQuery =
          !query
          || record.student.full_name.toLowerCase().includes(query)
          || record.student.phone.toLowerCase().includes(query)
          || record.student.email.toLowerCase().includes(query);

        return (
          matchesQuery
          && (!filters.course || record.course?.course_name === filters.course)
          && (!filters.payment || record.enrollment.payment_status === filters.payment)
          && (!filters.stage || record.currentStage === filters.stage)
        );
      })
      .map((record) => ({
        id: record.id,
        student_id: record.student.id,
        enrollment_id: record.enrollment.id,
        preview: record.student.photo_url || findDocumentUrl(record, "Student Photo") || findDocumentUrl(record, "Aadhaar ID Photo") || findDocumentUrl(record, paymentReceiptTypes),
        student_name: record.student.full_name,
        course: record.course?.course_name || "N/A",
        batch: record.enrollment.batch || (record.isEnquiryRecord ? "Not assigned" : "N/A"),
        phone: record.student.phone || "N/A",
        stage: record.currentStage,
        payment_plan: record.paymentEligible ? record.enrollment.payment_plan : "Payment not initiated",
        payment_status: record.paymentEligible ? record.enrollment.payment_status : "Payment not initiated",
        due_amount: record.paymentEligible ? formatCurrency(record.dueAmount) : "Payment not initiated",
        enrollment_date: formatDate(record.enrollment.enrolled_date || record.enrollment.lead_date),
        raw: record,
      }));
  }, [filters, portalRecords]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Admissions records"
        title="Student records"
        description=""
        actions={[
          <Link key="new" to="/enrollments/new" className="button-primary">
            Add student manually
          </Link>,
        ]}
      />

      <div className="panel mb-6 p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input
            placeholder="Search name, phone, email"
            value={filters.query}
            onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
          />
          <select value={filters.course} onChange={(event) => setFilters((prev) => ({ ...prev, course: event.target.value }))}>
            <option value="">All courses</option>
            {[...new Set(portalRecords.map((record) => record.course?.course_name).filter(Boolean))].map((course) => (
              <option key={course} value={course}>
                {course}
              </option>
            ))}
          </select>
          <select value={filters.payment} onChange={(event) => setFilters((prev) => ({ ...prev, payment: event.target.value }))}>
            <option value="">All payment status</option>
            {["Paid", "Partial", "Pending", "Overdue"].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select value={filters.stage} onChange={(event) => setFilters((prev) => ({ ...prev, stage: event.target.value }))}>
            <option value="">All stages</option>
            {["Enrolled", "Enquiry", "Dropout"].map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DataTable
        columns={[
          {
            key: "preview",
            label: "Preview",
            render: (value, row) => (
              <div className="w-[76px]">
                <DocumentPreview
                  src={value}
                  alt={`${row.student_name} document preview`}
                  title={`${row.student_name} document preview`}
                  fileName={`${row.student_name}-document`}
                  className="h-16 w-16 rounded-2xl border border-slate-200 bg-slate-50 object-cover"
                />
              </div>
            ),
          },
          { key: "student_name", label: "Student" },
          { key: "course", label: "Course" },
          { key: "batch", label: "Batch" },
          { key: "phone", label: "Phone" },
          {
            key: "stage",
            label: "Stage",
            render: (value) => <StatusBadge value={value} />,
          },
          {
            key: "payment_plan",
            label: "Plan",
            render: (value) => <StatusBadge value={value} />,
          },
          { key: "payment_status", label: "Payment", badge: true },
          { key: "due_amount", label: "Due" },
          { key: "enrollment_date", label: "Date" },
          {
            key: "actions",
            label: "Actions",
            render: (_, row) => (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate(`/students/${row.student_id}`);
                  }}
                >
                  View profile
                </button>
                {row.raw.isEnquiryRecord ? (
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate(`/enrollments/new?convert=${row.enrollment_id}`);
                    }}
                  >
                    Convert
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={(event) => {
                    event.stopPropagation();
                    openEnrollmentPdf({
                      instituteName: "EnrollEase AI Institute",
                      student: row.raw.student,
                      course: row.raw.course,
                      enrollment: row.raw.enrollment,
                    });
                  }}
                >
                  PDF
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={(event) => {
                    event.stopPropagation();
                    logEmail("Enrollment confirmed", row.raw.enrollment);
                  }}
                >
                  Email
                </button>
              </div>
            ),
          },
        ]}
        rows={records}
        onRowClick={(row) => navigate(`/students/${row.student_id}`)}
      />
    </AppShell>
  );
}

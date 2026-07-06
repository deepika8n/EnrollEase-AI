import AppShell from "../components/AppShell";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useApp } from "../context/AppContext";
import { formatCurrency, formatDate } from "../utils/formatters";
import { isOneTimeEnrollment } from "../utils/paymentHelpers";

export default function PaymentsClearedPage() {
  const { portalRecords } = useApp();

  const rows = portalRecords
    .filter((record) => record.paymentEligible && isOneTimeEnrollment(record.enrollment))
    .map((record) => ({
      id: record.id,
      student: record.student.full_name,
      course: record.course?.course_name || "N/A",
      method: record.enrollment.payment_method || "N/A",
      total_fee: formatCurrency(record.enrollment.total_fee),
      paid: formatCurrency(record.enrollment.amount_paid),
      remaining: formatCurrency(record.dueAmount),
      last_payment: formatDate(record.enrollment.last_payment_date || record.enrollment.enrolled_date || record.enrollment.lead_date),
      payment_status: record.enrollment.payment_status,
    }));

  return (
    <AppShell>
      <PageHeader
        eyebrow="One time payments"
        title="Cleared and one-time fee view"
        description=""
      />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="panel p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">One-time records</p>
          <p className="mt-4 font-display text-4xl font-bold text-slate-900">{rows.length}</p>
          <p className="mt-2 text-sm text-slate-600">All students using a single-payment model.</p>
        </div>
        <div className="panel p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Fully cleared</p>
          <p className="mt-4 font-display text-4xl font-bold text-slate-900">
            {rows.filter((row) => row.payment_status === "Paid").length}
          </p>
          <p className="mt-2 text-sm text-slate-600">Students with no one-time balance left.</p>
        </div>
        <div className="panel p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Pending balance</p>
          <p className="mt-4 font-display text-4xl font-bold text-slate-900">
            {formatCurrency(
              portalRecords
                .filter((record) => record.paymentEligible && isOneTimeEnrollment(record.enrollment))
                .reduce((sum, record) => sum + Number(record.dueAmount || 0), 0),
            )}
          </p>
          <p className="mt-2 text-sm text-slate-600">Outstanding one-time amount still to be collected.</p>
        </div>
      </div>

      <DataTable
        columns={[
          { key: "student", label: "Student" },
          { key: "course", label: "Course" },
          {
            key: "method",
            label: "Method",
            render: (value) => <StatusBadge value={value} />,
          },
          { key: "total_fee", label: "Total fee" },
          { key: "paid", label: "Paid" },
          { key: "remaining", label: "Remaining" },
          { key: "last_payment", label: "Last payment" },
          { key: "payment_status", label: "Status", badge: true },
        ]}
        rows={rows}
      />
    </AppShell>
  );
}

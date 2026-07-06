import AppShell from "../components/AppShell";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useApp } from "../context/AppContext";
import { formatCurrency, formatDate } from "../utils/formatters";
import { isEmiEnrollment } from "../utils/paymentHelpers";

export default function PaymentsEmiPage() {
  const { demoMode, portalRecords, markInstallmentPaid } = useApp();

  const rows = portalRecords
    .filter((record) => record.paymentEligible && isEmiEnrollment(record.enrollment))
    .map((record) => ({
      id: record.id,
      student: record.student.full_name,
      course: record.course?.course_name || "N/A",
      installments: `${record.enrollment.installments_paid || 0}/${record.enrollment.installments_planned || 0}`,
      paid: formatCurrency(record.enrollment.amount_paid),
      remaining: formatCurrency(record.dueAmount),
      installment_amount: formatCurrency(record.enrollment.installment_amount),
      next_due: formatDate(record.enrollment.next_due_date),
      payment_status: record.enrollment.payment_status,
      raw: record,
    }));

  return (
    <AppShell>
      <PageHeader
        eyebrow="Monthly EMI"
        title="EMI collection tracker"
        description=""
      />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="panel p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">EMI students</p>
          <p className="mt-4 font-display text-4xl font-bold text-slate-900">{rows.length}</p>
          <p className="mt-2 text-sm text-slate-600">Students currently paying through installments.</p>
        </div>
        <div className="panel p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Collected so far</p>
          <p className="mt-4 font-display text-4xl font-bold text-slate-900">
            {formatCurrency(
              rows.reduce((sum, row) => sum + Number(row.raw.enrollment.amount_paid || 0), 0),
            )}
          </p>
          <p className="mt-2 text-sm text-slate-600">Total EMI amount already received.</p>
        </div>
        <div className="panel p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Still due</p>
          <p className="mt-4 font-display text-4xl font-bold text-slate-900">
            {formatCurrency(rows.reduce((sum, row) => sum + Number(row.raw.dueAmount || 0), 0))}
          </p>
          <p className="mt-2 text-sm text-slate-600">Auto-calculated remaining balance across all EMI accounts.</p>
        </div>
      </div>

      {!rows.length && !demoMode ? (
        <div className="panel border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          EMI records are still empty. If those students were saved before the payment columns existed in Supabase,
          run `supabase/fix_missing_profile_payment_columns.sql` or `supabase/fix_enrollment_access.sql`, then open
          each student once and save/update the payment details again.
        </div>
      ) : null}

      <DataTable
        columns={[
          { key: "student", label: "Student" },
          { key: "course", label: "Course" },
          { key: "installments", label: "Installments" },
          { key: "paid", label: "Paid" },
          { key: "remaining", label: "Remaining" },
          { key: "installment_amount", label: "Per EMI" },
          { key: "next_due", label: "Next due" },
          {
            key: "payment_status",
            label: "Status",
            render: (value) => <StatusBadge value={value} />,
          },
          {
            key: "actions",
            label: "Action",
            render: (_, row) => (
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={(event) => {
                  event.stopPropagation();
                  markInstallmentPaid(row.id);
                }}
                disabled={row.raw.dueAmount <= 0}
              >
                {row.raw.dueAmount <= 0 ? "Cleared" : "Mark next EMI paid"}
              </button>
            ),
          },
        ]}
        rows={rows}
      />
    </AppShell>
  );
}

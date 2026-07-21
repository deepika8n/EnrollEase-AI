import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useApp } from "../context/AppContext";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "../utils/formatters";
import { isEmiEnrollment, isOneTimeEnrollment } from "../utils/paymentHelpers";

function PaymentOverviewCard({ label, value, note }) {
  return (
    <article className="panel overflow-hidden p-5">
      <p className="surface-label">{label}</p>
      <p className="mt-4 font-display text-3xl font-semibold tracking-[-0.04em] text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-600">{note}</p>
    </article>
  );
}

export default function PaymentsPage() {
  const { portalRecords, sendPaymentEmail } = useApp();
  const navigate = useNavigate();
  const [paymentFilter, setPaymentFilter] = useState("all");

  const paymentRecords = useMemo(
    () => portalRecords.filter((record) => record.paymentEligible && record.isEnrolledRecord),
    [portalRecords],
  );

  const oneTimeRows = useMemo(
    () =>
      paymentRecords
        .filter((record) => isOneTimeEnrollment(record.enrollment))
        .map((record) => ({
          id: record.enrollment.id,
          student_id: record.student.id,
          student_email: record.student.email || "",
          student: record.student.full_name,
          course: record.course?.course_name || "N/A",
          method: record.enrollment.payment_method || "N/A",
          course_fee: formatCurrency(record.enrollment.total_fee),
          paid: formatCurrency(record.enrollment.amount_paid),
          remaining: formatCurrency(record.dueAmount),
          paid_date: formatDate(record.enrollment.last_payment_date),
          payment_status: record.dueAmount <= 0 ? "Cleared" : record.enrollment.payment_status,
        })),
    [paymentRecords],
  );

  const emiRows = useMemo(
    () =>
      paymentRecords
        .filter((record) => isEmiEnrollment(record.enrollment))
        .map((record) => ({
          id: record.enrollment.id,
          student_id: record.student.id,
          student_email: record.student.email || "",
          student: record.student.full_name,
          course: record.course?.course_name || "N/A",
          method: record.enrollment.payment_method || "N/A",
          course_fee: formatCurrency(record.enrollment.total_fee),
          number_of_installments: `${record.enrollment.installments_paid || 0}/${record.enrollment.installments_planned || 0}`,
          paid: formatCurrency(record.enrollment.amount_paid),
          remaining: formatCurrency(record.dueAmount),
          next_due: formatDate(record.enrollment.next_due_date),
          payment_status: record.dueAmount <= 0 ? "Cleared" : record.enrollment.payment_status,
        })),
    [paymentRecords],
  );

  const totals = useMemo(() => {
    const expected = paymentRecords.reduce((sum, record) => sum + Number(record.enrollment.total_fee || 0), 0);
    const collected = paymentRecords.reduce((sum, record) => sum + Number(record.enrollment.amount_paid || 0), 0);
    const pending = paymentRecords.filter((record) => record.dueAmount > 0).length;
    const collectionRate = expected ? (collected / expected) * 100 : 0;

    return {
      expected,
      collected,
      pending,
      collectionRate,
    };
  }, [paymentRecords]);

  const showOneTimeSection = paymentFilter === "all" || paymentFilter === "one_time";
  const showEmiSection = paymentFilter === "all" || paymentFilter === "emi";

  return (
    <AppShell>
      <PageHeader
        eyebrow="Payments"
        title="Collections overview"
      />

      <section className="panel p-4">
        <div className="flex flex-wrap gap-3">
          {[
            { key: "all", label: "All Payments" },
            { key: "one_time", label: "One-Time" },
            { key: "emi", label: "EMI" },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                paymentFilter === option.key
                  ? "border-brand-500 bg-brand-500 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              onClick={() => setPaymentFilter(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <PaymentOverviewCard
          label="Total Revenue"
          value={formatCurrency(totals.collected)}
          note="Amount already collected across all enrolled students."
        />
        <PaymentOverviewCard
          label="Outstanding Balance"
          value={formatCurrency(Math.max(totals.expected - totals.collected, 0))}
          note="Balance still pending across active admissions."
        />
        <PaymentOverviewCard
          label="Pending Payments"
          value={formatNumber(totals.pending)}
          note="Students who still have an open payment balance."
        />
        <PaymentOverviewCard
          label="Collection Rate"
          value={formatPercent(totals.collectionRate)}
          note="Overall fee realization against expected revenue."
        />
      </section>

      {showOneTimeSection ? (
      <section className="panel p-6">
        <div className="mb-5">
          <p className="section-kicker">One-Time Payments</p>
          <h2 className="section-title">Single-payment students</h2>
        </div>

        <DataTable
          columns={[
            { key: "student", label: "Student" },
            { key: "course", label: "Course" },
            { key: "method", label: "Method" },
            { key: "course_fee", label: "Course Fee" },
            { key: "paid", label: "Paid" },
            { key: "remaining", label: "Remaining" },
            { key: "paid_date", label: "Paid Date" },
            { key: "payment_status", label: "Status", badge: true },
            {
              key: "actions",
              label: "Actions",
              render: (_, row) => (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="button-secondary px-3 py-2 text-xs"
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate(`/students/${row.student_id}`);
                    }}
                  >
                    View
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={async (event) => {
                      event.stopPropagation();
                      await sendPaymentEmail(row.id);
                    }}
                    disabled={!row.student_email}
                  >
                    Send Email
                  </button>
                </div>
              ),
            },
          ]}
          rows={oneTimeRows}
          onRowClick={(row) => navigate(`/students/${row.student_id}`)}
        />
      </section>
      ) : null}

      {showEmiSection ? (
      <section className="panel p-6">
        <div className="mb-5">
          <p className="section-kicker">EMI Payments</p>
          <h2 className="section-title">Installment tracker</h2>
        </div>

        <DataTable
          columns={[
            { key: "student", label: "Student" },
            { key: "course", label: "Course" },
            { key: "method", label: "Method" },
            { key: "course_fee", label: "Course Fee" },
            { key: "number_of_installments", label: "Number of Installments" },
            { key: "paid", label: "Paid" },
            { key: "remaining", label: "Remaining" },
            { key: "next_due", label: "Next Due Date" },
            {
              key: "payment_status",
              label: "Status",
              render: (value) => <StatusBadge value={value} />,
            },
            {
              key: "actions",
              label: "Action",
              render: (_, row) => (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="button-secondary px-3 py-2 text-xs"
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate(`/students/${row.student_id}`);
                    }}
                  >
                    View
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={async (event) => {
                      event.stopPropagation();
                      await sendPaymentEmail(row.id, { emailVariant: "due_reminder" });
                    }}
                    disabled={!row.student_email}
                  >
                    Send Email
                  </button>
                </div>
              ),
            },
          ]}
          rows={emiRows}
          onRowClick={(row) => navigate(`/students/${row.student_id}`)}
        />
      </section>
      ) : null}
    </AppShell>
  );
}

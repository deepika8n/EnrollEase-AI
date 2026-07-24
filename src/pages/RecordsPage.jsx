import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { useApp } from "../context/AppContext";
import { formatCurrency, formatDate } from "../utils/formatters";
import {
  inferPaymentPlan,
  resolveAmountPaid,
  resolveRemainingAmount,
  toNumberOrNull,
} from "../utils/paymentHelpers";

function getPaymentPlan(record) {
  return inferPaymentPlan({
    paymentPlan: record.enrollment.payment_plan,
    installmentsPlanned: record.enrollment.installments_planned,
    history: record.enrollment.payment_history,
    amountPaid: resolveAmountPaid(record.enrollment.amount_paid, record.enrollment.payment_history),
  }) || "N/A";
}

function getCourseFee(record) {
  return toNumberOrNull(record.enrollment.total_fee) ?? toNumberOrNull(record.course?.fee);
}

function getEnrollmentSortTime(record) {
  const primaryDate = record.enrollment.enrolled_date || record.enrollment.created_at || record.enrollment.lead_date;
  const parsedTime = Date.parse(primaryDate || "");
  return Number.isNaN(parsedTime) ? 0 : parsedTime;
}

export default function RecordsPage() {
  const { portalRecords, deleteStudentRecord } = useApp();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    query: "",
    course: "",
    batch: "",
    plan: "",
    payment: "",
  });

  const enrolledRecords = useMemo(
    () =>
      portalRecords
        .filter((record) => record.isEnrolledRecord)
        .sort((left, right) => getEnrollmentSortTime(right) - getEnrollmentSortTime(left)),
    [portalRecords],
  );

  const records = useMemo(() => {
    return enrolledRecords
      .filter((record) => {
        const query = filters.query.trim().toLowerCase();
        const matchesQuery =
          !query
          || (record.student.student_code || "").toLowerCase().includes(query)
          || record.student.full_name.toLowerCase().includes(query)
          || (record.student.email || "").toLowerCase().includes(query)
          || record.student.phone.toLowerCase().includes(query)
          || (record.course?.course_name || "").toLowerCase().includes(query)
          || (record.enrollment.batch || "").toLowerCase().includes(query);

        return (
          matchesQuery
          && (!filters.course || record.course?.course_name === filters.course)
          && (!filters.batch || (record.enrollment.batch || "N/A") === filters.batch)
          && (!filters.plan || getPaymentPlan(record) === filters.plan)
          && (!filters.payment || (record.enrollment.payment_status || "Pending") === filters.payment)
        );
      })
      .map((record) => {
        const courseFee = getCourseFee(record);
        const amountPaid = resolveAmountPaid(record.enrollment.amount_paid, record.enrollment.payment_history);
        const dueAmount = resolveRemainingAmount(courseFee, amountPaid);

        return {
          id: record.id,
          student_id: record.student.id,
          enrollment_id: record.enrollment.id,
          student_code: record.student.student_code || "N/A",
          student_name: record.student.full_name,
          student_email: record.student.email || "N/A",
          enrollment_date: formatDate(record.enrollment.enrolled_date || record.enrollment.lead_date),
          course: record.course?.course_name || "N/A",
          batch: record.enrollment.batch || "N/A",
          phone: record.student.phone || "N/A",
          course_fee: courseFee === null ? "N/A" : formatCurrency(courseFee),
          payment_plan: getPaymentPlan(record),
          payment_status: record.enrollment.payment_status || "Pending",
          due_amount: dueAmount === null ? "N/A" : formatCurrency(dueAmount),
        };
      });
  }, [enrolledRecords, filters]);

  const courseOptions = useMemo(
    () => [...new Set(enrolledRecords.map((record) => record.course?.course_name).filter(Boolean))],
    [enrolledRecords],
  );

  const batchOptions = useMemo(
    () => [...new Set(enrolledRecords.map((record) => record.enrollment.batch || "N/A"))],
    [enrolledRecords],
  );

  const planOptions = useMemo(
    () => [...new Set(enrolledRecords.map((record) => getPaymentPlan(record)).filter(Boolean))],
    [enrolledRecords],
  );

  return (
    <AppShell>
      <PageHeader
        eyebrow="Admissions records"
        title="Student records"
        description="Search, filter, and review enrolled students from one structured records workspace."
        actions={[
          <Link key="new" to="/enrollment" className="button-primary">
            Add student manually
          </Link>,
        ]}
      />

      <div className="panel mb-6 p-6">
        <div className="mb-5">
          <p className="section-kicker">Filters</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <input
            placeholder="Search code, name or phone"
            value={filters.query}
            onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
          />
          <select value={filters.course} onChange={(event) => setFilters((prev) => ({ ...prev, course: event.target.value }))}>
            <option value="">All courses</option>
            {courseOptions.map((course) => (
              <option key={course} value={course}>
                {course}
              </option>
            ))}
          </select>
          <select value={filters.batch} onChange={(event) => setFilters((prev) => ({ ...prev, batch: event.target.value }))}>
            <option value="">All batches</option>
            {batchOptions.map((batch) => (
              <option key={batch} value={batch}>
                {batch}
              </option>
            ))}
          </select>
          <select value={filters.plan} onChange={(event) => setFilters((prev) => ({ ...prev, plan: event.target.value }))}>
            <option value="">All plans</option>
            {planOptions.map((plan) => (
              <option key={plan} value={plan}>
                {plan}
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
        </div>
      </div>

      <DataTable
        columns={[
          { key: "student_code", label: "Student ID" },
          { key: "student_name", label: "Name" },
          { key: "student_email", label: "Email" },
          { key: "enrollment_date", label: "Lead / enrolled date" },
          { key: "course", label: "Course" },
          { key: "batch", label: "Batch" },
          { key: "phone", label: "Phone" },
          { key: "course_fee", label: "Course fee" },
          {
            key: "payment_plan",
            label: "Plan",
            render: (value) => <StatusBadge value={value} />,
          },
          { key: "payment_status", label: "Payment", badge: true },
          { key: "due_amount", label: "Due" },
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
                  View profile
                </button>
                <button
                  type="button"
                  className="button-secondary px-3 py-2 text-xs"
                  onClick={async (event) => {
                    event.stopPropagation();
                    const shouldDelete = window.confirm(`Delete ${row.student_name} from student records?`);
                    if (!shouldDelete) return;

                    try {
                      await deleteStudentRecord(row.enrollment_id);
                    } catch (error) {
                      window.alert(error.message || "Student record could not be deleted.");
                    }
                  }}
                >
                  Delete
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

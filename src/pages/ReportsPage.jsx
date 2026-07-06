import { useMemo } from "react";
import AppShell from "../components/AppShell";
import PageHeader from "../components/PageHeader";
import { useApp } from "../context/AppContext";
import { formatCurrency, formatNumber } from "../utils/formatters";
import heroAdmissions from "../assets/enrollment-hero.png";

export default function ReportsPage() {
  const { courses, dashboardMetrics, portalRecords } = useApp();

  const { approvedRecords, courseTotals, totalCollected, totalOutstanding } = useMemo(() => {
    const approvedCount = portalRecords.filter((record) => record.verificationEligible && record.enrollment.verification_status === "Approved").length;
    const perCourse = courses
      .map((course) => {
        const relatedRecords = portalRecords.filter((record) => (
          record.course?.id === course.id
          || record.course?.course_name === course.course_name
        ));

        return {
          id: course.id,
          course_name: course.course_name,
          enrollments: relatedRecords.length,
          enquiries: relatedRecords.filter((record) => record.isEnquiryRecord).length,
          enrolled: relatedRecords.filter((record) => record.isEnrolledRecord).length,
          approved: relatedRecords.filter((record) => record.verificationEligible && record.enrollment.verification_status === "Approved").length,
          emiStudents: relatedRecords.filter((record) => record.paymentEligible && record.enrollment.payment_plan === "EMI").length,
          collectedRevenue: relatedRecords.reduce((sum, record) => sum + (record.paymentEligible ? Number(record.enrollment.amount_paid || 0) : 0), 0),
          outstandingRevenue: relatedRecords.reduce((sum, record) => sum + Number(record.dueAmount || 0), 0),
        };
      })
      .sort((left, right) => right.enrollments - left.enrollments || right.collectedRevenue - left.collectedRevenue);

    return {
      approvedRecords: approvedCount,
      courseTotals: perCourse,
      totalCollected: portalRecords.reduce((sum, record) => sum + (record.paymentEligible ? Number(record.enrollment.amount_paid || 0) : 0), 0),
      totalOutstanding: portalRecords.reduce((sum, record) => sum + Number(record.dueAmount || 0), 0),
    };
  }, [courses, portalRecords]);
  const maxEnrollmentCount = Math.max(...courseTotals.map((item) => item.enrollments), 1);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Reports"
        title="Course performance and enrollment metrics"
        description="Live reports generated from the same enrollment, payment, and verification records used across the portal."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="panel overflow-hidden p-0">
          <img
            src={heroAdmissions}
            alt="Student enrollment consultation"
            className="h-72 w-full object-cover"
          />
          <div className="p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-accent-600">Reports overview</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-slate-900">See enrollment performance clearly</h2>
            <p className="mt-3 text-slate-600">
              Track actual admissions demand, collected revenue, outstanding balances, and verification progress without placeholder values.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Collected revenue</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{formatCurrency(totalCollected)}</p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Outstanding revenue</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">{formatCurrency(totalOutstanding)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {[
            { id: "enquiries", label: "Active enquiries", value: formatNumber(dashboardMetrics.totalEnquiries) },
            { id: "enrolled", label: "Enrolled students", value: formatNumber(dashboardMetrics.totalEnrolled) },
            { id: "approved", label: "Approved verifications", value: formatNumber(approvedRecords) },
            { id: "dropouts", label: "Dropouts", value: formatNumber(dashboardMetrics.dropouts) },
          ].map((item) => (
            <div key={item.id} className="panel p-6">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
              <p className="mt-4 font-display text-4xl font-bold text-slate-900">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {courseTotals.map((item) => (
          <div key={item.id} className="panel p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">{item.course_name}</p>
            <p className="mt-4 font-display text-4xl font-bold text-slate-900">{formatNumber(item.enrollments)}</p>
            <p className="mt-2 text-slate-600">Collected: {formatCurrency(item.collectedRevenue)}</p>
            <p className="mt-1 text-slate-600">Outstanding: {formatCurrency(item.outstandingRevenue)}</p>
            <p className="mt-1 text-slate-600">Enquiries: {formatNumber(item.enquiries)} | Enrolled: {formatNumber(item.enrolled)}</p>
            <p className="mt-1 text-slate-600">Approved: {formatNumber(item.approved)} | EMI: {formatNumber(item.emiStudents)}</p>
            <div className="mt-5 h-3 rounded-full bg-slate-100">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-accent-500 to-coral"
                style={{ width: `${(item.enrollments / maxEnrollmentCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

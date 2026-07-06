import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import StudentAvatar from "../components/StudentAvatar";
import { useApp } from "../context/AppContext";
import { formatCurrency, formatNumber, formatPercent, formatShortDate } from "../utils/formatters";

function StatBox({ label, value }) {
  return (
    <div className="panel p-6">
      <p className="text-sm uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-4 font-display text-4xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

export default function DashboardPageSimple() {
  const { dashboardMetrics, portalRecords } = useApp();

  const courseLeads = portalRecords.reduce((accumulator, record) => {
    const key = record.course?.course_name || "Unknown";
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  const topCourses = Object.entries(courseLeads)
    .map(([course, count]) => ({ course, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);

  const recentRecords = portalRecords.slice(0, 6);
  const pendingRecords = portalRecords.filter((record) => record.isEnquiryRecord).slice(0, 5);
  const maxCourseCount = Math.max(...topCourses.map((item) => item.count), 1);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Dashboard"
        title="Admissions Dashboard"
        description=""
        actions={[
          <Link key="new" to="/enrollments/new" className="button-primary">
            New Enrollment
          </Link>,
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatBox label="Total Enquiries" value={formatNumber(dashboardMetrics.totalEnquiries)} />
        <StatBox label="Total Enrolled" value={formatNumber(dashboardMetrics.totalEnrolled)} />
        <StatBox label="Pending" value={formatNumber(dashboardMetrics.pending)} />
        <StatBox label="Conversion Rate" value={formatPercent(dashboardMetrics.conversionRate)} />
        <StatBox label="Dropouts" value={formatNumber(dashboardMetrics.dropouts)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <section className="panel p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="section-title">Recent Students</h2>
            <Link to="/students" className="text-sm font-semibold text-sky-700">
              View all
            </Link>
          </div>

          <div className="space-y-4">
            {recentRecords.map((record) => (
              <div key={record.id} className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <StudentAvatar
                    src={record.student.photo_url}
                    name={record.student.full_name}
                    className="h-14 w-14 rounded-2xl object-cover"
                    textClassName="text-sm"
                  />
                  <div>
                    <p className="font-semibold text-slate-900">{record.student.full_name}</p>
                    <p className="text-sm text-slate-500">{record.course?.course_name || "N/A"} | {record.enrollment.batch}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge value={record.currentStage} />
                  <StatusBadge value={record.paymentEligible ? record.enrollment.payment_status : "Payment not initiated"} />
                  <span className="text-sm text-slate-500">{formatShortDate(record.enrollment.lead_date)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-6">
          <section className="panel p-6">
            <h2 className="section-title">Course Demand</h2>
            <div className="mt-6 space-y-4">
              {topCourses.map((item) => (
                <div key={item.course}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{item.course}</p>
                    <p className="text-sm text-slate-500">{item.count}</p>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100">
                    <div
                      className="h-3 rounded-full bg-gradient-to-r from-sky-500 to-cyan-400"
                      style={{ width: `${(item.count / maxCourseCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel p-6">
            <h2 className="section-title">Pending Follow-up</h2>
            <div className="mt-6 space-y-4">
              {pendingRecords.map((record) => (
                <div key={record.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{record.student.full_name}</p>
                      <p className="text-sm text-slate-500">{record.course?.course_name || "N/A"}</p>
                    </div>
                    <StatusBadge value="Follow-up" />
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    Follow-up due on {formatShortDate(record.enrollment.follow_up_date || record.enrollment.lead_date)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}


import { useEffect, useMemo, useState } from "react";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Line, Pie } from "react-chartjs-2";
import AppShell from "../components/AppShell";
import PageHeader from "../components/PageHeader";
import { useApp } from "../context/AppContext";
import { formatDate, formatNumber, formatPercent } from "../utils/formatters";

ChartJS.register(ArcElement, BarElement, CategoryScale, Legend, LineElement, LinearScale, PointElement, Tooltip);

const CHART_COLORS = {
  navy: "#0B3558",
  blue: "#2F80ED",
  green: "#1ECF6B",
  amber: "#F5D247",
  rose: "#F43F5E",
  slate: "#64748B",
};
const HIDDEN_DROPOUT_STUDENTS = new Set([
  "dhananjaya j n",
  "chandana k r",
]);

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function normalizeStudentName(value = "") {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function toMonthKey(value) {
  const date = parseDate(value);
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(key) {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(date);
}

function getMonthWindow(totalMonths = 6) {
  const today = new Date();
  return Array.from({ length: totalMonths }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (totalMonths - 1 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return { key, label: formatMonthLabel(key) };
  });
}

function SummaryIcon({ children, className }) {
  return (
    <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${className}`}>
      {children}
    </div>
  );
}

function SummaryCard({ title, value, subtitle, icon, panelClass, iconClass, onClick }) {
  const Container = onClick ? "button" : "article";

  return (
    <Container
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`rounded-[20px] border px-3.5 py-3 text-left shadow-[0_12px_24px_rgba(15,23,42,0.05)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_28px_rgba(15,23,42,0.08)] ${onClick ? "w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-300" : ""} ${panelClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{title}</p>
          <p className="mt-2 font-display text-[2.15rem] font-semibold tracking-[-0.04em] leading-none text-slate-950">{value}</p>
          <p className="mt-1 text-[11px] text-slate-600">{subtitle}</p>
        </div>
        <SummaryIcon className={iconClass}>{icon}</SummaryIcon>
      </div>
    </Container>
  );
}

function DashboardCard({ title, subtitle, children }) {
  return (
    <section className="panel p-5 md:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ message, height = "h-[260px]" }) {
  return (
    <div className={`flex ${height} items-center justify-center rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm font-semibold text-slate-500`}>
      {message}
    </div>
  );
}

function ProgressRow({ label, value, percent }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <span className="text-sm font-semibold text-slate-500">{formatNumber(value)}</span>
      </div>
      <div className="h-3 rounded-full bg-slate-100">
        <div
          className="h-3 rounded-full bg-gradient-to-r from-brand-500 via-accent-500 to-[#96bfd1] transition-[width] duration-[2000ms] ease-out"
          style={{ width: `${Math.max(percent, 0)}%` }}
        />
      </div>
    </div>
  );
}

function EnquiryIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <path d="M5 7h14M5 12h14M5 17h8" strokeLinecap="round" />
      <circle cx="18" cy="17" r="2.5" />
    </svg>
  );
}

function StudentIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <path d="M4.5 18.5V7.5A1.5 1.5 0 0 1 6 6h12a1.5 1.5 0 0 1 1.5 1.5v11" />
      <path d="m8.5 12.5 2 2 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ConversionIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <path d="M6 16V8M12 16V5M18 16v-3" strokeLinecap="round" />
      <path d="m4.5 18.5 15-15" strokeLinecap="round" />
      <path d="M15.5 3.5h4v4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DropoutIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M8 8l8 8M16 8l-8 8" strokeLinecap="round" />
    </svg>
  );
}

export default function DashboardHoverPage() {
  const { portalRecords, dashboardMetrics, updateEnrollmentStatus } = useApp();
  const [chartReplay, setChartReplay] = useState({
    enquiries: 0,
    payment: 0,
    monthly: 0,
    course: 0,
  });
  const [showDropoutPanel, setShowDropoutPanel] = useState(false);
  const [dropoutReasonDrafts, setDropoutReasonDrafts] = useState({});
  const [savingDropoutId, setSavingDropoutId] = useState("");
  const [hoverMotion, setHoverMotion] = useState({
    course: true,
  });

  const triggerChartHover = (chartKey) => {
    setChartReplay((prev) => ({
      ...prev,
      [chartKey]: prev[chartKey] + 1,
    }));

    if (!["course"].includes(chartKey)) {
      return;
    }

    setHoverMotion((prev) => ({
      ...prev,
      [chartKey]: false,
    }));

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setHoverMotion((prev) => ({
          ...prev,
          [chartKey]: true,
        }));
      });
    });
  };

  const dashboard = useMemo(() => {
    const monthWindow = getMonthWindow(6);
    const monthIndex = Object.fromEntries(monthWindow.map((item, index) => [item.key, index]));
    const enquiriesByMonth = monthWindow.map(() => 0);
    const enrollmentsByMonth = monthWindow.map(() => 0);
    const admissionsTrend = monthWindow.map(() => 0);
    const paymentStatus = { Paid: 0, Partial: 0, Pending: 0 };
    const courseDistributionMap = new Map();
    const enquiryStudentIds = new Set();
    const enrollmentStudentIds = new Set();

    portalRecords.forEach((record) => {
      const studentId = record.student?.id || record.id;
      const courseName = record.course?.course_name || "Unknown Course";
      const leadMonthIndex = monthIndex[toMonthKey(record.enrollment.lead_date || record.enrollment.created_at)];
      const enrolledMonthIndex = monthIndex[toMonthKey(record.enrollment.enrolled_date)];

      if (leadMonthIndex !== undefined && !enquiryStudentIds.has(studentId)) {
        enquiriesByMonth[leadMonthIndex] += 1;
        enquiryStudentIds.add(studentId);
      }

      if (record.course?.course_name && !record.isDropoutRecord) {
        courseDistributionMap.set(courseName, (courseDistributionMap.get(courseName) || 0) + 1);
      }

      if (record.isEnrolledRecord && !enrollmentStudentIds.has(studentId)) {
        if (enrolledMonthIndex !== undefined) {
          enrollmentsByMonth[enrolledMonthIndex] += 1;
          admissionsTrend[enrolledMonthIndex] += 1;
        }
        enrollmentStudentIds.add(studentId);

        const statusKey =
          record.enrollment.payment_status === "Paid"
            ? "Paid"
            : record.enrollment.payment_status === "Partial"
              ? "Partial"
              : "Pending";
        paymentStatus[statusKey] += 1;
      }
    });

    const courseDistribution = [...courseDistributionMap.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value);
    const dropoutRecords = [...portalRecords]
      .filter((record) => record.isDropoutRecord)
      .filter((record) => !HIDDEN_DROPOUT_STUDENTS.has(normalizeStudentName(record.student?.full_name || "")))
      .sort((left, right) => {
        const rightDate = parseDate(right.enrollment.dropout_date || right.enrollment.follow_up_date || right.enrollment.lead_date || right.enrollment.created_at);
        const leftDate = parseDate(left.enrollment.dropout_date || left.enrollment.follow_up_date || left.enrollment.lead_date || left.enrollment.created_at);
        return (rightDate?.getTime() || 0) - (leftDate?.getTime() || 0);
      });

    return {
      cards: [
        {
          title: "Total Enquiries",
          value: formatNumber(dashboardMetrics.totalEnquiries),
          subtitle: "All enquiries received",
          icon: <EnquiryIcon className="h-4 w-4" />,
          panelClass: "border-sky-200 bg-[linear-gradient(180deg,#f5fbff_0%,#edf7ff_100%)]",
          iconClass: "border-sky-200 bg-sky-100 text-sky-600",
        },
        {
          title: "Total Enrollment",
          value: formatNumber(dashboardMetrics.totalEnrolled),
          subtitle: "Confirmed admissions",
          icon: <StudentIcon className="h-4 w-4" />,
          panelClass: "border-emerald-200 bg-[linear-gradient(180deg,#f3fdf7_0%,#e9faf0_100%)]",
          iconClass: "border-emerald-200 bg-emerald-100 text-emerald-600",
        },
        {
          title: "Conversion Rate",
          value: formatPercent(dashboardMetrics.conversionRate),
          subtitle: "Enquiry to enrollment",
          icon: <ConversionIcon className="h-4 w-4" />,
          panelClass: "border-violet-200 bg-[linear-gradient(180deg,#faf7ff_0%,#f2ecff_100%)]",
          iconClass: "border-violet-200 bg-violet-100 text-violet-600",
        },
        {
          title: "Dropout",
          value: formatNumber(dropoutRecords.length),
          subtitle: dropoutRecords.length ? "Click to review dropout students" : "No dropout students yet",
          icon: <DropoutIcon className="h-4 w-4" />,
          panelClass: "border-rose-200 bg-[linear-gradient(180deg,#fff6f7_0%,#ffedf0_100%)]",
          iconClass: "border-rose-200 bg-rose-100 text-rose-600",
          onClick: () => setShowDropoutPanel((prev) => !prev),
        },
      ],
      enquiriesVsEnrollmentsData: {
        labels: monthWindow.map((item) => item.label),
        datasets: [
          {
            label: "Enquiries",
            data: enquiriesByMonth,
            backgroundColor: "rgba(47,128,237,0.88)",
            borderRadius: 10,
          },
          {
            label: "Enrollments",
            data: enrollmentsByMonth,
            backgroundColor: "rgba(30,207,107,0.88)",
            borderRadius: 10,
          },
        ],
      },
      paymentStatusData: {
        labels: ["Paid", "Partial", "Pending"],
        datasets: [
          {
            data: [paymentStatus.Paid, paymentStatus.Partial, paymentStatus.Pending],
            backgroundColor: [CHART_COLORS.green, CHART_COLORS.amber, CHART_COLORS.rose],
            borderWidth: 0,
          },
        ],
      },
      monthlyAdmissionsData: {
        labels: monthWindow.map((item) => item.label),
        datasets: [
          {
            label: "Admissions",
            data: admissionsTrend,
            borderColor: CHART_COLORS.blue,
            backgroundColor: "rgba(47,128,237,0.12)",
            tension: 0.35,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: CHART_COLORS.blue,
          },
        ],
      },
      courseDistribution,
      dropoutRecords,
      coursePeak: courseDistribution[0]?.value || 0,
      hasData: portalRecords.length > 0,
    };
  }, [dashboardMetrics, portalRecords]);

  useEffect(() => {
    setDropoutReasonDrafts((prev) => {
      const nextDrafts = {};

      dashboard.dropoutRecords.forEach((record) => {
        const enrollmentId = record.enrollment.id;
        nextDrafts[enrollmentId] = Object.prototype.hasOwnProperty.call(prev, enrollmentId)
          ? prev[enrollmentId]
          : (record.enrollment.dropout_reason || "");
      });

      return nextDrafts;
    });
  }, [dashboard.dropoutRecords]);

  const handleDropoutReasonChange = (enrollmentId, value) => {
    setDropoutReasonDrafts((prev) => ({
      ...prev,
      [enrollmentId]: value,
    }));
  };

  const handleSaveDropoutReason = async (record) => {
    const enrollmentId = record.enrollment.id;
    const nextReason = (dropoutReasonDrafts[enrollmentId] || "").trim();

    try {
      setSavingDropoutId(enrollmentId);
      await updateEnrollmentStatus(enrollmentId, {
        pipeline_stage: "Dropout",
        enrollment_status: "Dropped",
        dropout_reason: nextReason,
      });
    } catch (error) {
      window.alert(error.message || "Unable to save the dropout reason right now.");
    } finally {
      setSavingDropoutId("");
    }
  };

  const barOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animations: {
      y: {
        duration: 3000,
        easing: "easeOutBounce",
        from(context) {
          const scale = context.chart.scales.y;
          return scale ? scale.getPixelForValue(0) : undefined;
        },
        delay(context) {
          return context.type === "data" ? context.dataIndex * 120 + context.datasetIndex * 90 : 0;
        },
      },
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          usePointStyle: true,
          boxWidth: 10,
          color: CHART_COLORS.navy,
          padding: 18,
        },
      },
      tooltip: {
        backgroundColor: "rgba(11,53,88,0.94)",
        padding: 12,
        cornerRadius: 12,
      },
    },
    scales: {
      x: {
        ticks: { color: CHART_COLORS.slate },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: { color: CHART_COLORS.slate, precision: 0 },
        grid: { color: "rgba(148,163,184,0.16)" },
      },
    },
  }), []);

  const lineOptions = useMemo(() => ({
    ...barOptions,
    animations: {
      x: {
        type: "number",
        duration: 2000,
        easing: "easeOutQuart",
        from(context) {
          const scale = context.chart.scales.x;
          return scale ? scale.left : 0;
        },
        delay(context) {
          return context.type === "data" ? context.dataIndex * 80 : 0;
        },
      },
      y: {
        type: "number",
        duration: 2000,
        easing: "easeOutQuart",
        from(context) {
          const scale = context.chart.scales.y;
          return scale ? scale.getPixelForValue(0) : undefined;
        },
        delay(context) {
          return context.type === "data" ? context.dataIndex * 80 : 0;
        },
      },
    },
    plugins: {
      ...barOptions.plugins,
      legend: { display: false },
    },
  }), [barOptions]);

  const circularOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    rotation: -90,
    animation: {
      animateRotate: false,
      animateScale: false,
    },
    animations: {
      startAngle: {
        duration: 2000,
        easing: "easeOutQuart",
        from: -Math.PI / 2,
        delay(context) {
          return context.type === "data" ? context.dataIndex * 240 : 0;
        },
      },
      endAngle: {
        duration: 2000,
        easing: "easeOutQuart",
        from: -Math.PI / 2,
        delay(context) {
          return context.type === "data" ? context.dataIndex * 240 : 0;
        },
      },
      outerRadius: {
        duration: 2000,
        easing: "easeOutQuart",
        from: 0,
      },
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          usePointStyle: true,
          boxWidth: 10,
          color: CHART_COLORS.navy,
          padding: 18,
        },
      },
      tooltip: {
        backgroundColor: "rgba(11,53,88,0.94)",
        padding: 12,
        cornerRadius: 12,
      },
    },
  }), []);

  return (
    <AppShell>
      <PageHeader eyebrow="Dashboard" title="Admissions management overview" />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {dashboard.cards.map((card) => (
          <SummaryCard key={card.title} {...card} />
        ))}
      </section>

      {showDropoutPanel ? (
        <DashboardCard
          title="Dropout students"
          subtitle="Review dropped enquiries, see their dates, and capture the reason from the dashboard."
        >
          {dashboard.dropoutRecords.length ? (
            <div className="space-y-4">
              {dashboard.dropoutRecords.map((record) => {
                const enrollmentId = record.enrollment.id;

                return (
                  <article key={enrollmentId} className="rounded-[22px] border border-rose-100 bg-rose-50/50 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-lg font-semibold text-slate-950">{record.student.full_name}</p>
                        <p className="mt-1 text-sm text-slate-600">{record.course?.course_name || "Course not assigned"}</p>
                        <p className="mt-1 text-sm text-slate-500">{record.student.phone || "No phone available"}</p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[18px] border border-white/80 bg-white/80 px-4 py-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Lead date</p>
                          <p className="mt-2 text-sm font-semibold text-slate-900">{formatDate(record.enrollment.lead_date)}</p>
                        </div>
                        <div className="rounded-[18px] border border-white/80 bg-white/80 px-4 py-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Dropout date</p>
                          <p className="mt-2 text-sm font-semibold text-slate-900">{formatDate(record.enrollment.dropout_date)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400" htmlFor={`dropout-reason-${enrollmentId}`}>
                        Dropout reason
                      </label>
                      <textarea
                        id={`dropout-reason-${enrollmentId}`}
                        rows={3}
                        value={dropoutReasonDrafts[enrollmentId] ?? record.enrollment.dropout_reason ?? ""}
                        onChange={(event) => handleDropoutReasonChange(enrollmentId, event.target.value)}
                        placeholder="Mention why this student dropped out."
                        className="mt-2 w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                      />
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleSaveDropoutReason(record)}
                        disabled={savingDropoutId === enrollmentId}
                        className="button-secondary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingDropoutId === enrollmentId ? "Saving..." : "Save reason"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState message="No dropout students are available right now." height="h-[220px]" />
          )}
        </DashboardCard>
      ) : null}

      {!dashboard.hasData ? (
        <DashboardCard
          title="No dashboard data yet"
          subtitle="This overview will populate automatically when Supabase records are available."
        >
          <EmptyState message="No admission records are available yet." />
        </DashboardCard>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-6 xl:grid-cols-2">
            <div onMouseEnter={() => triggerChartHover("enquiries")}>
              <DashboardCard
                title="Enquiries vs Enrollments"
                subtitle="Monthly comparison of incoming leads and confirmed admissions."
              >
                <div className="h-[300px]">
                  <Bar
                    key={`enquiries-${chartReplay.enquiries}`}
                    data={dashboard.enquiriesVsEnrollmentsData}
                    options={barOptions}
                  />
                </div>
              </DashboardCard>
            </div>

            <div onMouseEnter={() => triggerChartHover("payment")}>
              <DashboardCard
                title="Payment Status"
                subtitle="Share of paid, partial, and pending collections."
              >
                <div className="h-[300px]">
                  <Pie
                    key={`payment-${chartReplay.payment}`}
                    data={dashboard.paymentStatusData}
                    options={circularOptions}
                  />
                </div>
              </DashboardCard>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div onMouseEnter={() => triggerChartHover("monthly")}>
              <DashboardCard
                title="Monthly Admissions Trend"
                subtitle="Confirmed admissions across the recent six-month window."
              >
                <div className="h-[300px]">
                  <Line
                    key={`monthly-${chartReplay.monthly}`}
                    data={dashboard.monthlyAdmissionsData}
                    options={lineOptions}
                  />
                </div>
              </DashboardCard>
            </div>

            <div onMouseEnter={() => triggerChartHover("course")}>
              <DashboardCard
                title="Course-wise Distribution"
                subtitle="Enquiry and enrollment volume by course."
              >
                {dashboard.courseDistribution.length ? (
                  <div className="space-y-5">
                    {dashboard.courseDistribution.map((course) => (
                      <ProgressRow
                        key={`${course.label}-${chartReplay.course}`}
                        label={course.label}
                        value={course.value}
                        percent={hoverMotion.course && dashboard.coursePeak ? (course.value / dashboard.coursePeak) * 100 : 0}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No course records available for distribution." height="h-[300px]" />
                )}
              </DashboardCard>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

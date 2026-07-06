import clsx from "clsx";

const styles = {
  Approved: "bg-emerald-100 text-emerald-700",
  Verified: "bg-emerald-100 text-emerald-700",
  Paid: "bg-emerald-100 text-emerald-700",
  Cleared: "bg-emerald-100 text-emerald-700",
  Pending: "bg-amber-100 text-amber-700",
  "Payment not initiated": "bg-slate-100 text-slate-700",
  Partial: "bg-sky-100 text-sky-700",
  Review: "bg-sky-100 text-sky-700",
  Rejected: "bg-rose-100 text-rose-700",
  "Missing Documents": "bg-orange-100 text-orange-700",
  "Requested Correction": "bg-fuchsia-100 text-fuchsia-700",
  Completed: "bg-blue-100 text-blue-700",
  Active: "bg-cyan-100 text-cyan-700",
  "Follow-up": "bg-indigo-100 text-indigo-700",
  Enquiry: "bg-indigo-100 text-indigo-700",
  Enrolled: "bg-emerald-100 text-emerald-700",
  Dropout: "bg-rose-100 text-rose-700",
  Dropped: "bg-rose-100 text-rose-700",
  Overdue: "bg-rose-100 text-rose-700",
  EMI: "bg-violet-100 text-violet-700",
  "One Time": "bg-teal-100 text-teal-700",
  Cash: "bg-amber-100 text-amber-700",
  UPI: "bg-sky-100 text-sky-700",
};

export default function StatusBadge({ value }) {
  return <span className={clsx("status-pill", styles[value] || "bg-white/10 text-slate-200")}>{value}</span>;
}

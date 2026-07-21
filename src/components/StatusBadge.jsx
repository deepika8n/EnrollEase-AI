import clsx from "clsx";

const styles = {
  Approved: "border-accent-200 bg-accent-50 text-accent-700",
  Verified: "border-accent-200 bg-accent-50 text-accent-700",
  Paid: "border-accent-200 bg-accent-50 text-accent-700",
  Cleared: "border-accent-200 bg-accent-50 text-accent-700",
  Pending: "border-gold-200 bg-gold-50 text-[#8A6610]",
  "Payment not initiated": "border-slate-200 bg-surface-100 text-slate-600",
  Partial: "border-brand-200 bg-brand-50 text-brand-500",
  Review: "border-brand-200 bg-brand-50 text-brand-500",
  Rejected: "border-brand-500 bg-brand-500 text-white",
  "Missing Documents": "border-gold-200 bg-gold-50 text-[#8A6610]",
  "Requested Correction": "border-gold-200 bg-gold-50 text-[#8A6610]",
  Completed: "border-brand-200 bg-brand-50 text-brand-600",
  Active: "border-accent-100 bg-accent-50 text-accent-700",
  "Follow-up": "border-brand-200 bg-brand-50 text-brand-600",
  Enquiry: "border-brand-200 bg-brand-50 text-brand-600",
  Enrolled: "border-accent-200 bg-accent-50 text-accent-700",
  Dropout: "border-brand-500 bg-brand-500 text-white",
  Dropped: "border-brand-500 bg-brand-500 text-white",
  Overdue: "border-brand-500 bg-brand-500 text-white",
  EMI: "border-brand-200 bg-brand-50 text-brand-600",
  "One Time": "border-accent-200 bg-accent-50 text-accent-700",
  Cash: "border-gold-200 bg-gold-50 text-[#8A6610]",
  UPI: "border-brand-200 bg-brand-50 text-brand-600",
};

export default function StatusBadge({ value }) {
  return <span className={clsx("status-pill", styles[value] || "border-slate-200 bg-white text-slate-600")}>{value}</span>;
}

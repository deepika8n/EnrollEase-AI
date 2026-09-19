import { useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { paymentMethods } from "../utils/constants";
import { formatCurrency } from "../utils/formatters";
import { addMonthsPreservingDay } from "../utils/dateMath";
import { getTodayIsoDate } from "../utils/enrollmentDateValidation";
import { resolveInstallmentProgress, resolveAmountPaid, resolveNextDueDate } from "../utils/paymentHelpers";

export default function RecordPaymentForm({ record, onClose }) {
  const { markInstallmentPaid } = useApp();
  const { enrollment, student } = record;
  const paid = resolveAmountPaid(enrollment.amount_paid, enrollment.payment_history);
  const balance = Math.max(Number(enrollment.total_fee || 0) - paid, 0);
  const today = getTodayIsoDate();
  const suggestedDueDate = (date) => {
    const due = resolveNextDueDate({ paymentStatus: "Partial", paymentPlan: "EMI",
      enrolledDate: enrollment.enrolled_date, lastPaymentDate: date, today: date });
    return due > date ? due : addMonthsPreservingDay(date, 1);
  };
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState(paymentMethods.includes(enrollment.payment_method) && enrollment.payment_method !== "Pending" ? enrollment.payment_method : "UPI");
  const [nextDueDate, setNextDueDate] = useState(() => suggestedDueDate(today));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const remaining = Math.round((balance - Number(amount || 0)) * 100) / 100;
  const progress = resolveInstallmentProgress(enrollment, Math.max(Number(amount) || 0, 0));

  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      await markInstallmentPaid(enrollment.id, method, { amount, paymentDate: date, nextDueDate });
      onClose();
    } catch (failure) {
      setError(failure.message || "Unable to record payment. Please try again.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <form className="panel space-y-5 p-5 sm:p-6" onSubmit={submit} aria-label={`Record payment for ${student.full_name}`}>
      <div>
        <h2 className="section-title">Record payment</h2>
        <p className="mt-1 text-sm text-slate-600">{student.full_name} · {record.course?.course_name || enrollment.course_name}</p>
        <p className="mt-2 text-sm">Already paid: <strong>{formatCurrency(paid)}</strong> · Remaining: <strong>{formatCurrency(balance)}</strong></p>
      </div>
      <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold">Amount received (Rs)
          <input autoFocus className="w-full" type="number" min="0.01" max={balance} step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} />
          <span className="block text-xs font-normal text-slate-500">Enter only this payment, not the total paid so far.</span>
        </label>
        <label className="space-y-2 text-sm font-semibold">Payment date
          <input className="w-full" type="date" required min={enrollment.last_payment_date || enrollment.enrolled_date || undefined} max={today} value={date} onChange={(event) => { setDate(event.target.value); setNextDueDate(suggestedDueDate(event.target.value)); }} />
        </label>
        <label className="space-y-2 text-sm font-semibold">Payment method
          <select className="w-full" value={method} onChange={(event) => setMethod(event.target.value)}>{paymentMethods.filter((item) => item !== "Pending").map((item) => <option key={item}>{item}</option>)}</select>
        </label>
        {progress.paymentPlan === "EMI" && remaining > 0 ? <label className="space-y-2 text-sm font-semibold">Next due date
          <input className="w-full" type="date" readOnly value={nextDueDate} />
          <span className="block text-xs font-normal text-slate-500">Calculated from the monthly installment schedule.</span>
        </label> : null}
      </fieldset>
      {Number(amount) > 0 && remaining >= 0 ? <p className="rounded-xl bg-slate-50 p-3 text-sm">After saving: total paid <strong>{formatCurrency(paid + Number(amount))}</strong> · remaining <strong>{formatCurrency(remaining)}</strong>{remaining === 0 ? " · Fully paid" : ""}</p> : null}
      {Number(amount) > 0 && remaining >= 0 ? <p className="text-sm text-slate-600">Installments after saving: <strong>{progress.installmentsPaid}/{progress.installmentsPlanned}</strong>. {remaining > 0 ? `${progress.remainingInstallments} remaining. The plan extends automatically when another payment is needed.` : "All payments completed."}</p> : null}
      <p className="text-xs text-slate-500">Saves a new payment-history entry. You can send the payment email after saving.</p>
      {error ? <p role="alert" className="text-sm font-semibold text-red-700">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        <button className="button-primary" type="submit" disabled={saving || balance <= 0}>{saving ? "Saving payment..." : "Save payment"}</button>
        <button className="button-secondary" type="button" disabled={saving} onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

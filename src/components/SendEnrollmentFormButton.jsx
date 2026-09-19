import { useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { canSendStudentEnrollmentForm } from "../utils/studentFormEligibility";

export default function SendEnrollmentFormButton({ record }) {
  const { sendStudentEnrollmentForm } = useApp();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  if (!record || !canSendStudentEnrollmentForm(record.enrollment)) return null;

  const send = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setMessage("");
    try {
      await sendStudentEnrollmentForm(record.enrollment.id);
      setMessage(`Enrollment link emailed to ${record.student.email}. Valid for 7 days.`);
    } catch (error) {
      setMessage(error.message || "Unable to send the enrollment form. Please try again.");
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  return (
    <div className="space-y-2">
      <button type="button" className="button-primary disabled:opacity-60" onClick={send}
        disabled={sending || !record.student?.email}>
        {sending ? "Sending enrollment link..." : "Send enrollment form"}
      </button>
      <p className="text-xs text-slate-600">
        {record.student?.email ? `Emails a secure form link to ${record.student.email}.` : "Add a student email address first."}
      </p>
      {message ? <p className="text-sm font-semibold text-slate-700" role="status">{message}</p> : null}
    </div>
  );
}

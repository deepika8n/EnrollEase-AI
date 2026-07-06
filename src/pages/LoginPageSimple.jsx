import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import enrolleaseLogo from "../assets/enrollease-logo.svg";
import { useApp } from "../context/AppContext";

export default function LoginPageSimple() {
  const { currentUser, login, resetPassword } = useApp();
  const [form, setForm] = useState({ email: "", password: "" });
  const [resetMode, setResetMode] = useState(false);
  const [resetForm, setResetForm] = useState({ email: "admin@enrollease.ai", currentPassword: "", newPassword: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      navigate("/dashboard", { replace: true });
    }
  }, [currentUser, navigate]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/", { replace: true });
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(form);
      navigate("/dashboard", { replace: true });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await resetPassword(resetForm);
      setResetMode(false);
      setResetForm((prev) => ({ ...prev, currentPassword: "", newPassword: "" }));
    } catch (resetError) {
      setError(resetError.message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f9fcff_0%,#eef7ff_100%)] px-4 py-10">
      <div className="panel w-full max-w-md p-8">
        <button type="button" onClick={handleBack} className="text-sm font-semibold text-sky-700">
          {"< Back"}
        </button>

        <div className="flex items-center gap-4">
          <img src={enrolleaseLogo} alt="EnrollEase AI logo" className="h-14 w-14 rounded-[18px]" />
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-sky-700">Admin Login</p>
            <p className="mt-1 text-sm text-slate-500">EnrollEase AI</p>
          </div>
        </div>

        <h1 className="mt-8 font-display text-4xl font-bold text-slate-950">
          {resetMode ? "Reset Password" : "Sign In"}
        </h1>

        {resetMode ? (
          <form onSubmit={handleReset} className="mt-6 space-y-4">
            <input
              type="email"
              value={resetForm.email}
              onChange={(event) => setResetForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="Admin email"
              required
            />
            <input
              type="password"
              value={resetForm.currentPassword}
              onChange={(event) => setResetForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
              placeholder="Current password"
            />
            <input
              type="password"
              value={resetForm.newPassword}
              onChange={(event) => setResetForm((prev) => ({ ...prev, newPassword: event.target.value }))}
              placeholder="New password"
              required
            />
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            <button type="submit" className="button-primary w-full">
              Update Password
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="Admin email"
              required
            />
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="Password"
              required
            />
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            <button type="submit" className="button-primary w-full" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
          <button type="button" className="font-semibold text-sky-700" onClick={() => setResetMode((prev) => !prev)}>
            {resetMode ? "Back to login" : "Reset password"}
          </button>
        </div>
      </div>
    </div>
  );
}

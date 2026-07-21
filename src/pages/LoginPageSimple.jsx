import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";
import { useApp } from "../context/AppContext";

const ADMISSIONS_IMAGE_URL = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSYFPBNPTdO9cfVl5855NkSgmCNM0gMeM05DRSrMT6fIA&s=10";

export default function LoginPageSimple() {
  const { currentUser, login, logout, resetPassword } = useApp();
  const [form, setForm] = useState({ email: "", password: "" });
  const [resetMode, setResetMode] = useState(false);
  const [resetForm, setResetForm] = useState({ email: "admin@enrollease.ai", currentPassword: "", newPassword: "" });
  const [error, setError] = useState("");
  const [imageUnavailable, setImageUnavailable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clearingFreshSession, setClearingFreshSession] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const skipAutoRedirectRef = useRef(false);
  const forceFreshLogin = searchParams.get("fresh") === "1";

  useEffect(() => {
    if (!forceFreshLogin) {
      setClearingFreshSession(false);
      return;
    }

    let active = true;
    skipAutoRedirectRef.current = true;

    if (!currentUser) {
      setClearingFreshSession(false);
      return () => {
        active = false;
      };
    }

    setClearingFreshSession(true);
    void (async () => {
      try {
        await logout();
      } finally {
        if (active) {
          setClearingFreshSession(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [currentUser, forceFreshLogin, logout]);

  useEffect(() => {
    if (currentUser && !skipAutoRedirectRef.current && !forceFreshLogin) {
      navigate("/dashboard", { replace: true });
    }
  }, [currentUser, forceFreshLogin, navigate]);

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
    skipAutoRedirectRef.current = true;
    try {
      await login(form);
      navigate("/dashboard", {
        replace: true,
        state: { showAdminWelcome: true },
      });
    } catch (loginError) {
      skipAutoRedirectRef.current = false;
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
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(11,53,88,0.08),transparent_24%),radial-gradient(circle_at_82%_12%,rgba(77,122,156,0.07),transparent_22%),radial-gradient(circle_at_58%_78%,rgba(30,207,107,0.05),transparent_16%),linear-gradient(180deg,#fcfdff_0%,#f5f8fb_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute left-[7%] top-[10%] h-52 w-52 rounded-full bg-brand-200/16 blur-[110px]" />
      <div className="pointer-events-none absolute right-[9%] top-[18%] h-64 w-64 rounded-full bg-brand-100/18 blur-[130px]" />
      <div className="pointer-events-none absolute bottom-[12%] left-[18%] h-56 w-56 rounded-full bg-accent-100/16 blur-[120px]" />

      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[480px] items-center justify-center">
        <section className="relative w-full overflow-hidden rounded-[24px] border border-white/90 bg-white/92 p-[28px] shadow-[0_30px_80px_rgba(9,30,66,0.14)] backdrop-blur-[18px] animate-[fadeUp_600ms_ease_both]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(255,255,255,0.8))]" />
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-brand-200/65 to-transparent" />
          <div className="relative z-10 flex flex-col">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex h-[38px] w-fit items-center justify-center rounded-full border border-slate-200 bg-white/92 px-3.5 text-sm font-semibold text-slate-600 shadow-[0_8px_18px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:text-brand-500 hover:shadow-[0_12px_24px_rgba(11,53,88,0.10)]"
            >
              Back
            </button>

            <div className="mt-5 flex flex-col items-center">
              <BrandLogo
                size="sm"
                subtitle="Admissions OS"
                className="gap-3"
                iconClassName="h-10 w-10 rounded-[16px] shadow-[0_14px_24px_rgba(11,53,88,0.12)]"
                wordmarkClassName="text-[1.56rem] tracking-[-0.055em]"
                subtitleClassName="text-[11px] tracking-[0.28em] text-brand-500/72"
              />

              <div className="mt-4 flex w-full justify-center">
                <div className="flex min-h-[124px] w-full max-w-[190px] items-center justify-center rounded-[18px] bg-[linear-gradient(180deg,#edf5fb_0%,#f7fbff_100%)] p-2.5 shadow-[0_14px_24px_rgba(11,53,88,0.08)]">
                  {imageUnavailable ? (
                    <div className="flex h-full min-h-[104px] w-full items-center justify-center rounded-[14px] border border-dashed border-brand-200 bg-white/70 px-4 text-center">
                      <p className="text-sm font-medium leading-5 text-slate-500">Admissions preview unavailable</p>
                    </div>
                  ) : (
                    <img
                      src={ADMISSIONS_IMAGE_URL}
                      alt="Admissions counselling session"
                      className="h-auto w-full max-w-[164px] rounded-[14px] object-cover shadow-[0_10px_20px_rgba(11,53,88,0.10)]"
                      onError={() => setImageUnavailable(true)}
                    />
                  )}
                </div>
              </div>

              {resetMode ? (
                <h2 className="mt-5 text-center font-display text-[1.8rem] font-bold tracking-[-0.05em] text-slate-950 sm:text-[2rem]">
                  Reset your password
                </h2>
              ) : null}
            </div>

            {clearingFreshSession ? (
              <p className="mt-5 text-center text-sm font-semibold text-slate-500">Preparing fresh login...</p>
            ) : null}

            {resetMode ? (
              <form onSubmit={handleReset} className="mt-5 flex flex-col gap-[14px]">
              <input
                type="email"
                value={resetForm.email}
                onChange={(event) => setResetForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="Admin Email"
                className="h-[52px] rounded-[14px] border-slate-200 bg-white px-4 text-base text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition duration-200 placeholder:text-slate-400 hover:shadow-[0_12px_28px_rgba(15,23,42,0.07)] focus:border-brand-400 focus:ring-4 focus:ring-accent-100"
                style={{ animation: "fadeUp 500ms ease both", animationDelay: "80ms" }}
                required
              />
              <input
                type="password"
                value={resetForm.currentPassword}
                onChange={(event) => setResetForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                placeholder="Current password"
                className="h-[52px] rounded-[14px] border-slate-200 bg-white px-4 text-base text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition duration-200 placeholder:text-slate-400 hover:shadow-[0_12px_28px_rgba(15,23,42,0.07)] focus:border-brand-400 focus:ring-4 focus:ring-accent-100"
                style={{ animation: "fadeUp 500ms ease both", animationDelay: "140ms" }}
              />
              <input
                type="password"
                value={resetForm.newPassword}
                onChange={(event) => setResetForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                placeholder="New password"
                className="h-[52px] rounded-[14px] border-slate-200 bg-white px-4 text-base text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition duration-200 placeholder:text-slate-400 hover:shadow-[0_12px_28px_rgba(15,23,42,0.07)] focus:border-brand-400 focus:ring-4 focus:ring-accent-100"
                style={{ animation: "fadeUp 500ms ease both", animationDelay: "200ms" }}
                required
              />
              {error ? <p className="text-sm font-semibold text-brand-500">{error}</p> : null}
              <button
                type="submit"
                className="mt-1 inline-flex h-[52px] w-full items-center justify-center rounded-[16px] bg-gradient-to-b from-brand-500 via-brand-600 to-brand-700 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(11,53,88,0.22)] transition duration-200 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_22px_44px_rgba(11,53,88,0.26)] focus:outline-none focus:ring-4 focus:ring-accent-100"
                style={{ animation: "fadeUp 500ms ease both", animationDelay: "260ms" }}
              >
                Update Password
              </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="mt-5 flex flex-col gap-[14px]">
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="Admin Email"
                className="h-[52px] rounded-[14px] border-slate-200 bg-white px-4 text-base text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition duration-200 placeholder:text-slate-400 hover:shadow-[0_12px_28px_rgba(15,23,42,0.07)] focus:border-brand-400 focus:ring-4 focus:ring-accent-100"
                style={{ animation: "fadeUp 500ms ease both", animationDelay: "80ms" }}
                required
              />
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="Password"
                className="h-[52px] rounded-[14px] border-slate-200 bg-white px-4 text-base text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition duration-200 placeholder:text-slate-400 hover:shadow-[0_12px_28px_rgba(15,23,42,0.07)] focus:border-brand-400 focus:ring-4 focus:ring-accent-100"
                style={{ animation: "fadeUp 500ms ease both", animationDelay: "160ms" }}
                required
              />
              {error ? <p className="text-sm font-semibold text-brand-500">{error}</p> : null}
              <button
                type="submit"
                className="mt-1 inline-flex h-[52px] w-full items-center justify-center rounded-[16px] bg-gradient-to-b from-brand-500 via-brand-600 to-brand-700 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(11,53,88,0.22)] transition duration-200 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_22px_44px_rgba(11,53,88,0.26)] focus:outline-none focus:ring-4 focus:ring-accent-100 disabled:translate-y-0 disabled:brightness-100 disabled:shadow-[0_18px_36px_rgba(11,53,88,0.16)]"
                style={{ animation: "fadeUp 500ms ease both", animationDelay: "240ms" }}
                disabled={submitting}
              >
                {submitting ? "Signing in..." : "Sign In"}
              </button>
              </form>
            )}

            <div className="mt-4 flex justify-center text-sm">
              <button
                type="button"
                className="text-sm font-medium text-brand-400 transition duration-200 hover:text-brand-500 hover:underline"
                onClick={() => setResetMode((prev) => !prev)}
              >
                {resetMode ? "Back to login" : "Reset password"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

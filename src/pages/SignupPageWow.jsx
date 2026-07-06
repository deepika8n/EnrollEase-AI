import { Link } from "react-router-dom";
import heroAdmissions from "../assets/enrollment-hero.png";
import enrolleaseLogo from "../assets/enrollease-logo.svg";

export default function SignupPageWow() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#fafdff_0%,#eef7ff_100%)] px-4 py-10 md:px-8">
      <div className="hero-orb left-[-7rem] top-20 h-72 w-72" />
      <div className="hero-orb right-[-5rem] top-10 h-80 w-80 bg-blue-200/50" />

      <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="relative hidden lg:block">
          <div className="absolute -inset-8 rounded-[40px] bg-gradient-to-br from-sky-200/40 via-transparent to-blue-100/50 blur-3xl" />
          <div className="relative rounded-[38px] border border-sky-100 bg-white/70 p-4 shadow-[0_24px_60px_rgba(112,161,214,0.16)] backdrop-blur-xl">
            <div className="rounded-[30px] border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5">
              <div className="overflow-hidden rounded-[28px] bg-sky-50">
                <img
                  src={heroAdmissions}
                  alt="Student signup guidance"
                  className="hero-zoom h-[560px] w-full scale-[1.08] object-cover object-center"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="panel overflow-hidden border-sky-100 bg-white/85 p-8 shadow-[0_22px_55px_rgba(108,156,208,0.14)] backdrop-blur-xl md:p-10">
          <div className="flex items-center gap-4">
            <img src={enrolleaseLogo} alt="EnrollEase AI logo" className="h-14 w-14 rounded-[18px]" />
            <div>
              <p className="text-sm uppercase tracking-[0.36em] text-accent-600">Student Signup</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">EnrollEase AI</p>
            </div>
          </div>

          <h1 className="mt-8 font-display text-5xl font-extrabold leading-tight text-slate-900">
            Start your enrollment journey
          </h1>
          <p className="mt-4 max-w-lg text-lg leading-8 text-slate-600">
            Student self-registration is currently disabled. Please contact the administrator.
          </p>

          <div className="mt-8 rounded-[28px] border border-sky-100 bg-sky-50/80 p-6">
            <p className="text-lg font-semibold text-slate-900">Student self-registration is currently disabled.</p>
            <p className="mt-3 text-sm leading-7 text-slate-600">Please contact the administrator.</p>
          </div>

          <p className="mt-6 text-sm text-slate-500">
            Already have access?{" "}
            <Link to="/login" className="font-semibold text-accent-600 hover:text-accent-700">
              Go to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

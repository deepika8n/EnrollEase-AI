import { Link } from "react-router-dom";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="panel w-full max-w-lg p-8">
        <p className="text-sm uppercase tracking-[0.32em] text-accent-600">Student Signup</p>
        <h1 className="mt-4 font-display text-4xl font-bold text-slate-900">Start your enrollment journey</h1>
        <div className="mt-8 rounded-3xl border border-sky-100 bg-sky-50/70 p-5 text-slate-700">
          <p className="text-lg font-semibold text-slate-900">Student self-registration is currently disabled.</p>
          <p className="mt-2 text-sm leading-6">Please contact the administrator.</p>
        </div>
        <p className="mt-6 text-sm text-slate-400">
          Already have access?{" "}
          <Link to="/login" className="text-accent-600 hover:text-accent-700">
            Go to login
          </Link>
        </p>
      </div>
    </div>
  );
}

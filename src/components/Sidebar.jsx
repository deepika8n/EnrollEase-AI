import { NavLink } from "react-router-dom";
import { useApp } from "../context/AppContext";
import enrolleaseLogo from "../assets/enrollease-logo.svg";

const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/records", label: "Records" },
  { to: "/enrollments/new", label: "New Enrollment" },
  { to: "/documents", label: "Documents" },
  { to: "/agent", label: "AI Agent" },
  { to: "/email-templates", label: "Email Templates" },
  { to: "/payments/emi", label: "Monthly EMI" },
  { to: "/payments/one-time", label: "One Time Payment" },
  { to: "/reports", label: "Reports" },
  { to: "/verification", label: "Verification" },
  { to: "/enquiries", label: "Enquiries" },
  { to: "/settings", label: "Settings" },
];

export default function Sidebar() {
  const { currentUser } = useApp();

  return (
    <aside className="panel flex h-full min-h-0 flex-col border border-sky-100 bg-white p-5 lg:h-[calc(100vh-2rem)]">
      <div className="shrink-0">
        <div className="rounded-[26px] bg-gradient-to-br from-sky-600 via-cyan-500 to-emerald-400 p-5 text-white">
          <div className="flex items-center gap-3">
            <img src={enrolleaseLogo} alt="EnrollEase AI logo" className="h-14 w-14 rounded-2xl bg-white/15 p-1.5" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.34em]">EnrollEase AI</p>
              <p className="mt-1 text-sm text-white/85">Admissions OS</p>
            </div>
          </div>
          <h2 className="mt-5 font-display text-2xl font-bold leading-tight">Admissions, payments, and follow-up in one flow.</h2>
        </div>
        <div className="mt-6 rounded-3xl border border-sky-100 bg-sky-50/70 p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-accent-600">{currentUser.role}</p>
          <p className="mt-2 font-semibold text-slate-900">{currentUser.full_name}</p>
          <p className="text-sm text-slate-500">{currentUser.email}</p>
        </div>
      </div>
      <nav className="sidebar-scrollbar mt-6 flex-1 overflow-y-auto pr-2">
        <div className="flex flex-col gap-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            title={link.label}
            className={({ isActive }) =>
              `rounded-2xl px-4 py-3 text-sm font-semibold ${isActive ? "bg-sky-100 text-sky-700" : "text-slate-600 hover:bg-sky-50 hover:text-slate-900"}`
            }
          >
            {link.label}
          </NavLink>
        ))}
        </div>
      </nav>
    </aside>
  );
}

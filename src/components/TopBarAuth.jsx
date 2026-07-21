import { Link, useLocation, useNavigate } from "react-router-dom";
import BrandLogo from "./BrandLogo";
import { useApp } from "../context/AppContext";

const navItems = [
  { to: "/dashboard", label: "Dashboard", matches: (pathname) => pathname.startsWith("/dashboard") },
  { to: "/enquiries", label: "Enquiries", matches: (pathname) => pathname.startsWith("/enquiries") },
  { to: "/records", label: "Student Records", matches: (pathname) => pathname.startsWith("/records") || pathname.startsWith("/students") },
  { to: "/payments", label: "Payments", matches: (pathname) => pathname.startsWith("/payments") },
  { to: "/settings", label: "Settings", matches: (pathname) => pathname.startsWith("/settings") },
];

const navButtonBaseClass =
  "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold tracking-[0.01em] transition-all duration-200";
const navButtonIdleClass =
  "border-white/[0.08] bg-white/[0.05] text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-white/[0.08] hover:bg-[rgba(59,130,246,0.12)] hover:text-white hover:shadow-[0_8px_20px_rgba(15,23,42,0.16)]";
const navButtonActiveClass =
  "border-sky-300/20 bg-[linear-gradient(135deg,rgba(6,22,43,0.96),rgba(11,53,88,0.94))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_32px_rgba(2,12,27,0.34),0_0_24px_rgba(59,130,246,0.14)]";

export default function TopBarAuth() {
  const { logout } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="sticky top-0 z-40 w-full border-b border-white/10 bg-[rgba(6,18,34,0.88)] shadow-[0_18px_50px_rgba(2,12,27,0.28)] backdrop-blur-2xl">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-3 px-4 py-2.5 sm:px-6 lg:px-8 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <BrandLogo variant="shield" size="md" iconClassName="h-14 w-14 rounded-[22px] shadow-[0_14px_30px_rgba(0,0,0,0.2)]" />
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-semibold tracking-[-0.04em] text-white">
              EnrollEase
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">
              Certisured Admissions
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-2 xl:justify-end">
          {navItems.map((item) => {
            const isActive = item.matches(location.pathname);

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`${navButtonBaseClass} ${isActive ? navButtonActiveClass : navButtonIdleClass}`}
                aria-label={item.label}
              >
                {item.label}
              </Link>
            );
          })}

          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white/80 transition hover:bg-white/[0.1] hover:text-white"
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}


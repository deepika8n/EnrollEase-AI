import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function TopBarAuth() {
  const { currentUser, demoMode, dashboardMetrics, logout } = useApp();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex flex-col gap-4 rounded-[28px] border border-sky-100 bg-white p-5 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Admissions control room</p>
        <p className="mt-1 text-slate-700">
          {currentUser?.full_name || "User"} - {currentUser?.role || "member"}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {dashboardMetrics?.totalEnquiries || 0} enquiries | {dashboardMetrics?.totalEnrolled || 0} enrolled | {demoMode ? "Demo mode" : "Live data"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/settings" className="button-secondary">
          Security
        </Link>
        <button type="button" className="button-secondary" onClick={handleLogout}>
          Sign Out
        </button>
      </div>
    </div>
  );
}


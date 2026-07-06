import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function TopBarSky() {
  const { currentUser, loginAsRole } = useApp();

  return (
    <div className="flex flex-col gap-4 rounded-[28px] border border-sky-100 bg-white p-5 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Agentic Workflow</p>
        <p className="mt-1 text-slate-700">Goal → Analyze → Plan → Use Tools → Take Action → Monitor → Update Status</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={currentUser.role}
          onChange={(event) => loginAsRole(event.target.value)}
          className="min-w-40"
        >
          <option value="admin">Admin View</option>
          <option value="staff">Staff View</option>
          <option value="student">Student View</option>
        </select>
        <Link to="/agent" className="button-secondary">
          Open AI Agent
        </Link>
      </div>
    </div>
  );
}

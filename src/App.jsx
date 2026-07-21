import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ToastStack from "./components/ToastStack";
import { useApp } from "./context/AppContext";

const LandingPageSimple = lazy(() => import("./pages/LandingPageSimple"));
const LoginPageSimple = lazy(() => import("./pages/LoginPageSimple"));
const DashboardHoverPage = lazy(() => import("./pages/DashboardHoverPage"));
const EnrollmentPageSimple = lazy(() => import("./pages/EnrollmentPageSimple"));
const RecordsPage = lazy(() => import("./pages/RecordsPage"));
const StudentProfilePageFixed = lazy(() => import("./pages/StudentProfilePageFixed"));
const PaymentsPage = lazy(() => import("./pages/PaymentsPage"));
const EnquiriesPage = lazy(() => import("./pages/EnquiriesPage"));
const SettingsPageSimple = lazy(() => import("./pages/SettingsPageSimple"));

function RouteLoader() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas px-6">
      <div className="hero-orb left-[-5rem] top-10 h-56 w-56 bg-brand-100/70" />
      <div className="hero-orb bottom-[-6rem] right-[-3rem] h-72 w-72 bg-accent-100/70" />
      <div className="panel relative flex w-full max-w-lg flex-col items-center px-8 py-12 text-center">
        <h1 className="font-display text-4xl font-semibold tracking-[-0.05em] text-slate-950">EnrollEase</h1>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Admissions OS</p>
        <div className="mt-10 flex items-center gap-3">
          <span className="pulse-ring h-3 w-3 rounded-full bg-accent-500" />
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-400">
            Loading admissions platform
          </p>
        </div>
        <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-surface-200">
          <div className="loading-shimmer h-full w-full rounded-full bg-gradient-to-r from-brand-500 via-accent-400 to-gold-300" />
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { currentUser, loading } = useApp();

  if (loading) {
    return <RouteLoader />;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <>
      <ToastStack />
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/" element={<LandingPageSimple />} />
          <Route path="/login" element={<LoginPageSimple />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardHoverPage /></ProtectedRoute>} />
          <Route path="/enrollment" element={<ProtectedRoute><EnrollmentPageSimple /></ProtectedRoute>} />
          <Route path="/records" element={<ProtectedRoute><RecordsPage /></ProtectedRoute>} />
          <Route path="/students/:id" element={<ProtectedRoute><StudentProfilePageFixed /></ProtectedRoute>} />
          <Route path="/payments" element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
          <Route path="/enquiries" element={<ProtectedRoute><EnquiriesPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPageSimple /></ProtectedRoute>} />
          <Route path="/signup" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

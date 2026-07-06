import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ToastStack from "./components/ToastStack";
import { useApp } from "./context/AppContext";

const LandingPageSimple = lazy(() => import("./pages/LandingPageSimple"));
const LoginPageSimple = lazy(() => import("./pages/LoginPageSimple"));
const DashboardPageSimple = lazy(() => import("./pages/DashboardPageSimple"));
const EnrollmentPageSimple = lazy(() => import("./pages/EnrollmentPageSimple"));
const RecordsPage = lazy(() => import("./pages/RecordsPage"));
const StudentProfilePageFixed = lazy(() => import("./pages/StudentProfilePageFixed"));
const DocumentsPage = lazy(() => import("./pages/DocumentsPage"));
const PaymentsEmiPage = lazy(() => import("./pages/PaymentsEmiPage"));
const PaymentsClearedPage = lazy(() => import("./pages/PaymentsClearedPage"));
const EnquiriesPage = lazy(() => import("./pages/EnquiriesPage"));
const AgentPage = lazy(() => import("./pages/AgentPage"));
const EmailTemplatesPage = lazy(() => import("./pages/EmailTemplatesPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const VerificationPage = lazy(() => import("./pages/VerificationPage"));
const SettingsPageSimple = lazy(() => import("./pages/SettingsPageSimple"));

function RouteLoader() {
  return <div className="flex min-h-screen items-center justify-center bg-[#f7fbff] text-slate-600">Loading portal...</div>;
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
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPageSimple /></ProtectedRoute>} />
          <Route path="/dashboard/admin" element={<ProtectedRoute><DashboardPageSimple /></ProtectedRoute>} />
          <Route path="/dashboard/staff" element={<ProtectedRoute><DashboardPageSimple /></ProtectedRoute>} />
          <Route path="/dashboard/student" element={<ProtectedRoute><DashboardPageSimple /></ProtectedRoute>} />
          <Route path="/enrollments/new" element={<ProtectedRoute><EnrollmentPageSimple /></ProtectedRoute>} />
          <Route path="/students" element={<ProtectedRoute><RecordsPage /></ProtectedRoute>} />
          <Route path="/records" element={<ProtectedRoute><RecordsPage /></ProtectedRoute>} />
          <Route path="/students/:id" element={<ProtectedRoute><StudentProfilePageFixed /></ProtectedRoute>} />
          <Route path="/documents" element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
          <Route path="/payments/emi" element={<ProtectedRoute><PaymentsEmiPage /></ProtectedRoute>} />
          <Route path="/payments/one-time" element={<ProtectedRoute><PaymentsClearedPage /></ProtectedRoute>} />
          <Route path="/enquiries" element={<ProtectedRoute><EnquiriesPage /></ProtectedRoute>} />
          <Route path="/agent" element={<ProtectedRoute><AgentPage /></ProtectedRoute>} />
          <Route path="/email-templates" element={<ProtectedRoute><EmailTemplatesPage /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
          <Route path="/verification" element={<ProtectedRoute><VerificationPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPageSimple /></ProtectedRoute>} />
          <Route path="/signup" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

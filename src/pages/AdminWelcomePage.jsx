import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AdminWelcomeAnimation from "../components/AdminWelcomeAnimation";

export default function AdminWelcomePage() {
  const navigate = useNavigate();
  const completeWelcome = useCallback(() => navigate("/dashboard", { replace: true }), [navigate]);

  return (
    <AdminWelcomeAnimation
      onComplete={completeWelcome}
    />
  );
}

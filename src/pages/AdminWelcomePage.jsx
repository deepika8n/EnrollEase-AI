import { useNavigate } from "react-router-dom";
import AdminWelcomeAnimation from "../components/AdminWelcomeAnimation";

export default function AdminWelcomePage() {
  const navigate = useNavigate();

  return (
    <AdminWelcomeAnimation
      onComplete={() => navigate("/dashboard", { replace: true })}
    />
  );
}

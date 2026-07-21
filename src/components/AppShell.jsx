import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import AdminWelcomeAnimation from "./AdminWelcomeAnimation";
import TopBarAuth from "./TopBarAuth";

const welcomeEligiblePaths = new Set([
  "/dashboard",
]);

export default function AppShell({ children }) {
  const { currentUser } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const shouldShowWelcome = useMemo(
    () => Boolean(location.state?.showAdminWelcome && welcomeEligiblePaths.has(location.pathname)),
    [location.pathname, location.state],
  );
  const [welcomeActive, setWelcomeActive] = useState(shouldShowWelcome);

  useEffect(() => {
    setWelcomeActive(shouldShowWelcome);
  }, [shouldShowWelcome]);

  const handleWelcomeComplete = useCallback(() => {
    setWelcomeActive(false);
    if (!location.state?.showAdminWelcome) {
      return;
    }

    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: {},
    });
  }, [location.hash, location.pathname, location.search, location.state, navigate]);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-canvas">
      <div className="hero-orb left-[-10rem] top-[-6rem] h-80 w-80 bg-brand-100/70" />
      <div className="hero-orb right-[-8rem] top-24 h-96 w-96 bg-accent-100/75" />
      <div className="hero-orb bottom-[-10rem] left-[35%] h-80 w-80 bg-gold-100/65" />

      <AdminWelcomeAnimation
        active={welcomeActive}
        role={String(currentUser?.role || "admin").toUpperCase()}
        name={currentUser?.full_name || "Admin"}
        onComplete={handleWelcomeComplete}
      />

      <div
        className={`transition-opacity duration-700 ${welcomeActive ? "pointer-events-none opacity-0" : "opacity-100"}`}
      >
        <TopBarAuth />

        <main className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
          <div className={`min-w-0 space-y-6 ${welcomeActive ? "" : "fade-in-up"}`}>{children}</div>
        </main>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";

export default function AdminWelcomeAnimation({ onComplete }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const leaveTimer = window.setTimeout(() => {
      setLeaving(true);
    }, 2800);
    const completeTimer = window.setTimeout(() => {
      onComplete?.();
    }, 3600);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className={`admin-welcome-screen ${leaving ? "is-leaving" : ""}`}>
      <div className="admin-welcome-aurora" aria-hidden="true" />
      <div className="admin-welcome-orb admin-welcome-orb-one" aria-hidden="true" />
      <div className="admin-welcome-orb admin-welcome-orb-two" aria-hidden="true" />
      <div className="admin-welcome-orb admin-welcome-orb-three" aria-hidden="true" />
      <div className="admin-welcome-panel">
        <div className="admin-welcome-emoji" aria-hidden="true">
          &#128522;
        </div>
        <p className="admin-welcome-role">Welcome dear Admin</p>
      </div>
    </div>
  );
}

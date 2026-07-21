import { useEffect, useMemo, useState } from "react";

const INTRO_DELAY_MS = 450;
const TYPING_DURATION_MS = 2000;
const FADE_OUT_START_MS = 4300;
const COMPLETE_MS = 5000;

export default function AdminWelcomeAnimation({ active, name = "Admin", role = "ADMIN", onComplete }) {
  const message = useMemo(() => `Welcome back, ${name}`, [name]);
  const [typedCount, setTypedCount] = useState(0);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (!active) {
      setTypedCount(0);
      setIsLeaving(false);
      return undefined;
    }

    setTypedCount(0);
    setIsLeaving(false);

    const typingStepMs = Math.max(45, Math.floor(TYPING_DURATION_MS / Math.max(message.length, 1)));
    let typingIntervalId;

    const typingDelayId = window.setTimeout(() => {
      typingIntervalId = window.setInterval(() => {
        setTypedCount((current) => {
          if (current >= message.length) {
            window.clearInterval(typingIntervalId);
            return current;
          }

          return current + 1;
        });
      }, typingStepMs);
    }, INTRO_DELAY_MS);

    const fadeOutId = window.setTimeout(() => {
      setIsLeaving(true);
    }, FADE_OUT_START_MS);

    const completeId = window.setTimeout(() => {
      onComplete?.();
    }, COMPLETE_MS);

    return () => {
      window.clearTimeout(typingDelayId);
      window.clearTimeout(fadeOutId);
      window.clearTimeout(completeId);
      if (typingIntervalId) {
        window.clearInterval(typingIntervalId);
      }
    };
  }, [active, message, onComplete]);

  if (!active) {
    return null;
  }

  const typedMessage = message.slice(0, typedCount);
  const isTyping = typedCount < message.length;

  return (
    <div className={`admin-welcome-screen ${isLeaving ? "is-leaving" : ""}`}>
      <div className="admin-welcome-panel">
        <div className="admin-welcome-emoji" aria-hidden="true">
          😊
        </div>
        <p className="admin-welcome-role">{role}</p>
        <h1 className="admin-welcome-heading">
          <span>{typedMessage}</span>
          {isTyping ? (
            <span className="admin-welcome-cursor" aria-hidden="true">
              |
            </span>
          ) : null}
        </h1>
      </div>
    </div>
  );
}

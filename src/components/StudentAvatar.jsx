import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

function buildInitials(name = "") {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

export default function StudentAvatar({
  name = "",
  src = "",
  alt,
  className = "",
  fallbackClassName = "",
  textClassName = "",
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const normalizedSrc = String(src || "").trim();
  const initials = useMemo(() => buildInitials(name), [name]);

  useEffect(() => {
    setImageFailed(false);
  }, [normalizedSrc]);

  if (!normalizedSrc || imageFailed) {
    return (
      <div
        aria-label={alt || name || "Student avatar"}
        className={clsx(
          "flex items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#eef4f7_100%)] shadow-[0_10px_24px_rgba(7,30,52,0.06)]",
          fallbackClassName || className,
        )}
      >
        <span className={clsx("font-semibold uppercase tracking-[0.12em] text-brand-500", textClassName)}>
          {initials}
        </span>
      </div>
    );
  }

  return (
    <img
      src={normalizedSrc}
      alt={alt || name || "Student avatar"}
      className={className}
      onError={() => setImageFailed(true)}
    />
  );
}

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
  const normalizedSrc = String(src || "").trim();
  const initials = useMemo(() => buildInitials(name), [name]);
  const [displaySrc, setDisplaySrc] = useState(normalizedSrc);
  const [hasLoadedImage, setHasLoadedImage] = useState(Boolean(normalizedSrc));

  useEffect(() => {
    if (!normalizedSrc) {
      setDisplaySrc("");
      setHasLoadedImage(false);
      return;
    }

    // Preload the next avatar before swapping sources so temporary fetch misses
    // do not make the UI flash back to initials.
    const image = new Image();
    image.onload = () => {
      setDisplaySrc(normalizedSrc);
      setHasLoadedImage(true);
    };
    image.onerror = () => {
      if (!displaySrc) {
        setHasLoadedImage(false);
      }
    };
    image.src = normalizedSrc;

    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [normalizedSrc]);

  if (!displaySrc || !hasLoadedImage) {
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
      src={displaySrc}
      alt={alt || name || "Student avatar"}
      className={className}
      onError={() => {
        if (!displaySrc) {
          setHasLoadedImage(false);
        }
      }}
    />
  );
}

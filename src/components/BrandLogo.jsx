import clsx from "clsx";
import shieldIcon from "../assets/certisured-shield.svg";

const sizes = {
  sm: {
    shield: "h-10 w-10 rounded-2xl",
    wordmark: "text-2xl",
    gap: "gap-3",
  },
  md: {
    shield: "h-12 w-12 rounded-[18px]",
    wordmark: "text-[2rem]",
    gap: "gap-4",
  },
  lg: {
    shield: "h-16 w-16 rounded-[22px]",
    wordmark: "text-[2.7rem]",
    gap: "gap-5",
  },
};

export default function BrandLogo({
  size = "md",
  variant = "full",
  className = "",
  wordmarkClassName = "",
  iconClassName = "",
  subtitle = "",
  subtitleClassName = "",
}) {
  const currentSize = sizes[size] || sizes.md;

  if (variant === "shield") {
    return (
      <img
        src={shieldIcon}
        alt="Company shield icon"
        className={clsx(currentSize.shield, iconClassName)}
      />
    );
  }

  return (
    <div className={clsx("inline-flex items-center", currentSize.gap, className)}>
      <img
        src={shieldIcon}
        alt="Company shield icon"
        className={clsx(currentSize.shield, "shadow-[0_10px_24px_rgba(11,53,88,0.14)]", iconClassName)}
      />
      <div className="min-w-0">
        <div className="text-[#0A0F18]">
          <span
            className={clsx(
              "font-display font-extrabold uppercase tracking-[-0.05em] leading-none",
              currentSize.wordmark,
              wordmarkClassName,
            )}
          >
            EnrollEase AI
          </span>
        </div>
        {subtitle ? (
          <p className={clsx("mt-1 text-xs font-semibold uppercase tracking-[0.24em] text-brand-500/70", subtitleClassName)}>
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}

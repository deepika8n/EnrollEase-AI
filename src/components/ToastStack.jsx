import clsx from "clsx";
import { useApp } from "../context/AppContext";

export default function ToastStack() {
  const { notifications } = useApp();

  return (
    <div className="fixed left-3 right-3 top-3 z-50 flex max-w-sm flex-col gap-3 sm:left-auto sm:right-4 sm:top-4 sm:w-full">
      {notifications.map((item) => (
        <div
          key={item.id}
          className={clsx(
            "rounded-[22px] border px-4 py-4 shadow-soft backdrop-blur-xl",
            item.type === "success"
              ? "border-accent-200 bg-white/95"
              : "border-gold-200 bg-white/95",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={clsx(
                "h-2.5 w-2.5 rounded-full",
                item.type === "success" ? "bg-accent-500" : "bg-gold-300",
              )}
            />
            <p className="min-w-0 break-words font-semibold text-slate-900">{item.title}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

import clsx from "clsx";
import { useApp } from "../context/AppContext";

export default function ToastStack() {
  const { notifications } = useApp();

  return (
    <div className="fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-3">
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
          <div className="flex items-center gap-3">
            <span
              className={clsx(
                "h-2.5 w-2.5 rounded-full",
                item.type === "success" ? "bg-accent-500" : "bg-gold-300",
              )}
            />
            <p className="font-semibold text-slate-900">{item.title}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

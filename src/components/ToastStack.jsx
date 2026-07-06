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
            "rounded-2xl border px-4 py-3 shadow-soft backdrop-blur-xl",
            item.type === "success"
              ? "border-emerald-400/40 bg-emerald-500/15"
              : "border-amber-300/40 bg-amber-400/15",
          )}
        >
          <p className="font-semibold text-slate-900">{item.title}</p>
        </div>
      ))}
    </div>
  );
}

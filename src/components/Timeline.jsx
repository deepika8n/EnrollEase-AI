import { formatDate } from "../utils/formatters";

export default function Timeline({ items }) {
  return (
    <div className="space-y-5">
      {items.map((item) => (
        <div key={item.id} className="flex gap-4 rounded-[24px] border border-slate-200 bg-white/80 p-4 shadow-[0_8px_24px_rgba(7,30,52,0.04)]">
          <div className="flex flex-col items-center">
            <div className="h-3.5 w-3.5 rounded-full bg-accent-500" />
            <div className="mt-2 h-full w-px bg-slate-200" />
          </div>
          <div className="pb-6">
            <p className="font-semibold text-slate-900">{item.title}</p>
            <p className="mt-1 text-sm text-slate-600">{item.description}</p>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-brand-400">{formatDate(item.date)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

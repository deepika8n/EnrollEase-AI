export default function EmptyState({ title, description }) {
  return (
    <div className="panel flex min-h-64 flex-col items-center justify-center px-4 py-8 text-center sm:px-6 sm:py-10">
      <div className="mb-5 h-20 w-20 rounded-[28px] bg-gradient-to-br from-brand-50 to-accent-50 shadow-[0_16px_36px_rgba(7,30,52,0.08)]" />
      <h3 className="font-display text-2xl font-semibold tracking-[-0.02em] text-slate-950 sm:text-3xl sm:tracking-[-0.03em]">{title}</h3>
      <p className="mt-3 max-w-md text-sm leading-7 text-slate-600 md:text-base">{description}</p>
    </div>
  );
}

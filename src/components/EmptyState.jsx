export default function EmptyState({ title, description }) {
  return (
    <div className="panel flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-5 h-20 w-20 rounded-[28px] bg-gradient-to-br from-brand-50 to-accent-50 shadow-[0_16px_36px_rgba(7,30,52,0.08)]" />
      <h3 className="font-display text-3xl font-semibold tracking-[-0.03em] text-slate-950">{title}</h3>
      <p className="mt-3 max-w-md text-sm leading-7 text-slate-600 md:text-base">{description}</p>
    </div>
  );
}

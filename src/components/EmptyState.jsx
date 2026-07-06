export default function EmptyState({ title, description }) {
  return (
    <div className="panel flex min-h-56 flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 h-16 w-16 rounded-3xl bg-accent-100" />
      <h3 className="font-display text-2xl font-semibold text-slate-900">{title}</h3>
      <p className="mt-3 max-w-md text-slate-600">{description}</p>
    </div>
  );
}

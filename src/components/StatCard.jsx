export default function StatCard({ label, value, note, accent }) {
  return (
    <div className="panel p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.22em] text-slate-500">{label}</p>
          <p className="mt-4 font-display text-4xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`h-14 w-14 rounded-2xl ${accent}`} />
      </div>
      <p className="mt-5 text-sm text-slate-600">{note}</p>
    </div>
  );
}

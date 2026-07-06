export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow ? <p className="text-sm uppercase tracking-[0.3em] text-accent-600">{eyebrow}</p> : null}
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description ? <p className="mt-3 max-w-3xl text-slate-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

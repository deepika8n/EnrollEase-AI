export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
      <div>
        {eyebrow ? <p className="section-kicker">{eyebrow}</p> : null}
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em] text-slate-950 md:text-[2.6rem]">
          {title}
        </h1>
        {description ? <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3 xl:justify-end">{actions}</div> : null}
    </div>
  );
}

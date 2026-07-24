export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="flex flex-col gap-4 sm:gap-5 xl:flex-row xl:items-end xl:justify-between">
      <div>
        {eyebrow ? <p className="section-kicker">{eyebrow}</p> : null}
        <h1 className="mt-2.5 font-display text-[2.1rem] font-semibold leading-[0.96] tracking-[-0.05em] text-slate-950 sm:mt-3 sm:text-4xl md:text-[2.6rem]">
          {title}
        </h1>
        {description ? <p className="mt-2.5 max-w-3xl text-sm leading-6 text-slate-600 sm:mt-3 sm:leading-7 md:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2.5 sm:gap-3 xl:justify-end">{actions}</div> : null}
    </div>
  );
}

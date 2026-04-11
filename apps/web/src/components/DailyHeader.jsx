function DailyHeader({ title, subtitle, stats = [], chips = [], layout = "stacked" }) {
  const isInlineStats = layout === "inline-stats";

  const chipsMarkup = chips.length ? (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <span key={chip} className="rounded-full border-4 border-ink bg-punch-cyan px-3 py-2 text-xs font-bold shadow-brutal-sm">
          {chip}
        </span>
      ))}
    </div>
  ) : null;

  const statsMarkup = stats.length ? (
    <div className={isInlineStats ? "grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" : "mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4"}>
      {stats.map((stat) => (
        <article key={stat.label} className="rounded-[1.2rem] border-4 border-ink bg-[#fff6da] p-4 shadow-brutal-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em]">{stat.label}</p>
          <p className="mt-2 text-2xl font-bold">{stat.value}</p>
          {stat.hint ? <p className="mt-1 text-xs font-medium leading-6">{stat.hint}</p> : null}
        </article>
      ))}
    </div>
  ) : null;

  return (
    <section className="brutal-panel bg-white">
      {isInlineStats ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="section-label bg-punch-yellow">Challenge</span>
            {chipsMarkup}
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
            <div className="lg:min-w-[21rem] lg:flex-none">
              <h1 className="text-4xl font-bold leading-[0.94] md:text-6xl">{title}</h1>
            </div>
            <div className="flex-1">{statsMarkup}</div>
          </div>

          {subtitle ? <p className="max-w-5xl text-sm font-medium leading-7 md:text-base">{subtitle}</p> : null}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <span className="section-label bg-punch-yellow">Challenge</span>
              <h1 className="mt-4 text-4xl font-bold leading-[0.94] md:text-6xl">{title}</h1>
              {subtitle ? <p className="mt-4 max-w-2xl text-sm font-medium leading-7 md:text-base">{subtitle}</p> : null}
            </div>
            {chipsMarkup}
          </div>

          {statsMarkup}
        </>
      )}
    </section>
  );
}

export default DailyHeader;

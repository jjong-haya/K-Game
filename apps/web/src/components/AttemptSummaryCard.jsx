import { useState } from "react";

function ChevronDownIcon({ open = false }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={`h-4 w-4 transition duration-200 ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5.5 7.5 10 12l4.5-4.5" />
    </svg>
  );
}

function AttemptSummaryCard({
  title,
  accent = "bg-punch-yellow",
  items = [],
  emptyText,
  collapsible = false,
  defaultOpen = true,
  scrollable = false,
  maxHeightClass = "max-h-[18.2rem]",
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="brutal-panel overflow-visible bg-white">
      <div className="flex items-center justify-between gap-3">
        <div
          className={`inline-flex rounded-full border-4 border-ink px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] shadow-brutal-sm ${accent}`}
        >
          {title}
        </div>

        {collapsible ? (
          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            aria-expanded={isOpen}
            aria-label={`${title} 접기 또는 펼치기`}
            className="inline-flex items-center justify-center p-0 text-ink/60 transition duration-150 hover:text-ink"
          >
            <ChevronDownIcon open={isOpen} />
          </button>
        ) : null}
      </div>

      <div className={`collapse-fold mt-4 ${!collapsible || isOpen ? "collapse-fold-open" : ""}`}>
        <div className="min-h-0">
          <div
            className={`space-y-3 pr-[10px] pb-[10px] ${
              scrollable ? `${maxHeightClass} overflow-y-auto brutal-scrollbar` : ""
            }`}
          >
            {items.length ? (
              items.map((item) => (
                <article key={item.id} className="rounded-[1.2rem] border-4 border-ink bg-[#fff9ed] px-4 py-3 shadow-brutal-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg font-black leading-tight">{item.label}</p>
                    <div className="flex items-center gap-2">
                      {item.badge ? (
                        <span className="rounded-full border-4 border-ink bg-punch-mint px-3 py-1 text-xs font-bold shadow-brutal-sm">
                          {item.badge}
                        </span>
                      ) : null}
                      <span className="text-lg font-black text-ink/70">{item.value}</span>
                    </div>
                  </div>
                  {item.sub ? (
                    <p className="mt-1 text-xs font-bold text-ink/50">{item.sub}</p>
                  ) : null}
                </article>
              ))
            ) : (
              <div className="rounded-[1.2rem] border-4 border-dashed border-ink bg-[#fff9ed] p-4 text-sm font-medium leading-7">
                {emptyText}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default AttemptSummaryCard;

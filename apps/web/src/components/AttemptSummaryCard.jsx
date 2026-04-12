import { useEffect, useRef, useState } from "react";

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
  scrollbarClassName = "brutal-scrollbar",
  fadeScrollableEdges = false,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const scrollRef = useRef(null);
  const [scrollFade, setScrollFade] = useState({ top: false, bottom: false });

  useEffect(() => {
    if (!scrollable || !fadeScrollableEdges || (collapsible && !isOpen)) {
      setScrollFade({ top: false, bottom: false });
      return;
    }

    const container = scrollRef.current;
    if (!container) {
      return;
    }

    const updateFadeState = () => {
      const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
      const threshold = 2;
      setScrollFade({
        top: container.scrollTop > threshold,
        bottom: maxScrollTop - container.scrollTop > threshold,
      });
    };

    updateFadeState();

    let observer = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        updateFadeState();
      });
      observer.observe(container);
      if (container.firstElementChild) {
        observer.observe(container.firstElementChild);
      }
    }

    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, [collapsible, fadeScrollableEdges, isOpen, items.length, maxHeightClass, scrollable]);

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
            aria-label={`${title} 열기 또는 접기`}
            className="inline-flex items-center justify-center p-0 text-ink/60 transition duration-150 hover:text-ink"
          >
            <ChevronDownIcon open={isOpen} />
          </button>
        ) : null}
      </div>

      <div className={`collapse-fold mt-4 ${!collapsible || isOpen ? "collapse-fold-open" : ""}`}>
        <div className="min-h-0">
          <div className={scrollable ? "relative rounded-[1rem] bg-white" : ""}>
            <div
              ref={scrollable ? scrollRef : null}
              onScroll={
                scrollable && fadeScrollableEdges
                  ? (event) => {
                    const container = event.currentTarget;
                    const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
                    const threshold = 2;
                    setScrollFade({
                      top: container.scrollTop > threshold,
                      bottom: maxScrollTop - container.scrollTop > threshold,
                    });
                  }
                  : undefined
              }
              className={`space-y-3 rounded-[1rem] bg-white pr-[10px] pb-[10px] ${
                scrollable ? `${maxHeightClass} overflow-y-auto ${scrollbarClassName}` : ""
              }`}
            >
              {items.length ? (
                items.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-[1.2rem] border-4 border-ink bg-white px-4 py-3 shadow-brutal-sm"
                  >
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
                    {item.sub ? <p className="mt-1 text-xs font-bold text-ink/50">{item.sub}</p> : null}
                  </article>
                ))
              ) : (
                <div className="rounded-[1.2rem] border-4 border-dashed border-ink bg-white p-4 text-sm font-medium leading-7">
                  {emptyText}
                </div>
              )}
            </div>

            {scrollable && fadeScrollableEdges && scrollFade.top ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-12 rounded-t-[1rem]"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.92) 22%, rgba(255,255,255,0.64) 52%, rgba(255,255,255,0.22) 78%, rgba(255,255,255,0) 100%)",
                }}
              />
            ) : null}

            {scrollable && fadeScrollableEdges && scrollFade.bottom ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-14 rounded-b-[1rem]"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.18) 24%, rgba(255,255,255,0.56) 54%, rgba(255,255,255,0.9) 82%, rgba(255,255,255,1) 100%)",
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export default AttemptSummaryCard;

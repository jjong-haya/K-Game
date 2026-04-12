import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import AppShell from "../components/AppShell";
import { formatKoreanDateTime } from "../lib/datetime";
import { fetchDailyWordLeaderboard } from "../lib/api";

const MODE_CARDS = [
  {
    title: "오늘의 단어",
    englishTitle: "Daily Word",
    panelColor: "bg-white",
    badges: [{ text: "매일 공개" }, { text: "즉시 참여" }],
    accent: "A",
    cta: "바로 시작",
    href: "/word",
    buttonColor: "bg-punch-yellow",
  },
  {
    title: "출시 예정",
    englishTitle: "Coming Soon",
    panelColor: "bg-punch-cyan",
    badges: [{ text: "출시 예정" }, { text: "준비 중" }],
    accent: "B",
    cta: "곧 열립니다",
    href: null,
    buttonColor: "bg-white",
    disabled: true,
  },
];

function normalizeDailyRanks(payload) {
  const root = payload?.leaderboards || payload?.leaderboard || payload || {};
  const fewestAttempts = root.fewestAttempts || root.successOrder || [];
  return Array.isArray(fewestAttempts) ? fewestAttempts : [];
}

function HomePage() {
  const { isAuthenticated } = useAuth();
  const [wordRankingItems, setWordRankingItems] = useState([]);
  const [rankingLoading, setRankingLoading] = useState(true);
  const [rankingError, setRankingError] = useState("");

  useEffect(() => {
    const loadRanks = async () => {
      try {
        setRankingLoading(true);
        setRankingError("");
        const wordData = await fetchDailyWordLeaderboard();
        setWordRankingItems(normalizeDailyRanks(wordData).slice(0, 4));
      } catch {
        setWordRankingItems([]);
        setRankingError("랭킹 정보를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
      } finally {
        setRankingLoading(false);
      }
    };

    loadRanks();
  }, []);

  const gateLink = (pathname) =>
    isAuthenticated ? pathname : `/login?returnTo=${encodeURIComponent(pathname)}`;

  const activeRankingItems = wordRankingItems;
  const emptyLabel = "오늘 등록된 기록이 아직 없습니다.";
  const emptyHref = "/word";
  const emptyCta = "오늘의 단어로 가기";
  const rightMetricLabel = "시도 횟수 기준";
  const headingCopy = {
    title: "오늘의 랭킹",
    englishTitle: "Today Rank",
  };

  return (
    <AppShell navMode="minimal" maxWidth="max-w-[80rem]">
      <div className="space-y-10">
        <section className="grid min-h-[calc(100vh-9rem)] items-stretch gap-6 lg:grid-cols-[1.18fr_0.82fr]">
          <div className="brutal-panel flex min-h-[42rem] flex-col bg-punch-yellow xl:min-h-[46rem]">
            <span className="section-label w-fit bg-white px-2.5 py-0.5 text-[10px] tracking-[0.14em]">
              Top Rank
            </span>

            <div className="mt-5 flex items-end justify-between gap-4">
              <div className="max-w-[30rem]">
                <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-ink/65">
                  {headingCopy.englishTitle}
                </p>
                <h1 className="text-5xl font-bold leading-[0.9] md:text-7xl">{headingCopy.title}</h1>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <span className="home-rank-tab home-rank-tab-active" aria-current="true">
                  오늘의 단어
                </span>
                <span className="home-rank-tab home-rank-tab-idle cursor-default opacity-70">
                  프롬프트 룸 출시 예정
                </span>
              </div>
            </div>

            <div className="mt-8 flex-1">
              <div className="flex h-full min-h-[27rem] flex-col rounded-[1.45rem] border-4 border-ink bg-white px-5 py-5 shadow-brutal-sm md:px-6 md:py-6">
                {rankingError ? (
                  <div className="mb-4 rounded-[1rem] border-4 border-ink bg-punch-pink px-4 py-3 text-sm font-black">
                    {rankingError}
                  </div>
                ) : null}

                {rankingLoading ? (
                  <div className="flex h-full items-center justify-center px-4 py-6 text-center text-base font-bold">
                    랭킹을 불러오는 중입니다.
                  </div>
                ) : activeRankingItems.length ? (
                  <div className="flex h-full flex-col gap-4">
                    {activeRankingItems.map((item, index) => (
                      <div
                        key={`word-${item.nickname || "rank"}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-[1.2rem] border-4 border-ink bg-[#fff9ec] px-4 py-4 shadow-brutal-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-ink bg-punch-cyan text-sm font-extrabold shadow-brutal-sm">
                            {index + 1}
                          </span>
                          <div>
                            <p className="text-lg font-extrabold">{item.nickname || "익명"}</p>
                            <p className="text-xs font-bold uppercase tracking-[0.14em]">
                              {formatKoreanDateTime(item.successTime || item.createdAt) || "방금 전"}
                            </p>
                          </div>
                        </div>
                        <span className="home-rank-badge">{`${item.attemptCount || 0}번`}</span>
                      </div>
                    ))}

                    <div className="mt-auto pt-2 text-right text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink/60">
                      {rightMetricLabel}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center px-5 py-8 text-center">
                    <p className="text-xl font-extrabold">{emptyLabel}</p>
                    <Link to={gateLink(emptyHref)} className="chunky-button mt-6 bg-punch-yellow">
                      {emptyCta}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          <section className="grid h-full gap-5 lg:grid-rows-2">
            {MODE_CARDS.map((card) => (
              <article
                key={card.title}
                className={`brutal-panel flex min-h-[20rem] flex-col justify-between overflow-hidden ${card.panelColor} xl:min-h-[22rem]`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="max-w-[17rem]">
                    <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-ink/55">
                      {card.englishTitle}
                    </p>
                    <h2 className="text-5xl font-bold leading-[0.9] md:text-[3.5rem]">{card.title}</h2>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {card.badges.map((badge) => (
                        <span key={badge.text} className="home-rank-badge">
                          {badge.text}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="translate-y-[-0.2rem] text-[4.8rem] font-bold leading-none text-ink/15 md:text-[5.8rem]">
                    {card.accent}
                  </span>
                </div>

                <div className="mt-10">
                  {card.disabled ? (
                    <div
                      aria-disabled="true"
                      className={`chunky-button w-full justify-between ${card.buttonColor} cursor-default opacity-75`}
                    >
                      <span>{card.cta}</span>
                      <span className="text-lg leading-none">준비</span>
                    </div>
                  ) : (
                    <Link to={gateLink(card.href)} className={`chunky-button w-full justify-between ${card.buttonColor}`}>
                      <span>{card.cta}</span>
                      <span className="text-lg leading-none">+</span>
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </section>
        </section>
      </div>
    </AppShell>
  );
}

export default HomePage;

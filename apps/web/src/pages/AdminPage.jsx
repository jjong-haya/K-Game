import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../auth/useAuth";
import AppShell from "../components/AppShell";
import AttemptSummaryCard from "../components/AttemptSummaryCard";
import DailyHeader from "../components/DailyHeader";
import {
  approveProposal,
  fetchAdminDailyWord,
  fetchAdminProposals,
  generateAdminDailyWord,
  rejectProposal,
  updateAdminDailyWord,
} from "../lib/api";

function toLocalDateInputValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function normalizeProposals(payload) {
  const items = payload?.proposals || payload?.items || payload || [];
  return Array.isArray(items) ? items : [];
}

function normalizeDailyWord(payload) {
  return {
    challenge: payload?.challenge || null,
    categories: Array.isArray(payload?.categories) ? payload.categories : [],
  };
}

function normalizeSynonymsText(synonyms) {
  if (Array.isArray(synonyms)) {
    return synonyms
      .filter(Boolean)
      .map((value) => String(value).trim())
      .filter(Boolean)
      .join(", ");
  }

  if (typeof synonyms === "string") {
    return synonyms;
  }

  return "";
}

function parseSynonymsText(rawText) {
  return [...new Set((rawText || "").split(/[\n,]/).map((value) => value.trim()).filter(Boolean))];
}

function getCategoryOptionValue(category) {
  if (category?.id !== undefined && category?.id !== null && String(category.id).length > 0) {
    return `id:${category.id}`;
  }

  if (category?.slug) {
    return `slug:${category.slug}`;
  }

  return "";
}

function buildCategoryPayload(categoryValue) {
  if (!categoryValue) {
    return {};
  }

  const [kind, ...rest] = String(categoryValue).split(":");
  const rawValue = rest.join(":");

  if (!rawValue) {
    return {};
  }

  if (kind === "slug") {
    return { categorySlug: rawValue };
  }

  return { categoryId: rawValue };
}

function buildDailyWordForm(challenge, fallbackDate) {
  return {
    publicTitle: challenge?.publicTitle || "오늘의 단어",
    hiddenAnswerText: challenge?.hiddenAnswerText || "",
    fixedHintText: challenge?.fixedHintText || "",
    categoryValue: challenge?.category ? getCategoryOptionValue(challenge.category) : "",
    synonymsText: normalizeSynonymsText(challenge?.synonyms),
    challengeDate: challenge?.challengeDate || fallbackDate || toLocalDateInputValue(),
  };
}

function buildStatusStats(challenge) {
  const stats = challenge?.stats || {};
  return [
    {
      label: "참여자",
      value: stats.participantCount ?? 0,
      hint: "이 날짜의 오늘의 단어에 참여한 사용자 수",
    },
    {
      label: "시도 수",
      value: stats.attemptCount ?? 0,
      hint: "전체 시도 횟수",
    },
    {
      label: "정답 수",
      value: stats.winCount ?? 0,
      hint: "정답을 맞힌 사용자 수",
    },
  ];
}

function InfoBanner({ tone = "info", children }) {
  const toneClass =
    tone === "error" ? "bg-punch-pink" : tone === "success" ? "bg-punch-mint" : "bg-punch-yellow";

  return (
    <div className={`rounded-[1.2rem] border-4 border-ink px-4 py-4 shadow-brutal-sm ${toneClass}`}>
      <p className="text-sm font-bold leading-7">{children}</p>
    </div>
  );
}

function AdminPage() {
  const { session, isReady, isAdmin } = useAuth();

  const [proposals, setProposals] = useState([]);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalError, setProposalError] = useState("");
  const [proposalMessage, setProposalMessage] = useState("");
  const [busyProposalId, setBusyProposalId] = useState(null);

  const [selectedDate, setSelectedDate] = useState(toLocalDateInputValue());
  const [dailyWord, setDailyWord] = useState(null);
  const [dailyCategories, setDailyCategories] = useState([]);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyError, setDailyError] = useState("");
  const [dailyMessage, setDailyMessage] = useState("");
  const [dailyBusyAction, setDailyBusyAction] = useState("");
  const [dailyForm, setDailyForm] = useState(() => buildDailyWordForm(null, toLocalDateInputValue()));

  const loadProposals = useCallback(async () => {
    if (!session?.token || !isAdmin) {
      setProposals([]);
      setProposalLoading(false);
      return;
    }

    try {
      setProposalLoading(true);
      const data = await fetchAdminProposals(session);
      setProposals(normalizeProposals(data));
      setProposalError("");
    } catch (requestError) {
      setProposalError(requestError.message || "제안 목록을 불러오지 못했습니다.");
    } finally {
      setProposalLoading(false);
    }
  }, [isAdmin, session]);

  const loadDailyWord = useCallback(
    async (dateValue = selectedDate) => {
      if (!session?.token || !isAdmin) {
        setDailyWord(null);
        setDailyCategories([]);
        setDailyLoading(false);
        return;
      }

      try {
        setDailyLoading(true);
        const data = await fetchAdminDailyWord(session, dateValue);
        const normalized = normalizeDailyWord(data);
        const challenge = normalized.challenge;
        const resolvedDate = dateValue || challenge?.challengeDate || toLocalDateInputValue();

        setDailyWord(challenge);
        setDailyCategories(normalized.categories);
        setSelectedDate(resolvedDate);
        setDailyForm(buildDailyWordForm(challenge, resolvedDate));
        setDailyError("");
      } catch (requestError) {
        const fallbackDate = dateValue || toLocalDateInputValue();
        setDailyWord(null);
        setDailyCategories([]);
        setDailyForm(buildDailyWordForm(null, fallbackDate));
        setDailyError(requestError.message || "오늘의 단어 정보를 불러오지 못했습니다.");
      } finally {
        setDailyLoading(false);
      }
    },
    [isAdmin, selectedDate, session],
  );

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    loadDailyWord(selectedDate);
  }, [isAdmin, loadDailyWord, selectedDate]);

  const categoryOptions = useMemo(() => {
    const categories = [...dailyCategories];
    const currentCategory = dailyWord?.category;

    if (
      currentCategory
      && !categories.some(
        (category) =>
          String(category?.id || "") === String(currentCategory.id || "")
          && String(category?.slug || "") === String(currentCategory.slug || ""),
      )
    ) {
      categories.unshift(currentCategory);
    }

    return categories;
  }, [dailyCategories, dailyWord?.category]);

  const proposalCards = useMemo(
    () =>
      proposals.slice(0, 4).map((proposal) => ({
        id: proposal.id,
        label: proposal.categoryName || proposal.categorySlug || "제안",
        value: proposal.proposedAnswer || "제안 제목 없음",
        badge: proposal.status || "pending",
      })),
    [proposals],
  );

  const currentChallenge = dailyWord || {};
  const hasExistingDailyWord = Boolean(currentChallenge.challengeDate);
  const dailyStats = useMemo(() => buildStatusStats(dailyWord), [dailyWord]);
  const summaryCategory = currentChallenge.category?.name || currentChallenge.category?.slug || "카테고리 없음";
  const summaryStatus = currentChallenge.status || "draft";
  const summarySynonyms = Array.isArray(currentChallenge.synonyms) ? currentChallenge.synonyms : [];
  const generateActionLabel = hasExistingDailyWord ? "다시 생성" : "자동 생성";
  const generateBusyLabel = hasExistingDailyWord ? "다시 생성 중..." : "자동 생성 중...";

  const handleApprove = async (proposal) => {
    try {
      setBusyProposalId(proposal.id);
      await approveProposal(session, proposal.id, {
        maxInputChars: proposal.recommendedMaxInputChars || proposal.maxInputChars,
        thresholdScore: proposal.recommendedThresholdScore || proposal.thresholdScore,
        teaserText: proposal.teaserText || proposal.proposalNote || "",
        tone: proposal.tone || "참여자가 바로 이해할 수 있도록 친절하고 명확한 톤",
        reviewNote: "관리자 승인",
      });
      setProposalMessage("제안을 승인했습니다.");
      setProposalError("");
      await loadProposals();
    } catch (requestError) {
      setProposalError(requestError.message || "제안을 승인하지 못했습니다.");
    } finally {
      setBusyProposalId(null);
    }
  };

  const handleReject = async (proposal) => {
    try {
      setBusyProposalId(proposal.id);
      await rejectProposal(session, proposal.id, { reason: "관리자 반려" });
      setProposalMessage("제안을 반려했습니다.");
      setProposalError("");
      await loadProposals();
    } catch (requestError) {
      setProposalError(requestError.message || "제안을 반려하지 못했습니다.");
    } finally {
      setBusyProposalId(null);
    }
  };

  const handleDailyChange = (field) => (event) => {
    const value = event.target.value;

    if (field === "challengeDate") {
      setSelectedDate(value);
      return;
    }

    setDailyForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleDailySave = async () => {
    try {
      setDailyBusyAction("save");
      await updateAdminDailyWord(session, {
        challengeDate: selectedDate,
        publicTitle: dailyForm.publicTitle.trim(),
        hiddenAnswerText: dailyForm.hiddenAnswerText.trim(),
        fixedHintText: dailyForm.fixedHintText.trim(),
        synonyms: parseSynonymsText(dailyForm.synonymsText),
        ...buildCategoryPayload(dailyForm.categoryValue),
      });
      setDailyMessage("오늘의 단어를 저장했습니다.");
      setDailyError("");
      await loadDailyWord(selectedDate);
    } catch (requestError) {
      setDailyError(requestError.message || "오늘의 단어를 저장하지 못했습니다.");
    } finally {
      setDailyBusyAction("");
    }
  };

  const handleDailyGenerate = async () => {
    const overwrite = Boolean(dailyWord?.challengeDate);

    try {
      setDailyBusyAction(overwrite ? "overwrite" : "generate");
      await generateAdminDailyWord(session, {
        challengeDate: selectedDate,
        overwrite,
        ...buildCategoryPayload(dailyForm.categoryValue),
      });
      setDailyMessage(overwrite ? "오늘의 단어를 다시 생성했습니다." : "오늘의 단어를 자동 생성했습니다.");
      setDailyError("");
      await loadDailyWord(selectedDate);
    } catch (requestError) {
      setDailyError(requestError.message || "오늘의 단어를 생성하지 못했습니다.");
    } finally {
      setDailyBusyAction("");
    }
  };

  if (!isReady) {
    return null;
  }

  if (!isAdmin) {
    return (
      <AppShell maxWidth="max-w-5xl">
        <section className="brutal-panel bg-white">
          <h1 className="text-3xl font-bold">관리자 권한이 필요합니다.</h1>
          <p className="mt-3 text-sm font-medium leading-7">
            이 페이지는 서버에서 허용한 관리자 계정으로만 접근할 수 있습니다. 관리자 이메일 또는 사용자 ID
            설정을 다시 확인해 주세요.
          </p>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth="max-w-6xl">
      <div className="space-y-6">
        <DailyHeader
          title="오늘의 단어 관리"
          subtitle="날짜를 바꾸면 먼저 조회만 하고, 비어 있으면 자동 생성, 이미 있으면 같은 버튼이 다시 생성으로 바뀝니다."
        />

        <section className="brutal-panel bg-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <span className="section-label bg-punch-mint">TODAY&apos;S WORD</span>
              <h2 className="mt-4 text-3xl font-bold md:text-4xl">하나의 버튼으로 생성 흐름 정리</h2>
              <p className="mt-3 text-sm font-medium leading-7">
                예전에는 자동 생성과 다시 생성이 따로 있었고, 조회만 해도 생성이 섞이는 문제가 있었습니다.
                이제는 선택한 날짜를 먼저 조회한 뒤, 단어가 없으면 <strong>자동 생성</strong>, 이미 있으면 같은
                버튼이 <strong>다시 생성</strong>으로 바뀝니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleDailyGenerate}
                disabled={dailyBusyAction === "generate" || dailyBusyAction === "overwrite" || dailyLoading}
                className="chunky-button bg-punch-yellow"
              >
                {dailyBusyAction === "generate" || dailyBusyAction === "overwrite"
                  ? generateBusyLabel
                  : generateActionLabel}
              </button>
              <button
                type="button"
                onClick={handleDailySave}
                disabled={dailyBusyAction === "save" || dailyLoading}
                className="chunky-button bg-punch-mint"
              >
                {dailyBusyAction === "save" ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>

          {dailyMessage ? (
            <div className="mt-5">
              <InfoBanner tone="success">{dailyMessage}</InfoBanner>
            </div>
          ) : null}
          {dailyError ? (
            <div className="mt-5">
              <InfoBanner tone="error">{dailyError}</InfoBanner>
            </div>
          ) : null}

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block rounded-[1.2rem] border-4 border-ink bg-[#fff9ec] p-4 shadow-brutal-sm">
                  <span className="block text-xs font-bold uppercase tracking-[0.16em]">대상 날짜</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={handleDailyChange("challengeDate")}
                    className="mt-2 w-full rounded-[1rem] border-4 border-ink bg-white px-4 py-3 text-sm font-medium outline-none focus-visible:ring-4 focus-visible:ring-punch-cyan"
                  />
                </label>

                <label className="block rounded-[1.2rem] border-4 border-ink bg-[#fff9ec] p-4 shadow-brutal-sm">
                  <span className="block text-xs font-bold uppercase tracking-[0.16em]">카테고리</span>
                  <select
                    value={dailyForm.categoryValue}
                    onChange={handleDailyChange("categoryValue")}
                    className="mt-2 w-full rounded-[1rem] border-4 border-ink bg-white px-4 py-3 text-sm font-medium outline-none focus-visible:ring-4 focus-visible:ring-punch-cyan"
                  >
                    <option value="">카테고리를 선택해 주세요</option>
                    {categoryOptions.map((category) => (
                      <option key={`${category.id || category.slug}`} value={getCategoryOptionValue(category)}>
                        {category.name || category.slug || "카테고리"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block rounded-[1.2rem] border-4 border-ink bg-[#fff9ec] p-4 shadow-brutal-sm">
                <span className="block text-xs font-bold uppercase tracking-[0.16em]">공개 제목</span>
                <input
                  value={dailyForm.publicTitle}
                  onChange={handleDailyChange("publicTitle")}
                  placeholder="예: 오늘의 단어"
                  className="mt-2 w-full rounded-[1rem] border-4 border-ink bg-white px-4 py-3 text-sm font-medium outline-none focus-visible:ring-4 focus-visible:ring-punch-cyan"
                />
              </label>

              <label className="block rounded-[1.2rem] border-4 border-ink bg-[#fff9ec] p-4 shadow-brutal-sm">
                <span className="block text-xs font-bold uppercase tracking-[0.16em]">정답</span>
                <input
                  value={dailyForm.hiddenAnswerText}
                  onChange={handleDailyChange("hiddenAnswerText")}
                  placeholder="예: 자동스케일링"
                  className="mt-2 w-full rounded-[1rem] border-4 border-ink bg-white px-4 py-3 text-sm font-medium outline-none focus-visible:ring-4 focus-visible:ring-punch-cyan"
                />
              </label>

              <label className="block rounded-[1.2rem] border-4 border-ink bg-[#fff9ec] p-4 shadow-brutal-sm">
                <span className="block text-xs font-bold uppercase tracking-[0.16em]">고정 힌트</span>
                <textarea
                  value={dailyForm.fixedHintText}
                  onChange={handleDailyChange("fixedHintText")}
                  rows={4}
                  placeholder="플레이어에게 항상 보여 줄 기본 힌트를 적어 주세요."
                  className="mt-2 w-full rounded-[1rem] border-4 border-ink bg-white px-4 py-3 text-sm font-medium leading-7 outline-none focus-visible:ring-4 focus-visible:ring-punch-cyan"
                />
              </label>

              <label className="block rounded-[1.2rem] border-4 border-ink bg-[#fff9ec] p-4 shadow-brutal-sm">
                <span className="block text-xs font-bold uppercase tracking-[0.16em]">동의어</span>
                <textarea
                  value={dailyForm.synonymsText}
                  onChange={handleDailyChange("synonymsText")}
                  rows={4}
                  placeholder="쉼표 또는 줄바꿈으로 구분해서 입력해 주세요."
                  className="mt-2 w-full rounded-[1rem] border-4 border-ink bg-white px-4 py-3 text-sm font-medium leading-7 outline-none focus-visible:ring-4 focus-visible:ring-punch-cyan"
                />
              </label>
            </div>

            <div className="space-y-4">
              <article className="rounded-[1.2rem] border-4 border-ink bg-[#fff9ec] p-5 shadow-brutal-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-lg font-black">현재 저장된 단어</p>
                  <span className="rounded-full border-4 border-ink bg-punch-yellow px-3 py-1 text-xs font-bold shadow-brutal-sm">
                    {summaryStatus}
                  </span>
                </div>

                {dailyLoading ? (
                  <p className="mt-4 text-sm font-medium leading-7">오늘의 단어를 불러오는 중입니다.</p>
                ) : currentChallenge?.challengeDate ? (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm font-bold uppercase tracking-[0.16em] text-ink/60">
                      {currentChallenge.challengeDate}
                    </p>
                    <h3 className="text-3xl font-bold">{currentChallenge.publicTitle || "공개 제목 없음"}</h3>
                    <p className="text-sm font-medium leading-7">
                      정답: <span className="font-bold">{currentChallenge.hiddenAnswerText || "-"}</span>
                    </p>
                    <p className="text-sm font-medium leading-7">
                      카테고리: <span className="font-bold">{summaryCategory}</span>
                    </p>
                    <p className="text-sm font-medium leading-7">
                      고정 힌트: <span className="font-bold">{currentChallenge.fixedHintText || "-"}</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {summarySynonyms.length ? (
                        summarySynonyms.map((synonym) => (
                          <span
                            key={synonym}
                            className="rounded-full border-4 border-ink bg-punch-cyan px-3 py-1 text-xs font-bold shadow-brutal-sm"
                          >
                            {synonym}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full border-4 border-ink bg-white px-3 py-1 text-xs font-bold shadow-brutal-sm">
                          동의어 없음
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm font-medium leading-7">
                    아직 이 날짜에는 오늘의 단어가 없습니다. 지금 버튼을 누르면 <strong>자동 생성</strong>으로
                    동작합니다.
                  </p>
                )}
              </article>

              <article className="rounded-[1.2rem] border-4 border-ink bg-[#fff9ec] p-5 shadow-brutal-sm">
                <p className="text-lg font-black">요약 수치</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {dailyStats.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-[1rem] border-4 border-ink bg-white p-4 shadow-brutal-sm"
                    >
                      <p className="text-xs font-bold uppercase tracking-[0.16em]">{stat.label}</p>
                      <p className="mt-2 text-2xl font-bold">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <AttemptSummaryCard
            title="제안 요약"
            accent="bg-punch-yellow"
            items={proposalCards}
            emptyText="검토할 제안이 없습니다."
          />

          <div className="space-y-4">
            {proposalMessage ? <InfoBanner tone="success">{proposalMessage}</InfoBanner> : null}
            {proposalError ? <InfoBanner tone="error">{proposalError}</InfoBanner> : null}

            {proposalLoading ? (
              <div className="brutal-panel bg-punch-yellow">
                <p className="text-sm font-bold">제안 목록을 불러오는 중입니다.</p>
              </div>
            ) : proposals.length ? (
              proposals.map((proposal) => (
                <article key={proposal.id} className="brutal-panel bg-white">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em]">
                        {proposal.categoryName || proposal.categorySlug || "카테고리"}
                      </p>
                      <h3 className="mt-2 text-3xl font-bold">
                        {proposal.proposedAnswer || "제안 제목 없음"}
                      </h3>
                      <p className="mt-2 text-sm font-medium leading-7">
                        {proposal.proposalNote || "제안 메모가 없습니다."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border-4 border-ink bg-punch-yellow px-3 py-1 text-xs font-bold shadow-brutal-sm">
                        {proposal.answerType || "word"}
                      </span>
                      <span className="rounded-full border-4 border-ink bg-punch-pink px-3 py-1 text-xs font-bold shadow-brutal-sm">
                        {proposal.status || "pending"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <article className="rounded-[1rem] border-4 border-ink bg-[#fff9ec] p-4 shadow-brutal-sm">
                      <p className="text-xs font-bold uppercase tracking-[0.16em]">추천 최대 입력 길이</p>
                      <p className="mt-2 text-2xl font-bold">
                        {proposal.recommendedMaxInputChars || proposal.maxInputChars || "-"}
                      </p>
                    </article>
                    <article className="rounded-[1rem] border-4 border-ink bg-[#fff9ec] p-4 shadow-brutal-sm">
                      <p className="text-xs font-bold uppercase tracking-[0.16em]">추천 기준 점수</p>
                      <p className="mt-2 text-2xl font-bold">
                        {proposal.recommendedThresholdScore || proposal.thresholdScore || "-"}
                      </p>
                    </article>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <article className="rounded-[1rem] border-4 border-ink bg-punch-cyan p-4 shadow-brutal-sm">
                      <p className="text-xs font-bold uppercase tracking-[0.16em]">미리보기</p>
                      <p className="mt-2 text-sm font-medium leading-7">
                        {proposal.teaserText || "미리보기 문구가 없습니다."}
                      </p>
                    </article>
                    <article className="rounded-[1rem] border-4 border-ink bg-punch-orange p-4 shadow-brutal-sm">
                      <p className="text-xs font-bold uppercase tracking-[0.16em]">톤</p>
                      <p className="mt-2 text-sm font-medium leading-7">
                        {proposal.tone || "참여자가 바로 이해할 수 있도록 정리된 톤입니다."}
                      </p>
                    </article>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleApprove(proposal)}
                      disabled={busyProposalId === proposal.id}
                      className="chunky-button bg-punch-mint"
                    >
                      {busyProposalId === proposal.id ? "처리 중..." : "승인"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(proposal)}
                      disabled={busyProposalId === proposal.id}
                      className="chunky-button bg-white"
                    >
                      {busyProposalId === proposal.id ? "처리 중..." : "반려"}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="brutal-panel bg-white">
                <p className="text-sm font-medium leading-7">현재 검토할 제안이 없습니다.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

export default AdminPage;

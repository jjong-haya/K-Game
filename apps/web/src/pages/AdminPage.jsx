import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../auth/useAuth";
import AppShell from "../components/AppShell";
import AttemptSummaryCard from "../components/AttemptSummaryCard";
import DailyHeader from "../components/DailyHeader";
import { approveProposal, fetchAdminProposals, rejectProposal } from "../lib/api";

function normalizeProposals(payload) {
  const items = payload?.proposals || payload?.items || payload || [];
  return Array.isArray(items) ? items : [];
}

function AdminPage() {
  const { session, isReady, isAdmin } = useAuth();
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null);

  const loadProposals = useCallback(async () => {
    if (!session?.token || !isAdmin) {
      setProposals([]);
      return;
    }

    try {
      setLoading(true);
      const data = await fetchAdminProposals(session);
      setProposals(normalizeProposals(data));
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, session]);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  const handleApprove = async (proposal) => {
    try {
      setBusyId(proposal.id);
      await approveProposal(session, proposal.id, {
        maxInputChars: proposal.recommendedMaxInputChars || proposal.maxInputChars,
        thresholdScore: proposal.recommendedThresholdScore || proposal.thresholdScore,
        teaserText: proposal.teaserText || proposal.proposalNote || "",
        tone: proposal.tone || "친한 친구처럼 놀리다가도 흔들리는 캐릭터 톤",
        reviewNote: "관리자 승인",
      });
      setMessage("제안을 승인했습니다.");
      setError("");
      await loadProposals();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (proposal) => {
    try {
      setBusyId(proposal.id);
      await rejectProposal(session, proposal.id, { reason: "관리자 반려" });
      setMessage("제안을 반려했습니다.");
      setError("");
      await loadProposals();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId(null);
    }
  };

  const cards = useMemo(
    () =>
      proposals.slice(0, 4).map((proposal) => ({
        id: proposal.id,
        label: proposal.categoryName || proposal.categorySlug || "제안",
        value: proposal.proposedAnswer || "제안 제목 없음",
        badge: proposal.status || "pending",
      })),
    [proposals],
  );

  if (!isReady) {
    return null;
  }

  if (!isAdmin) {
    return (
      <AppShell maxWidth="max-w-5xl">
        <section className="brutal-panel bg-white">
          <h1 className="text-3xl font-bold">관리자 권한이 필요합니다.</h1>
          <p className="mt-3 text-sm font-medium leading-7">
            이 페이지는 서버에서 허용한 관리자 계정만 접근할 수 있습니다. 관리자 메일 또는 사용자 ID
            allowlist 설정을 확인해 주세요.
          </p>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth="max-w-6xl">
      <div className="space-y-6">
        <DailyHeader
          title="관리자 도구"
          subtitle="대기 중인 제안을 검토하고 운영용 방으로 승인하거나 반려할 수 있습니다."
          chips={["서버 권한 기반", "운영 승인", "제안 검토"]}
        />

        {message ? (
          <section className="brutal-panel bg-punch-mint">
            <p className="text-sm font-bold">{message}</p>
          </section>
        ) : null}

        {error ? (
          <section className="brutal-panel bg-punch-pink">
            <p className="text-sm font-bold">{error}</p>
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <AttemptSummaryCard
            title="요약"
            accent="bg-punch-yellow"
            items={cards}
            emptyText="검토할 제안이 없습니다."
          />

          <div className="space-y-4">
            {loading ? (
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
                        {proposal.tone || "친한 친구처럼 놀리다가도 흔들리는 캐릭터 톤"}
                      </p>
                    </article>
                  </div>

                  {proposal.reviewNote ? (
                    <div className="mt-4 rounded-[1rem] border-4 border-ink bg-[#fff9ec] p-4 shadow-brutal-sm">
                      <p className="text-xs font-bold uppercase tracking-[0.16em]">최근 검토 메모</p>
                      <p className="mt-2 text-sm font-medium leading-7">{proposal.reviewNote}</p>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleApprove(proposal)}
                      disabled={busyId === proposal.id}
                      className="chunky-button bg-punch-yellow"
                    >
                      승인
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(proposal)}
                      disabled={busyId === proposal.id}
                      className="chunky-button bg-white"
                    >
                      반려
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="brutal-panel bg-white">
                <p className="text-sm font-medium leading-7">검토 대기 중인 제안이 없습니다.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

export default AdminPage;

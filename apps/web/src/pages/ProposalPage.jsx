import { useEffect, useState } from "react";

import { useAuth } from "../auth/useAuth";
import AppShell from "../components/AppShell";
import DailyHeader from "../components/DailyHeader";
import { fetchCategories, submitProposal } from "../lib/api";

function normalizeCategories(payload) {
  const items = payload?.categories || payload || [];
  return Array.isArray(items) ? items : [];
}

function ProposalPage() {
  const { session } = useAuth();
  const [categories, setCategories] = useState([]);
  const [categorySlug, setCategorySlug] = useState("physics");
  const [answerType, setAnswerType] = useState("word");
  const [proposedAnswer, setProposedAnswer] = useState("");
  const [proposalNote, setProposalNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchCategories();
        const items = normalizeCategories(data);
        setCategories(items);
        if (items[0]?.slug) {
          setCategorySlug(items[0].slug);
        }
        setError("");
      } catch (requestError) {
        setError(requestError.message || "카테고리를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!proposedAnswer.trim()) return;

    try {
      setSubmitting(true);
      const response = await submitProposal(session, {
        mode: "prompt",
        categorySlug,
        answerType,
        proposedAnswer: proposedAnswer.trim(),
        proposalNote: proposalNote.trim(),
      });
      setResult(response.review || response.aiReview || response.proposal || response);
      setError("");
    } catch (requestError) {
      setError(requestError.message || "문제 제안을 제출하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell maxWidth="max-w-5xl">
      <div className="space-y-6">
        <DailyHeader
          title="문제 제안"
          subtitle="새 제시어를 넣으면 AI가 입력 길이와 임계 점수 같은 추천값을 먼저 계산합니다."
          chips={["구글 계정 전용", "AI 리뷰 포함"]}
        />

        {error ? (
          <section className="brutal-panel bg-punch-pink">
            <p className="text-sm font-bold">{error}</p>
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <form onSubmit={handleSubmit} className="brutal-panel bg-white">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-bold">
                <span className="block text-xs uppercase tracking-[0.16em]">카테고리</span>
                <select
                  value={categorySlug}
                  onChange={(event) => setCategorySlug(event.target.value)}
                  className="w-full rounded-[1rem] border-4 border-ink bg-[#fff9ec] px-4 py-3 outline-none"
                >
                  {categories.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm font-bold">
                <span className="block text-xs uppercase tracking-[0.16em]">유형</span>
                <select
                  value={answerType}
                  onChange={(event) => setAnswerType(event.target.value)}
                  className="w-full rounded-[1rem] border-4 border-ink bg-[#fff9ec] px-4 py-3 outline-none"
                >
                  <option value="word">word</option>
                  <option value="phrase">phrase</option>
                </select>
              </label>
            </div>

            <label className="mt-4 block space-y-2 text-sm font-bold">
              <span className="block text-xs uppercase tracking-[0.16em]">정답</span>
              <input
                value={proposedAnswer}
                onChange={(event) => setProposedAnswer(event.target.value)}
                className="w-full rounded-[1rem] border-4 border-ink bg-[#fff9ec] px-4 py-3 outline-none"
                placeholder="예: 양자 터널링"
                maxLength={48}
              />
            </label>

            <label className="mt-4 block space-y-2 text-sm font-bold">
              <span className="block text-xs uppercase tracking-[0.16em]">메모</span>
              <textarea
                value={proposalNote}
                onChange={(event) => setProposalNote(event.target.value)}
                className="w-full resize-none rounded-[1rem] border-4 border-ink bg-[#fff9ec] px-4 py-3 outline-none"
                rows={6}
                placeholder="AI가 어떤 길이와 threshold를 추천하면 좋을지 메모를 남겨 주세요."
              />
            </label>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold">설명은 짧게, 정답은 분명하게 쓰는 편이 좋습니다.</p>
              <button type="submit" className="chunky-button bg-punch-yellow" disabled={loading || submitting || !proposedAnswer.trim()}>
                {loading ? "불러오는 중..." : submitting ? "검토 중..." : "제안 제출"}
              </button>
            </div>
          </form>

          <aside className="space-y-4">
            <div className="brutal-panel bg-punch-cyan">
              <span className="section-label bg-white">AI Review</span>
              <h2 className="mt-4 text-3xl font-bold">추천값 미리보기</h2>
              <p className="mt-3 text-sm font-medium leading-7">최대 입력 길이, threshold, teaser, tone을 여기에서 먼저 확인합니다.</p>
            </div>

            {result ? (
              <div className="space-y-4">
                <div className="brutal-panel bg-white">
                  <p className="text-xs font-bold uppercase tracking-[0.16em]">Summary</p>
                  <p className="mt-2 text-sm font-medium leading-7">
                    {result.summary || result.message || result.note || "검토 결과가 아직 없습니다."}
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <article className="brutal-panel bg-punch-yellow">
                    <p className="text-xs font-bold uppercase tracking-[0.16em]">추천 최대 입력</p>
                    <p className="mt-2 text-3xl font-bold">{result.recommendedMaxInputChars ?? result.maxInputChars ?? "-"}</p>
                  </article>
                  <article className="brutal-panel bg-punch-pink">
                    <p className="text-xs font-bold uppercase tracking-[0.16em]">추천 threshold</p>
                    <p className="mt-2 text-3xl font-bold">{result.recommendedThresholdScore ?? result.thresholdScore ?? "-"}</p>
                  </article>
                </div>
                <div className="brutal-panel bg-white">
                  <p className="text-xs font-bold uppercase tracking-[0.16em]">teaser</p>
                  <p className="mt-2 text-sm font-medium leading-7">{result.teaserText || "검토 중..."}</p>
                </div>
                <div className="brutal-panel bg-white">
                  <p className="text-xs font-bold uppercase tracking-[0.16em]">tone</p>
                  <p className="mt-2 text-sm font-medium leading-7">{result.tone || "친한 친구처럼 반응하는 톤"}</p>
                </div>
              </div>
            ) : (
              <div className="brutal-panel bg-white">
                <p className="text-sm font-medium leading-7">아직 제출 전입니다. 입력을 마치면 이곳에 AI 추천값이 보입니다.</p>
              </div>
            )}
          </aside>
        </section>
      </div>
    </AppShell>
  );
}

export default ProposalPage;

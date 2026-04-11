import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "../auth/useAuth";
import AppShell from "../../components/AppShell";
import AttemptSummaryCard from "../../components/AttemptSummaryCard";
import CharacterAvatar from "../../components/CharacterAvatar";
import ChatBubble from "../../components/ChatBubble";
import DailyHeader from "../../components/DailyHeader";
import {
  fetchDailyWord,
  fetchDailyWordLeaderboard,
  joinDailyWord,
  requestDailyHint,
  submitDailyWordAnswer,
  submitDailyWordAttempt,
} from "../../lib/api";
import {
  buildConversation,
  buildWordStats,
  buildWordVerdictCounts,
  formatAttemptsLeft,
  getLatestWordTurn,
  mapWordAttempts,
  normalizeDailyState,
  normalizeLeaderboard,
} from "./dailyWordState";

function EnterIcon() {
  return (
    <span aria-hidden="true" className="text-[1.7rem] font-black leading-none">
      ↵
    </span>
  );
}

function LoadingState({ message }) {
  return (
    <div className="min-h-screen px-4 py-10 md:px-6">
      <div className="mx-auto flex min-h-[70vh] max-w-5xl items-center justify-center">
        <div className="w-full brutal-panel bg-punch-yellow text-center">
          <p className="text-4xl font-bold">LOADING</p>
          <p className="mt-3 text-sm font-medium leading-7">{message}</p>
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="min-h-screen px-4 py-10 md:px-6">
      <div className="mx-auto flex min-h-[70vh] max-w-5xl items-center justify-center">
        <div className="w-full brutal-panel bg-punch-pink text-center">
          <p className="text-4xl font-bold">WAIT</p>
          <p className="mt-3 text-sm font-medium leading-7">{message}</p>
          <button type="button" onClick={onRetry} className="chunky-button mt-5 bg-white">
            다시 불러오기
          </button>
        </div>
      </div>
    </div>
  );
}

function VerdictRow({ label, count, total, colorClass }) {
  const width = total ? Math.round((count / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="w-8 text-center text-lg font-black">{label}</span>
      <div className="h-6 flex-1 overflow-hidden rounded-full border-4 border-ink bg-[#fff9ec]">
        <div className={`h-full transition-all duration-300 ${colorClass}`} style={{ width: `${width}%` }} />
      </div>
      <span className="w-8 text-center text-sm font-black">{count}</span>
    </div>
  );
}

function buildAvatarFriendReply(turn) {
  if (!turn) {
    return "질문을 던져 봐. 판정은 내가 깔끔하게 해줄게.";
  }

  const inputType = String(turn.analysis?.inputType || "");
  const quality = String(turn.analysis?.questionQuality || "");
  const mood = String(turn.analysis?.mood || "");
  const reply = String(turn.friendReply || "").trim();

  if (inputType === "direct_guess") {
    return "야 그건 질문이 아니라 그냥 찍은 거잖아. 성의 좀 챙겨.";
  }

  if (inputType === "answer_request") {
    return "뭘 대놓고 답 내놓으래. 양심 어디 갔냐.";
  }

  if (quality === "bad") {
    return "야 질문을 할 거면 좀 찔러. 이건 너무 성의 없잖아.";
  }

  if (quality === "weak") {
    return "아 좀 답답하게 돌리지 말고, 어디를 물을 건지 제대로 찔러.";
  }

  if (mood === "suspicious") {
    return "야 너 지금 질문하는 척하면서 답만 빼먹으려는 거 티 난다.";
  }

  if (mood === "teasing") {
    return "너 방금 너무 티 나게 던졌다. 나도 그렇게는 안 속아.";
  }

  if (mood === "impressed") {
    return "오, 그건 좀 잘 찔렀는데? 방금은 인정.";
  }

  if (mood === "confused") {
    return "이건 기준이 꼬여서 내가 바로 끊어 말하기가 좀 빡세다.";
  }

  return reply || "그냥 막 던지진 않았네. 이제 좀 되는 질문을 해봐.";
}

function DailyWordPage() {
  const { session, isReady } = useAuth();
  const [snapshot, setSnapshot] = useState(null);
  const [leaderboard, setLeaderboard] = useState({ successOrder: [], fewestAttempts: [] });
  const [selectedModel, setSelectedModel] = useState("nova");
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hintLoading, setHintLoading] = useState(null);
  const [error, setError] = useState("");
  const [pendingAttemptText, setPendingAttemptText] = useState("");
  const [answerInput, setAnswerInput] = useState("");
  const [answerSubmitting, setAnswerSubmitting] = useState(false);
  const [answerMessages, setAnswerMessages] = useState([]);
  const [transientTurn, setTransientTurn] = useState(null);
  const bottomRef = useRef(null);
  const chatContainerRef = useRef(null);

  const loadState = useCallback(async () => {
    if (!session?.token) return;

    const [daily, ranks] = await Promise.all([fetchDailyWord(session), fetchDailyWordLeaderboard(session)]);
    setSnapshot(normalizeDailyState(daily));
    setLeaderboard(normalizeLeaderboard(ranks));
    setTransientTurn(null);
  }, [session]);

  useEffect(() => {
    const init = async () => {
      if (!isReady || !session?.token) return;

      try {
        setLoading(true);
        await joinDailyWord(session).catch(() => null);
        await loadState();
        setError("");
      } catch (requestError) {
        setError(requestError.message || "오늘의 단어를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [isReady, loadState, session]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, [
    snapshot?.conversation?.length,
    snapshot?.player?.history?.length,
    submitting,
    hintLoading,
    pendingAttemptText,
    transientTurn?.id,
    answerMessages.length,
  ]);

  if (!isReady || loading) {
    return <LoadingState message="오늘의 단어 방을 불러오는 중입니다." />;
  }

  if (!snapshot) {
    return <ErrorState message={error || "오늘의 단어를 아직 불러오지 못했습니다."} onRetry={loadState} />;
  }

  const challenge = snapshot.challenge || {};
  const player = snapshot.player || {};
  const conversation = buildConversation(snapshot.conversation, player);
  const attemptsLeft = formatAttemptsLeft(player);
  const isLocked = Boolean(player.isLocked || player.hasPending || submitting || attemptsLeft <= 0);
  const stats = buildWordStats(challenge, player, leaderboard);
  const recentAttempts = mapWordAttempts(player.history || challenge.recentAttempts || []);
  const latestAiHint = snapshot.hints?.best_guess_ai || "";
  const latestTurn = getLatestWordTurn(player, transientTurn?.wordTurn);
  const currentEmotion = transientTurn?.wordTurn?.emotion || player.currentEmotion || {
    emojiKey: "neutral",
    label: "차분",
    intensity: 0.35,
  };
  const pendingEmotion =
    submitting || hintLoading
      ? {
          emojiKey: "thinking",
          label: "고민 중",
          intensity: 0.72,
        }
      : currentEmotion;
  const verdictCounts = buildWordVerdictCounts(player.history || []);
  const verdictTotal = verdictCounts.O + verdictCounts.X + verdictCounts["?"] || 1;

  let visibleConversation = conversation;

  if (transientTurn) {
    visibleConversation = visibleConversation.concat([
      {
        id: transientTurn.id,
        role: "user",
        content: transientTurn.inputText,
      },
      {
        id: `${transientTurn.id}-assistant`,
        role: "assistant",
        content: transientTurn.wordTurn.chatReply,
        meta: transientTurn.wordTurn.judge.verdict,
      },
    ]);
  }

  if (pendingAttemptText) {
    visibleConversation = visibleConversation.concat([
      {
        id: "pending-user",
        role: "user",
        content: pendingAttemptText,
      },
      {
        id: "pending-ai",
        role: "assistant",
        content: "판정 중이야. 잠깐만 기다려 줘.",
        meta: "...",
      },
    ]);
  }

  if (hintLoading) {
    visibleConversation = visibleConversation.concat([
      {
        id: "pending-hint-user",
        role: "user",
        content: "어려워, 힌트 좀 줘.",
      },
      {
        id: "pending-hint-ai",
        role: "assistant",
        content: "힌트 정리 중이야. 금방 줄게.",
        meta: "HINT",
      },
    ]);
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    const value = inputText.trim();
    if (!value || isLocked || value.length > 20) return;

    try {
      setSubmitting(true);
      setPendingAttemptText(value);
      const updated = await submitDailyWordAttempt(session, value, selectedModel);

      if (updated?.transientFailure && updated?.temporaryTurn) {
        setTransientTurn({
          id: `transient-${Date.now()}`,
          inputText: value,
          wordTurn: updated.temporaryTurn,
        });
        if (updated.snapshot) {
          setSnapshot(normalizeDailyState(updated));
          setLeaderboard(normalizeLeaderboard(updated.snapshot));
        }
      } else {
        setTransientTurn(null);
        setSnapshot(normalizeDailyState(updated));
        setLeaderboard(normalizeLeaderboard(updated.snapshot || updated));
      }

      setInputText("");
      setError("");
    } catch (requestError) {
      setError(requestError.message || "질문을 보내지 못했습니다.");
    } finally {
      setPendingAttemptText("");
      setSubmitting(false);
    }
  };

  const handleAnswerSubmit = async (event) => {
    event.preventDefault();
    const value = answerInput.trim();
    if (!value || isLocked) return;

    try {
      setAnswerSubmitting(true);
      const result = await submitDailyWordAnswer(session, value);

      const newMessages = [
        {
          id: `answer-user-${Date.now()}`,
          role: "answer",
          content: value,
        },
        {
          id: `answer-result-${Date.now()}`,
          role: result.correct ? "answer-correct" : "answer-wrong",
          content: result.message,
        },
      ];
      setAnswerMessages((prev) => [...prev, ...newMessages]);

      if (result.snapshot) {
        setSnapshot(normalizeDailyState(result));
        setLeaderboard(normalizeLeaderboard(result.snapshot));
      }
      setTransientTurn(null);
      setAnswerInput("");
      setError("");
    } catch (requestError) {
      setError(requestError.message || "정답 제출에 실패했습니다.");
    } finally {
      setAnswerSubmitting(false);
    }
  };

  const handleHint = async (hintType) => {
    if (hintLoading || isLocked) return;

    try {
      setHintLoading(hintType);
      const updated = await requestDailyHint(session, hintType);
      setSnapshot(normalizeDailyState(updated));
      setLeaderboard(normalizeLeaderboard(updated.snapshot || updated));
      setTransientTurn(null);
      setError("");
    } catch (requestError) {
      setError(requestError.message || "힌트를 가져오지 못했습니다.");
    } finally {
      setHintLoading(null);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <DailyHeader
          title="오늘의 단어"
          subtitle="질문 입력칸에서는 속성을 물어보고, 정답 입력칸에서는 최종 답을 제출하세요."
          stats={stats}
          layout="inline-stats"
          chips={[player.hasWon ? "성공 완료" : "진행 중"]}
        />

        {error ? (
          <section className="brutal-panel bg-punch-pink">
            <p className="text-sm font-bold">{error}</p>
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)_18rem] xl:items-start">
          <div className="space-y-6 xl:self-start">
            <CharacterAvatar
              state={submitting || hintLoading ? "cooldown_or_locked" : player.characterState || "idle"}
              emotionKey={pendingEmotion.emojiKey}
              emojiLabel={pendingEmotion.label}
              message={
                submitting || hintLoading
                  ? "방금 들어온 입력을 정리해서 답을 만들고 있어."
                  : buildAvatarFriendReply(latestTurn)
              }
              userMessage={pendingAttemptText || latestTurn?.chatReply || ""}
              model={selectedModel}
              onModelChange={setSelectedModel}
              disabledModels={["gemini"]}
            />

            <AttemptSummaryCard
              title="최근 질문"
              accent="bg-punch-yellow"
              items={recentAttempts}
              collapsible
              scrollable
              maxHeightClass="max-h-[14rem]"
              emptyText="아직 질문 기록이 없습니다. 첫 질문부터 던져 보세요."
            />
          </div>

          <section className="flex h-[clamp(34rem,78vh,52rem)] flex-col overflow-hidden rounded-[1.5rem] border-4 border-ink bg-white shadow-brutal">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b-4 border-ink bg-punch-yellow px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em]">Daily Chat</p>
                <h2 className="text-2xl font-bold">스무고개 시작</h2>
              </div>
              <div
                role="status"
                className="rounded-full border-4 border-ink bg-white px-3 py-2 text-xs font-bold shadow-brutal-sm"
              >
                {attemptsLeft} / 20
              </div>
            </div>

            <div
              ref={chatContainerRef}
              className="brutal-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#fff9ec] px-4 py-5 md:px-5"
              aria-live="polite"
            >
              {visibleConversation.map((message) => (
                <ChatBubble key={message.id} role={message.role} content={message.content} meta={message.meta} />
              ))}
              {answerMessages.map((message) => (
                <ChatBubble key={message.id} role={message.role} content={message.content} />
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="border-t-4 border-ink bg-punch-cyan p-4">
              <form onSubmit={handleSubmit}>
                <div className="relative flex items-stretch overflow-hidden rounded-[1.15rem] border-4 border-ink bg-white shadow-brutal-sm">
                  <input
                    value={inputText}
                    onChange={(event) => {
                      setInputText(event.target.value.slice(0, 20));
                    }}
                    placeholder="예: 생물이야? 사람이 만들었어?"
                    aria-label="질문 입력"
                    disabled={isLocked}
                    maxLength={20}
                    className="min-w-0 flex-1 bg-transparent px-4 py-3 pr-[8.6rem] text-base font-bold outline-none placeholder:text-zinc-500"
                  />

                  <div className="pointer-events-none absolute inset-y-0 right-[5.35rem] flex items-center text-xs font-bold text-ink/55">
                    {inputText.length}/20
                  </div>

                  <button
                    type="submit"
                    className="inline-flex w-[4.9rem] items-center justify-center border-l-4 border-ink bg-punch-yellow px-0 transition duration-150 hover:bg-[#f7d84d] active:bg-[#efc72a] disabled:pointer-events-none disabled:opacity-50"
                    disabled={isLocked || !inputText.trim()}
                    aria-label="제출"
                  >
                    <EnterIcon />
                  </button>
                </div>
              </form>
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            <section className="brutal-panel bg-punch-yellow">
              <span className="section-label bg-white">정답 입력</span>
              <p className="mt-3 text-sm font-bold leading-7">정답이 떠올랐다면 여기서 최종 답을 제출하세요.</p>
              <form onSubmit={handleAnswerSubmit} className="mt-4">
                <div className="flex items-stretch overflow-hidden rounded-[1.15rem] border-4 border-ink bg-white shadow-brutal-sm">
                  <input
                    value={answerInput}
                    onChange={(event) => setAnswerInput(event.target.value.slice(0, 20))}
                    placeholder="정답을 입력하세요"
                    disabled={isLocked}
                    maxLength={20}
                    className="min-w-0 flex-1 bg-transparent px-4 py-3 text-base font-bold outline-none placeholder:text-zinc-500"
                  />
                  <button
                    type="submit"
                    disabled={isLocked || !answerInput.trim() || answerSubmitting}
                    className="inline-flex items-center justify-center border-l-4 border-ink bg-punch-pink px-4 text-sm font-black transition hover:bg-[#ff9ec0] disabled:pointer-events-none disabled:opacity-50"
                  >
                    {answerSubmitting ? "..." : "제출"}
                  </button>
                </div>
              </form>
            </section>

            <section className="brutal-panel bg-white">
              <span className="section-label bg-punch-mint">최근 질문 평가</span>
              <div className="mt-4 space-y-4">
                <div className="rounded-[1.1rem] border-4 border-ink bg-[#fff9ec] px-4 py-3 shadow-brutal-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black">판정</p>
                    <span className="rounded-full border-4 border-ink bg-white px-3 py-1 text-xs font-bold shadow-brutal-sm">
                      {latestTurn?.judge?.verdict || "-"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-bold leading-7">
                    {latestTurn?.innerThought || "아직 평가할 질문이 없습니다. 첫 질문부터 던져 보세요."}
                  </p>
                </div>

                <div className="space-y-3">
                  <VerdictRow label="O" count={verdictCounts.O} total={verdictTotal} colorClass="bg-punch-cyan" />
                  <VerdictRow label="X" count={verdictCounts.X} total={verdictTotal} colorClass="bg-punch-pink" />
                  <VerdictRow label="?" count={verdictCounts["?"]} total={verdictTotal} colorClass="bg-punch-yellow" />
                </div>
              </div>
            </section>

            <section className="brutal-panel bg-white">
              <div className="flex items-center gap-3">
                <span className="section-label bg-punch-cyan">AI 힌트</span>
                <span className="rounded-full border-4 border-ink bg-punch-pink px-3 py-1 text-xs font-bold shadow-brutal-sm">
                  {player.hintsUsed || 0}/3
                </span>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => handleHint("best_guess_ai")}
                  disabled={(player.hintsUsed || 0) >= 3 || hintLoading || isLocked}
                  className={`w-full rounded-[1.2rem] border-4 border-ink px-4 py-3 text-left shadow-brutal-sm disabled:pointer-events-none ${
                    (player.hintsUsed || 0) >= 3 ? "bg-zinc-200 disabled:opacity-60" : "press-card-button bg-punch-cyan"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold leading-6">AI에게 힌트 요청</p>
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em]">
                      {hintLoading ? "..." : (player.hintsUsed || 0) >= 3 ? "소진" : "요청"}
                    </span>
                  </div>
                </button>
                <div className="mt-3 rounded-[1rem] border-4 border-ink bg-[#fff9ec] px-4 py-3 shadow-brutal-sm">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/55">Latest Hint</p>
                  <p className="mt-2 text-sm font-medium leading-7">
                    {latestAiHint || "아직 받은 AI 힌트가 없습니다. 먼저 질문을 던지고 요청해 보세요."}
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}

export default DailyWordPage;

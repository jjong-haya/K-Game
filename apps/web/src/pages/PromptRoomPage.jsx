import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import AppShell from "../components/AppShell";
import AttemptSummaryCard from "../components/AttemptSummaryCard";
import CharacterAvatar from "../components/CharacterAvatar";
import ChatBubble from "../components/ChatBubble";
import DailyHeader from "../components/DailyHeader";
import { formatKoreanDateTime } from "../lib/datetime";
import {
  fetchPromptRoomLeaderboard,
  fetchPromptRoomState,
  joinPromptRoom,
  submitPromptRoomAttempt,
} from "../lib/api";

function normalizeRoomState(payload) {
  const root = payload?.snapshot || payload || {};
  return {
    room: root.room || root.promptRoom || root.challenge || {},
    player: root.player || root.participant || {},
    conversation: root.conversation || root.player?.conversation || root.messages || [],
  };
}

function normalizeLeaderboard(payload) {
  const root = payload?.leaderboards || payload?.leaderboard || payload || {};
  const successOrder = root.successOrder || root.firstSuccess || root.success || [];
  const bestScore = root.bestScore || root.bestScores || root.highScore || root.score || [];

  return {
    successOrder: Array.isArray(successOrder) ? successOrder : [],
    bestScore: Array.isArray(bestScore) ? bestScore : [],
  };
}

function buildConversation(conversation = [], player = {}) {
  if (Array.isArray(conversation) && conversation.length) {
    return conversation.map((message, index) => ({
      id: message.id || `${message.role || "msg"}-${index}`,
      role: message.role || message.sender || (message.isUser ? "user" : "assistant"),
      content: message.content || message.message || message.text || "",
      score: message.score ?? null,
      category: message.category || message.reactionCategory || null,
      meta: message.meta || null,
    }));
  }

  const attempts = Array.isArray(player.history) ? player.history : [];
  return attempts.flatMap((attempt, index) => [
    {
      id: `${attempt.id || index}-user`,
      role: "user",
      content: attempt.inputText || attempt.promptPreview || "",
    },
    {
      id: `${attempt.id || index}-assistant`,
      role: "assistant",
      content: attempt.aiMessage || attempt.reactionText || attempt.summary || "응답을 준비하는 중입니다.",
      score: attempt.finalScore ?? attempt.score ?? null,
      category: attempt.reactionCategory || attempt.category || null,
    },
  ]);
}

function getLatestAvatarDialogue(messages = [], fallbackMessage = "") {
  const latestAssistant = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && typeof message.content === "string" && message.content.trim());
  const latestUser = [...messages]
    .reverse()
    .find((message) => message.role === "user" && typeof message.content === "string" && message.content.trim());

  return {
    message: latestAssistant?.content?.trim() || fallbackMessage,
    userMessage: latestUser?.content?.trim() || "",
  };
}

function formatAttemptsLeft(player) {
  if (typeof player.attemptsLeft === "number") return player.attemptsLeft;
  if (typeof player.remainingAttempts === "number") return player.remainingAttempts;
  if (typeof player.attemptsUsed === "number") return Math.max(0, 5 - player.attemptsUsed);
  return 5;
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

function PromptRoomPage() {
  const { roomId } = useParams();
  const { session, isReady } = useAuth();
  const [snapshot, setSnapshot] = useState(null);
  const [leaderboard, setLeaderboard] = useState({ successOrder: [], bestScore: [] });
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedModel, setSelectedModel] = useState("nova");
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  const loadState = useCallback(async () => {
    if (!session?.token) return;

    const [state, ranks] = await Promise.all([
      fetchPromptRoomState(session, roomId),
      fetchPromptRoomLeaderboard(session, roomId),
    ]);
    setSnapshot(normalizeRoomState(state));
    setLeaderboard(normalizeLeaderboard(ranks));
  }, [roomId, session]);

  useEffect(() => {
    const init = async () => {
      if (!isReady || !session?.token) return;

      try {
        setLoading(true);
        await joinPromptRoom(session, roomId).catch(() => null);
        await loadState();
        setError("");
      } catch (requestError) {
        setError(requestError.message || "제시어 방을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [isReady, loadState, roomId, session]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [snapshot?.conversation?.length, snapshot?.player?.history?.length, submitting]);

  if (!isReady || loading) {
    return <LoadingState message="제시어 방을 불러오는 중입니다." />;
  }

  if (!snapshot) {
    return <ErrorState message={error || "제시어 방을 아직 불러오지 못했습니다."} onRetry={loadState} />;
  }

  const room = snapshot.room || {};
  const player = snapshot.player || {};
  const conversation = buildConversation(snapshot.conversation, player);
  const attemptsLeft = formatAttemptsLeft(player);
  const isLocked = Boolean(player.isLocked || player.hasPending || submitting || attemptsLeft <= 0);
  const characterState = player.characterState || room.characterState || (player.hasWon ? "defeated_success" : "idle");
  const avatarDialogue = getLatestAvatarDialogue(conversation, player.statusText || "");

  const stats = [
    { label: "남은 시도", value: `${attemptsLeft}회`, hint: "방당 하루 5회" },
    { label: "임계 점수", value: room.thresholdScore ?? "-", hint: "이 점수를 넘기면 성공" },
    { label: "최대 입력", value: `${room.maxInputChars || 0}자`, hint: "방마다 길이가 다릅니다." },
    { label: "오늘 성공자", value: room.successCount ?? leaderboard.successOrder.length ?? 0, hint: "누가 먼저 성공했는지" },
  ];

  const successRankItems = leaderboard.successOrder.map((item, index) => ({
    id: item.id || `${item.nickname || index}-${index}`,
    label: `${index + 1}위`,
    value: `${item.nickname || item.handle || "익명"} · ${formatKoreanDateTime(item.createdAt || item.successTime)}`.trim(),
    badge: item.attemptCount ? `${item.attemptCount}회` : "WIN",
  }));

  const scoreRankItems = leaderboard.bestScore.map((item, index) => ({
    id: item.id || `${item.nickname || index}-${index}`,
    label: `${index + 1}위`,
    value: `${item.nickname || item.handle || "익명"} · ${item.score ?? item.finalScore ?? "-"}점`,
    badge: item.attemptCount ? `${item.attemptCount}회` : formatKoreanDateTime(item.createdAt),
  }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    const value = inputText.trim();
    if (!value || isLocked) return;

    try {
      setSubmitting(true);
      const updated = await submitPromptRoomAttempt(session, roomId, value);
      setSnapshot(normalizeRoomState(updated));
      if (updated?.leaderboards) {
        setLeaderboard(normalizeLeaderboard(updated));
      }
      setInputText("");
      setError("");
    } catch (requestError) {
      setError(requestError.message || "제시어 시도를 보내지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <DailyHeader
          title={room.publicTitle || room.titleAsAnswer || room.title || "제시어 방"}
          subtitle={room.teaserText || "좋은 프롬프트로 AI가 제시어를 직접 말하게 만들어 보세요."}
          stats={stats}
          chips={[room.categoryName || room.category || "카테고리", room.answerType || "word", room.tone || "친한 친구처럼 빈정대는 톤"]}
        />

        {error ? (
          <section className="brutal-panel bg-punch-pink">
            <p className="text-sm font-bold">{error}</p>
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)_18rem]">
          <div className="xl:self-start">
            <CharacterAvatar
              state={characterState}
              model={selectedModel}
              onModelChange={setSelectedModel}
              message={avatarDialogue.message}
              userMessage={avatarDialogue.userMessage}
            />
          </div>

          <section className="flex h-[36rem] flex-col overflow-hidden rounded-[1.5rem] border-4 border-ink bg-white shadow-brutal md:h-[38rem]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b-4 border-ink bg-punch-yellow px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em]">Room Chat</p>
                <h2 className="text-2xl font-bold">{room.publicTitle || room.titleAsAnswer || "제시어 방"}</h2>
              </div>
              <div className="rounded-full border-4 border-ink bg-white px-3 py-2 text-xs font-bold shadow-brutal-sm">
                {attemptsLeft} / 5
              </div>
            </div>

            <div className="brutal-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#fff9ec] px-4 py-5 md:px-5">
              {conversation.map((message) => (
                <ChatBubble
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  score={message.score}
                  category={message.category}
                  meta={message.meta}
                />
              ))}
              {submitting ? (
                <ChatBubble role="assistant" content="AI가 프롬프트 가치를 계산하고 있어요. 잠깐만 기다려 주세요." category="cooldown_or_locked" />
              ) : null}
              <div ref={bottomRef} />
            </div>

            <div className="border-t-4 border-ink bg-punch-cyan p-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em]">입력창</p>
                    <p className="mt-1 text-sm font-medium leading-6">이 방의 최대 입력 길이는 {room.maxInputChars || 0}자입니다.</p>
                  </div>
                  <div className="rounded-full border-4 border-ink bg-white px-3 py-2 text-xs font-bold shadow-brutal-sm">
                    {inputText.length}/{room.maxInputChars || 0}
                  </div>
                </div>

                <textarea
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value.slice(0, room.maxInputChars || 240))}
                  placeholder="프롬프트를 설계해 보세요."
                  disabled={isLocked}
                  maxLength={room.maxInputChars || 240}
                  rows={4}
                  className="w-full resize-none rounded-[1.1rem] border-4 border-ink bg-white px-4 py-3 text-base font-bold outline-none placeholder:text-zinc-500"
                />

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-sm font-bold">{player.statusText || "직접 명령보다 우회가 더 강합니다."}</p>
                  <button type="submit" className="chunky-button bg-punch-yellow" disabled={isLocked || !inputText.trim()}>
                    제출
                  </button>
                </div>
              </form>
            </div>
          </section>

          <aside className="space-y-4">
            <AttemptSummaryCard
              title="방 정보"
              accent="bg-punch-yellow"
              items={[
                { id: "category", label: "카테고리", value: room.categoryName || room.category || "미정" },
                { id: "type", label: "유형", value: room.answerType || "word" },
                { id: "tone", label: "톤", value: room.tone || "친한 친구식 반응" },
                { id: "threshold", label: "임계 점수", value: room.thresholdScore ?? "-" },
              ]}
              emptyText="방 정보를 아직 불러오지 못했습니다."
            />
            <AttemptSummaryCard
              title="최초 성공 순위"
              accent="bg-punch-cyan"
              items={successRankItems}
              emptyText="아직 성공자가 없습니다."
            />
            <AttemptSummaryCard
              title="최고 점수 순위"
              accent="bg-punch-pink"
              items={scoreRankItems}
              emptyText="아직 점수 기록이 없습니다."
            />
          </aside>
        </section>
      </div>
    </AppShell>
  );
}

export default PromptRoomPage;

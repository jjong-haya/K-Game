const stateMap = {
  idle: {
    emoji: "🙂",
    bg: "bg-punch-yellow",
    titles: ["덤벼 봐", "이번엔 뭐라고 물어볼래", "하나씩 좁혀 보자"],
    caption: "좋아, 질문을 던져 봐. 판정은 내가 깔끔하게 해줄게.",
  },
  teasing_low: {
    emoji: "😏",
    bg: "bg-punch-pink",
    titles: ["놀리는 중", "그건 좀 세다", "질문이냐 찍기냐"],
    caption: "질문이라기보다 찌르기에 가까운 느낌인데?",
  },
  playful_mid: {
    emoji: "😄",
    bg: "bg-punch-cyan",
    titles: ["여유 있음", "괜찮은 흐름", "조금씩 좁혀 가는 중"],
    caption: "좋아, 지금 정도면 흐름은 괜찮아.",
  },
  impressed_high: {
    emoji: "😳",
    bg: "bg-punch-orange",
    titles: ["감탄", "방금 건 좋았다", "꽤 날카롭네"],
    caption: "오, 방금 질문은 생각보다 잘 들어왔다.",
  },
  shocked_near_success: {
    emoji: "🤯",
    bg: "bg-punch-mint",
    titles: ["깜짝", "거의 왔다", "이건 좀 위험한데"],
    caption: "잠깐, 방금은 꽤 깊게 들어왔다.",
  },
  defeated_success: {
    emoji: "🎉",
    bg: "bg-white",
    titles: ["정답 인정", "이번 판 끝", "맞혔다"],
    caption: "와, 이번 판은 인정. 진짜 맞혀버렸네.",
  },
  cooldown_or_locked: {
    emoji: "🤔",
    bg: "bg-zinc-200",
    titles: ["생각 중", "정리 중", "잠깐만"],
    caption: "방금 들어온 입력을 정리해서 답을 만들고 있어.",
  },
};

const emotionMap = {
  neutral: {
    emoji: "🙂",
    title: "차분",
    caption: "차근차근 좁혀 보자.",
    state: "idle",
  },
  smile: {
    emoji: "😄",
    title: "여유",
    caption: "흐름은 꽤 괜찮아.",
    state: "playful_mid",
  },
  tease: {
    emoji: "😏",
    title: "놀림",
    caption: "그건 질문보다 찌르기에 더 가깝다.",
    state: "teasing_low",
  },
  thinking: {
    emoji: "🤔",
    title: "생각 중",
    caption: "기준을 정리해서 답을 만드는 중이다.",
    state: "cooldown_or_locked",
  },
  confused: {
    emoji: "😵",
    title: "헷갈림",
    caption: "이건 바로 끊어 말하기가 어렵다.",
    state: "cooldown_or_locked",
  },
  impressed: {
    emoji: "😳",
    title: "감탄",
    caption: "방금 질문은 꽤 날카로웠다.",
    state: "impressed_high",
  },
  suspicious: {
    emoji: "🧐",
    title: "수상함",
    caption: "노골적으로 찌르는 느낌이 있다.",
    state: "teasing_low",
  },
  shock: {
    emoji: "🤯",
    title: "깜짝",
    caption: "거의 핵심까지 들어온 느낌이다.",
    state: "shocked_near_success",
  },
};

function hashText(text) {
  return [...(text || "")].reduce((accumulator, character) => {
    return (accumulator * 31 + character.charCodeAt(0)) % 100000;
  }, 17);
}

function pickDynamicTitle(config, seedText) {
  const titles = Array.isArray(config.titles) ? config.titles : [config.title].filter(Boolean);
  if (!titles.length) {
    return "";
  }

  return titles[hashText(seedText || config.caption) % titles.length];
}

function normalizeDisplayMessage(message) {
  if (typeof message !== "string") {
    return "";
  }

  return message.trim();
}

function CharacterAvatar({
  state = "idle",
  model = "nova",
  onModelChange,
  disabledModels = [],
  emoji = "",
  label = "",
  message = "",
  userMessage = "",
  emotionKey = "",
  emojiLabel = "",
}) {
  const emotionConfig = emotionKey ? emotionMap[emotionKey] || emotionMap.neutral : null;
  const shouldPreferState =
    state === "defeated_success" || state === "cooldown_or_locked" || state === "shocked_near_success";
  const baseState = shouldPreferState ? state : emotionConfig?.state || state;
  const config = stateMap[baseState] || stateMap.idle;
  const resolvedCaption =
    normalizeDisplayMessage(message) || emotionConfig?.caption || config.caption;
  const resolvedTitle =
    normalizeDisplayMessage(emojiLabel || label) ||
    emotionConfig?.title ||
    pickDynamicTitle(config, `${userMessage} ${resolvedCaption}`.trim());
  const resolvedEmoji =
    normalizeDisplayMessage(emoji) || emotionConfig?.emoji || config.emoji;

  return (
    <section className={`brutal-panel ${config.bg}`}>
      <div className="flex flex-col items-center gap-4 py-6">
        <div className="relative flex h-52 w-52 items-center justify-center rounded-[2.25rem] border-4 border-ink bg-white shadow-brutal-lg">
          <div className="flex h-40 w-40 items-center justify-center rounded-full border-4 border-ink bg-[#fff6da] text-[6rem] shadow-brutal">
            {resolvedEmoji}
          </div>
        </div>
        {onModelChange ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onModelChange("nova")}
              disabled={disabledModels.includes("nova")}
              title={disabledModels.includes("nova") ? "현재 선택할 수 없는 모델입니다." : "Nova 모델 사용"}
              className={`rounded-full border-4 border-ink px-3 py-1.5 text-xs font-black shadow-brutal-sm transition ${
                model === "nova" ? "bg-punch-orange text-ink" : "bg-white text-ink/50"
              } disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-ink/35 disabled:shadow-none`}
            >
              Nova
            </button>
            <button
              type="button"
              onClick={() => onModelChange("gemini")}
              disabled={disabledModels.includes("gemini")}
              title={disabledModels.includes("gemini") ? "Gemini API 키를 넣기 전까지는 비활성화됩니다." : "Gemini 모델 사용"}
              className={`rounded-full border-4 border-ink px-3 py-1.5 text-xs font-black shadow-brutal-sm transition ${
                model === "gemini" ? "bg-punch-cyan text-ink" : "bg-white text-ink/50"
              } disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-ink/35 disabled:shadow-none`}
            >
              Gemini
            </button>
          </div>
        ) : null}
        <span className="rounded-full border-4 border-ink bg-white px-4 py-1.5 text-sm font-black shadow-brutal-sm">
          {resolvedTitle}
        </span>
        <p className="px-4 text-center text-sm font-bold leading-6">{resolvedCaption}</p>
      </div>
    </section>
  );
}

export default CharacterAvatar;

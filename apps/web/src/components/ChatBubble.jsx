const roleConfig = {
  assistant: {
    outer: "justify-start",
    bubble: "bg-punch-yellow",
    label: "AI",
  },
  user: {
    outer: "justify-end",
    bubble: "bg-white",
    label: "ME",
  },
  system: {
    outer: "justify-center",
    bubble: "bg-punch-cyan",
    label: "SYSTEM",
  },
  answer: {
    outer: "justify-end",
    bubble: "bg-punch-orange",
    label: "ME / 정답",
  },
  "answer-correct": {
    outer: "justify-start",
    bubble: "bg-punch-mint",
    label: "SYSTEM",
  },
  "answer-wrong": {
    outer: "justify-start",
    bubble: "bg-punch-pink",
    label: "SYSTEM",
  },
};

function ChatBubble({ role = "assistant", content, score, category, meta }) {
  const config = roleConfig[role] || roleConfig.assistant;

  return (
    <div className={`flex ${config.outer}`}>
      <article className={`speech-bubble ${config.bubble}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em]">{config.label}</span>
          {meta ? <span className="text-[11px] font-bold uppercase tracking-[0.14em]">{meta}</span> : null}
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-7">{content}</p>
      </article>
    </div>
  );
}

export default ChatBubble;

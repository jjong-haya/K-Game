import { useState } from "react";

function getApiBase() {
  return process.env.REACT_APP_API_BASE_URL || "";
}

function AiLabPage() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const value = input;
    if (!value.trim()) {
      setOutput("");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${getApiBase()}/api/ai-lab/raw`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: value }),
      });

      const rawText = await response.text();
      setOutput(rawText);
    } catch (error) {
      setOutput(error?.message || "request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fff7d8] px-4 py-8 md:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="brutal-panel bg-white">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-ink/60">AI Prompt Lab</p>
          <h1 className="mt-2 text-3xl font-black">입력 그대로 보내기</h1>
          <p className="mt-3 text-sm font-medium leading-7">
            여기는 테스트용입니다. 입력한 문자열을 그대로 AI에 보내고, 응답도 그대로 보여줍니다.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <section className="brutal-panel bg-white">
            <div className="flex items-center justify-between gap-3">
              <span className="section-label bg-punch-yellow">입력</span>
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-ink/55">
                {loading ? "sending" : "ready"}
              </span>
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                className="min-h-[22rem] w-full resize-y rounded-[1.2rem] border-4 border-ink bg-[#fffdf7] px-4 py-4 text-sm font-medium leading-7 outline-none"
                placeholder="여기에 테스트할 프롬프트를 그대로 넣으세요."
              />
              <button
                type="submit"
                className="chunky-button bg-punch-cyan"
                disabled={loading || !input.trim()}
              >
                {loading ? "보내는 중..." : "보내기"}
              </button>
            </form>
          </section>

          <section className="brutal-panel bg-white">
            <div className="flex items-center justify-between gap-3">
              <span className="section-label bg-punch-mint">출력</span>
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-ink/55">raw output</span>
            </div>
            <pre className="mt-4 min-h-[26rem] whitespace-pre-wrap break-words rounded-[1.2rem] border-4 border-ink bg-[#fffdf7] px-4 py-4 text-sm font-medium leading-7">
              {output || "아직 응답이 없습니다."}
            </pre>
          </section>
        </section>
      </div>
    </main>
  );
}

export default AiLabPage;

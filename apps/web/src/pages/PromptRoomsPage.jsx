import { Link } from "react-router-dom";

import AppShell from "../components/AppShell";
import DailyHeader from "../components/DailyHeader";

function PromptRoomsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <DailyHeader
          title="제시어 듣기"
          subtitle="이 모드는 아직 공개 전입니다. 더 다듬어서 정식으로 열릴 예정입니다."
          chips={["출시 예정", "준비 중", "조금만 기다려 주세요"]}
        />

        <section className="brutal-panel bg-punch-cyan">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink/55">Coming Soon</p>
              <h2 className="mt-3 text-4xl font-bold leading-[0.94] md:text-6xl">출시 예정</h2>
              <p className="mt-4 text-sm font-medium leading-7 md:text-base">
                제시어 듣기 게임은 지금 막바지 손보는 중이라 아직 열어두지 않았습니다. 공개되기 전까지는 오늘의 단어
                모드에서 계속 플레이할 수 있습니다.
              </p>
            </div>

            <Link to="/word" className="chunky-button bg-white">
              오늘의 단어 하러 가기
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

export default PromptRoomsPage;

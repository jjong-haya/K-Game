import AppShell from "../components/AppShell";

function TermsPage() {
  return (
    <AppShell maxWidth="max-w-4xl">
      <section className="brutal-panel bg-white">
        <article className="space-y-8 text-sm leading-8 text-ink md:text-base">
          <header className="space-y-2">
            <h1 className="text-3xl font-bold leading-tight md:text-4xl">이용약관</h1>
            <p className="text-xs font-bold text-ink/50">시행일: 2026년 4월 10일 | v1.0</p>
          </header>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">1. 목적</h2>
            <p>
              이 문서는 K-Game 서비스의 이용 조건, 사용자 권리, 서비스 제공 범위와 책임 한계를 설명합니다.
              실제 운영 규정은 서비스 정책과 공지에 따라 조정될 수 있습니다.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">2. 서비스 개요</h2>
            <p>
              K-Game은 단어 추리, 대화형 게임, 제안 기능, 사용자 프로필, 관리자 기능 등을 제공하는 웹 서비스입니다.
              서비스 구조와 운영 방식은 기술적·운영적 필요에 따라 변경될 수 있습니다.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">3. 계정과 로그인</h2>
            <p>
              게스트 로그인, ID 로그인, Google 및 Apple 소셜 로그인을 지원할 수 있습니다. 사용자는 본인의 계정 정보를
              안전하게 관리해야 하며, 타인의 계정을 무단으로 사용해서는 안 됩니다.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">4. 이용 제한과 변경</h2>
            <p>
              서비스 운영을 위해 기능이 추가되거나 수정될 수 있으며, 안정성 확보가 필요한 경우 일부 기능이 제한될 수 있습니다.
              중요한 변경이 있는 경우 서비스 화면 또는 공지로 안내합니다.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">5. 사용자의 책임</h2>
            <p>
              사용자는 비정상 접근, 권한 우회, 스크립트 남용, 서비스 방해 행위를 해서는 안 됩니다. 또한 입력하는 텍스트와
              업로드되는 정보가 타인의 권리를 침해하지 않도록 주의해야 합니다.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">6. 콘텐츠와 AI 응답</h2>
            <p>
              서비스의 AI 응답이나 제안 결과는 참고용이며, 항상 정확성을 보장하지 않습니다. 사용자는 결과를 최종 판단의
              유일한 근거로 사용하지 않아야 합니다.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">7. 외부 서비스</h2>
            <p>
              일부 기능은 AWS, Supabase, Google, Apple 등 외부 서비스와 연동될 수 있습니다. 각 서비스의 정책과 제한은
              해당 제공자의 약관을 따릅니다.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">8. 문의</h2>
            <p>운영팀: K-Game, 문의 이메일: support@k-game.example</p>
          </section>
        </article>
      </section>
    </AppShell>
  );
}

export default TermsPage;

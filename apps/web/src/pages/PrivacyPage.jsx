import AppShell from "../components/AppShell";

function PrivacyPage() {
  return (
    <AppShell maxWidth="max-w-4xl">
      <section className="brutal-panel bg-white">
        <article className="space-y-8 text-sm leading-8 text-ink md:text-base">
          <header className="space-y-2">
            <h1 className="text-3xl font-bold leading-tight md:text-4xl">개인정보처리방침</h1>
            <p className="text-xs font-bold text-ink/50">시행일: 2026년 4월 10일 | v1.0</p>
          </header>

          <section className="space-y-3">
            <p>
              K-Game은 사용자의 개인정보를 가능한 한 최소한으로 수집하고, 서비스 제공에 필요한 범위에서만 처리합니다.
              이 방침은 수집 항목, 이용 목적, 보관 기간, 제3자 제공, 이용자 권리를 설명합니다.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">1. 수집 항목</h2>
            <p>
              로그인 방식에 따라 닉네임, 이메일, 세션 정보, 게임 진행 정보, 문의 및 요청 기록이 수집될 수 있습니다.
              브라우저 환경에서는 세션 유지와 PKCE 검증을 위해 필요한 식별 정보가 저장될 수 있습니다.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">2. 이용 목적</h2>
            <p>
              수집된 정보는 로그인 처리, 게임 진행, 결과 저장, 문의 응대, 보안 검증, 서비스 개선을 위해 사용됩니다.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">3. 보관 기간</h2>
            <p>
              원칙적으로 목적 달성 후 지체 없이 파기합니다. 다만 법령, 분쟁 대응, 보안 로그 보존 등 필요한 경우에는
              관련 법령과 운영 정책에 따라 일정 기간 보관할 수 있습니다.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">4. 제3자 제공 및 위탁</h2>
            <p>
              서비스 운영을 위해 AWS, Google, Apple, Supabase 같은 외부 서비스를 사용할 수 있으며, 이때 필요한 범위 내에서만
              데이터가 전달될 수 있습니다. 각 제공자의 정책은 해당 서비스 약관을 따릅니다.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">5. 사용자 권리</h2>
            <p>
              사용자는 자신의 개인정보 열람, 정정, 삭제, 처리정지 요청을 할 수 있습니다. 게스트 로그인 정보는 브라우저 저장소에
              남을 수 있으므로 필요 시 브라우저 데이터를 직접 삭제해야 할 수 있습니다.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">6. 보호 조치</h2>
            <p>
              K-Game은 최소 권한 원칙, HTTPS, 세션 보호, 입력 검증, 접근 제어를 적용하여 개인정보를 보호하려고 노력합니다.
              다만 인터넷 환경의 특성상 완전한 보안을 보장할 수는 없습니다.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">7. 문의</h2>
            <p>운영팀: K-Game, 개인정보 문의 이메일: privacy@k-game.example</p>
          </section>
        </article>
      </section>
    </AppShell>
  );
}

export default PrivacyPage;

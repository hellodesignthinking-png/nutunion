import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보처리방침 | nutunion",
  description: "너트유니온 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <div className="bg-nu-paper min-h-screen">
      {/* Header */}
      <div className="bg-nu-ink text-white py-16">
        <div className="max-w-4xl mx-auto px-8">
          <Link href="/" className="font-mono-nu text-[10px] uppercase tracking-widest text-white/40 hover:text-nu-pink transition-colors">
            &larr; nutunion
          </Link>
          <h1 className="font-head text-4xl md:text-5xl font-extrabold mt-6">개인정보처리방침</h1>
          <p className="font-mono-nu text-[11px] uppercase tracking-widest text-white/50 mt-4">
            Privacy Policy &middot; 시행일: 2026년 4월 8일
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-8 py-16">
        <div className="prose prose-nu max-w-none space-y-12 text-nu-ink/80 leading-relaxed">

          <Section num="1" title="개인정보의 처리 목적">
            <p>
              너트유니온(이하 &quot;회사&quot;)은 다음의 목적을 위하여 개인정보를 처리합니다.
              처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며,
              이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
            </p>
            <Ul items={[
              "회원 가입 및 관리: 회원제 서비스 이용에 따른 본인확인, 개인 식별, 가입 의사 확인, 서비스 부정이용 방지",
              "서비스 제공: 소모임 운영, 프로젝트 관리, 인재 탐색, 의뢰 관리 등 콘텐츠 제공",
              "마케팅 및 광고 활용: 이벤트 및 광고성 정보 제공, 서비스 이용 통계 분석",
              "고충처리: 민원인의 신원 확인, 민원사항 처리, 처리결과 통보",
            ]} />
          </Section>

          <Section num="2" title="수집하는 개인정보 항목">
            <p>회사는 서비스 제공을 위해 아래와 같은 개인정보를 수집합니다.</p>
            <Ul items={[
              "필수항목: 이메일 주소, 닉네임, 비밀번호(소셜 로그인 시 제외)",
              "선택항목: 프로필 이미지, 소개글, 스킬 태그, 관심 분야",
              "자동 수집: 접속 IP, 쿠키, 서비스 이용 기록, 접속 로그, 기기 정보",
            ]} />
          </Section>

          <Section num="3" title="개인정보의 처리 및 보유기간">
            <p>
              회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터
              개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
            </p>
            <Ul items={[
              "회원 가입 정보: 회원 탈퇴 시까지 (탈퇴 후 30일 이내 파기)",
              "서비스 이용 기록: 3년 (전자상거래법)",
              "접속 로그: 3개월 (통신비밀보호법)",
              "소모임/프로젝트 활동 기록: 서비스 제공 기간",
            ]} />
          </Section>

          <Section num="4" title="개인정보의 제3자 제공">
            <p>
              회사는 정보주체의 개인정보를 제1조에서 명시한 범위 내에서만 처리하며,
              정보주체의 동의, 법률의 특별한 규정 등에 해당하는 경우에만 개인정보를 제3자에게 제공합니다.
            </p>
          </Section>

          <Section num="5" title="개인정보 처리의 위탁">
            <p>회사는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리업무를 위탁하고 있습니다.</p>
            <Ul items={[
              "클라우드 서비스: Supabase Inc. (데이터베이스 호스팅)",
              "웹 호스팅: Vercel Inc. (웹 애플리케이션 호스팅)",
              "인증 서비스: Google LLC (소셜 로그인)",
            ]} />
          </Section>

          <Section num="6" title="정보주체의 권리·의무 및 행사방법">
            <p>정보주체는 회사에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.</p>
            <Ul items={[
              "개인정보 열람 요구",
              "오류 등이 있을 경우 정정 요구",
              "삭제 요구",
              "처리정지 요구",
            ]} />
            <p>
              위 권리 행사는 서비스 내 설정 메뉴 또는 이메일(hello@nutunion.kr)을 통해 하실 수 있으며,
              회사는 이에 대해 지체 없이 조치하겠습니다.
            </p>
          </Section>

          <Section num="7" title="개인정보의 파기">
            <p>
              회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는
              지체 없이 해당 개인정보를 파기합니다.
            </p>
            <Ul items={[
              "전자적 파일: 복원이 불가능한 방법으로 영구 삭제",
              "종이 문서: 분쇄기로 분쇄하거나 소각",
            ]} />
          </Section>

          <Section num="8" title="개인정보의 안전성 확보 조치">
            <p>회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.</p>
            <Ul items={[
              "관리적 조치: 내부관리계획 수립·시행, 정기적 직원 교육",
              "기술적 조치: 개인정보처리시스템 접근 권한 관리, 암호화 기술 적용, 보안 프로그램 설치",
              "물리적 조치: 전산실, 자료보관실 등의 접근 통제",
            ]} />
          </Section>

          <Section num="9" title="개인정보 보호책임자">
            <Ul items={[
              "담당자: 너트유니온 운영팀",
              "이메일: hello@nutunion.kr",
              "인스타그램: @nutunion",
            ]} />
            <p>
              기타 개인정보침해에 대한 신고나 상담이 필요하신 경우 아래 기관에 문의하시기 바랍니다.
            </p>
            <Ul items={[
              "개인정보침해신고센터 (privacy.kisa.or.kr / 국번없이 118)",
              "개인정보 분쟁조정위원회 (www.kopico.go.kr / 1833-6972)",
              "대검찰청 사이버수사과 (www.spo.go.kr / 국번없이 1301)",
              "경찰청 사이버수사국 (ecrm.cyber.go.kr / 국번없이 182)",
            ]} />
          </Section>

          <Section num="10" title="개인정보처리방침 변경">
            <p>
              이 개인정보처리방침은 2026년 4월 8일부터 적용됩니다.
              이전의 개인정보처리방침은 아래에서 확인하실 수 있습니다.
            </p>
          </Section>

        </div>

        {/* Footer nav */}
        <div className="mt-20 pt-8 border-t border-nu-ink/10 flex items-center justify-between">
          <Link href="/terms" className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted hover:text-nu-pink transition-colors">
            서비스약관 보기 &rarr;
          </Link>
          <Link href="/" className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted hover:text-nu-pink transition-colors">
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-head text-xl font-extrabold text-nu-ink flex items-baseline gap-3 mb-4">
        <span className="font-mono-nu text-[11px] text-nu-pink font-bold">제{num}조</span>
        {title}
      </h2>
      <div className="space-y-3 text-[15px]">{children}</div>
    </section>
  );
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 ml-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-[15px]">
          <span className="text-nu-pink mt-1.5 text-[8px]">&#9632;</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

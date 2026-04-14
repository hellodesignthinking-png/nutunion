import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "서비스약관 | nutunion",
  description: "너트유니온 서비스 이용약관",
};

export default function TermsPage() {
  return (
    <div className="bg-nu-paper min-h-screen">
      {/* Header */}
      <div className="bg-nu-ink text-white py-16">
        <div className="max-w-4xl mx-auto px-8">
          <Link href="/" className="font-mono-nu text-[10px] uppercase tracking-widest text-white/40 hover:text-nu-pink transition-colors">
            &larr; nutunion
          </Link>
          <h1 className="font-head text-4xl md:text-5xl font-extrabold mt-6">서비스 이용약관</h1>
          <p className="font-mono-nu text-[11px] uppercase tracking-widest text-white/50 mt-4">
            Terms of Service &middot; 시행일: 2026년 4월 8일
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-8 py-16">
        <div className="prose prose-nu max-w-none space-y-12 text-nu-ink/80 leading-relaxed">

          <Section num="1" title="목적">
            <p>
              이 약관은 너트유니온(이하 &quot;회사&quot;)이 운영하는 nutunion.co.kr(이하 &quot;서비스&quot;)의
              이용 조건 및 절차, 회사와 회원 간의 권리·의무 및 책임사항 등을 규정함을 목적으로 합니다.
            </p>
          </Section>

          <Section num="2" title="용어의 정의">
            <Ul items={[
              '"서비스"란 회사가 nutunion.co.kr을 통해 제공하는 너트 운영, 볼트 관리, 와셔 탐색, 의뢰 관리 등 모든 온라인 서비스를 의미합니다.',
              '"회원"이란 회사와 이용계약을 체결하고 회원 아이디를 부여받은 자를 의미합니다.',
              '"너트"란 회원들이 공통 관심사를 기반으로 구성한 그룹 활동 단위를 의미합니다.',
              '"볼트"란 너트 또는 개인이 수행하는 목표 지향적 활동 단위를 의미합니다.',
              '"콘텐츠"란 회원이 서비스 내에서 작성한 글, 이미지, 파일 등 모든 정보를 의미합니다.',
            ]} />
          </Section>

          <Section num="3" title="약관의 효력 및 변경">
            <Ul items={[
              "이 약관은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력이 발생합니다.",
              "회사는 관련 법령에 위배되지 않는 범위에서 이 약관을 변경할 수 있으며, 변경 시 적용일자 7일 전부터 공지합니다.",
              "변경된 약관에 동의하지 않을 경우 회원은 탈퇴할 수 있으며, 약관 시행일까지 거부 의사를 표시하지 않으면 동의한 것으로 간주합니다.",
            ]} />
          </Section>

          <Section num="4" title="이용계약의 체결">
            <Ul items={[
              "이용계약은 회원이 되고자 하는 자가 약관에 동의하고 회원가입을 신청한 후, 회사가 이를 승낙함으로써 체결됩니다.",
              "회사는 이메일 인증 또는 소셜 로그인(Google 등)을 통해 회원가입을 처리합니다.",
              "회사는 다음 각 호에 해당하는 신청에 대해 승낙을 거부하거나 유보할 수 있습니다: 타인의 정보를 도용한 경우, 허위 정보를 기재한 경우, 기타 회사가 정한 이용 요건을 충족하지 못한 경우.",
            ]} />
          </Section>

          <Section num="5" title="회원의 의무">
            <p>회원은 다음 행위를 하여서는 안 됩니다.</p>
            <Ul items={[
              "타인의 개인정보를 도용하거나 부정 사용하는 행위",
              "서비스를 통해 얻은 정보를 회사의 사전 동의 없이 상업적으로 이용하는 행위",
              "회사 또는 제3자의 지식재산권을 침해하는 행위",
              "회사 또는 제3자의 명예를 손상시키거나 업무를 방해하는 행위",
              "외설적이거나 폭력적인 콘텐츠를 게시하는 행위",
              "서비스의 안정적 운영을 방해하는 행위 (해킹, 악성코드 배포 등)",
              "다른 회원의 서비스 이용을 방해하는 행위",
              "너트·볼트 활동에서 타 회원에게 부당한 불이익을 주는 행위",
            ]} />
          </Section>

          <Section num="6" title="회사의 의무">
            <Ul items={[
              "회사는 관련 법령과 이 약관이 금지하거나 미풍양속에 반하는 행위를 하지 않으며, 지속적이고 안정적으로 서비스를 제공하기 위해 최선을 다합니다.",
              "회사는 회원의 개인정보를 안전하게 관리하며, 개인정보처리방침에 따라 처리합니다.",
              "회사는 서비스 이용과 관련한 회원의 의견이나 불만사항을 적극적으로 처리합니다.",
            ]} />
          </Section>

          <Section num="7" title="서비스의 제공 및 변경">
            <p>회사가 제공하는 서비스는 다음과 같습니다.</p>
            <Ul items={[
              "너트 생성·운영·관리 서비스",
              "프로젝트 협업 및 관리 서비스 (로드맵, 자료실, 워크스페이스, 자금 관리 등)",
              "와셔 탐색 및 매칭 서비스",
              "의뢰(챌린지) 등록 및 참여 서비스",
              "기타 회사가 추가 개발하거나 제휴를 통해 회원에게 제공하는 일체의 서비스",
            ]} />
            <p>
              회사는 운영상·기술상의 필요에 의해 제공하는 서비스의 전부 또는 일부를 변경할 수 있으며,
              변경 시 7일 전에 공지합니다.
            </p>
          </Section>

          <Section num="8" title="서비스 이용의 제한 및 중지">
            <p>회사는 다음 각 호에 해당하는 경우 서비스 이용을 제한하거나 중지할 수 있습니다.</p>
            <Ul items={[
              "서비스용 설비의 보수, 교체, 정기점검 등 공사로 인한 부득이한 경우",
              "전기통신사업법에 규정된 기간통신사업자가 전기통신 서비스를 중지한 경우",
              "국가비상사태, 정전, 서비스 설비 장애 등 불가항력적 사유가 있는 경우",
              "회원이 본 약관을 위반한 경우",
            ]} />
          </Section>

          <Section num="9" title="콘텐츠의 권리 및 관리">
            <Ul items={[
              "회원이 서비스 내에 작성한 콘텐츠의 저작권은 해당 회원에게 있습니다.",
              "회사는 서비스 운영, 홍보 등의 목적으로 회원의 콘텐츠를 서비스 내에서 노출할 수 있습니다.",
              "회사는 관련 법령에 위반되거나 약관을 위반하는 콘텐츠를 사전 통지 없이 삭제하거나 비공개 처리할 수 있습니다.",
              "탈퇴 시 회원이 작성한 콘텐츠는 삭제되지 않을 수 있으며, 삭제를 원하는 경우 탈퇴 전에 직접 삭제하여야 합니다.",
            ]} />
          </Section>

          <Section num="10" title="이용계약의 해지">
            <Ul items={[
              "회원은 언제든지 서비스 내 설정 메뉴 또는 이메일(hello@nutunion.kr)을 통해 탈퇴를 요청할 수 있습니다.",
              "회사는 회원이 본 약관을 위반한 경우 사전 통지 후 이용계약을 해지할 수 있습니다.",
              "이용계약 해지 시 관련 법령 및 개인정보처리방침에 따라 회원의 정보를 보유하는 경우를 제외하고 개인정보를 지체 없이 파기합니다.",
            ]} />
          </Section>

          <Section num="11" title="손해배상 및 면책">
            <Ul items={[
              "회사는 무료로 제공하는 서비스에 관하여 회원에게 발생한 손해에 대해 책임을 지지 않습니다.",
              "회사는 회원 간 또는 회원과 제3자 간에 서비스를 매개로 발생한 분쟁에 대해 개입할 의무가 없으며, 이에 대한 손해배상 책임이 없습니다.",
              "회원이 본 약관을 위반하여 회사에 손해를 끼친 경우, 해당 회원은 그 손해를 배상하여야 합니다.",
            ]} />
          </Section>

          <Section num="12" title="분쟁 해결">
            <Ul items={[
              "본 약관과 관련된 분쟁은 대한민국 법령을 적용합니다.",
              "서비스 이용과 관련하여 발생한 분쟁에 대해 소송이 제기될 경우, 회사 소재지를 관할하는 법원을 전속적 합의관할 법원으로 합니다.",
            ]} />
          </Section>

          <Section num="부칙" title="">
            <p>이 약관은 2026년 4월 8일부터 시행합니다.</p>
          </Section>

        </div>

        {/* Footer nav */}
        <div className="mt-20 pt-8 border-t border-nu-ink/10 flex items-center justify-between">
          <Link href="/privacy" className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted hover:text-nu-pink transition-colors">
            &larr; 개인정보처리방침 보기
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
        <span className="font-mono-nu text-[11px] text-nu-pink font-bold">
          {num === "부칙" ? "부칙" : `제${num}조`}
        </span>
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

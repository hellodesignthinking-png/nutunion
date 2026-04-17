import { DocViewer, Section, thS, tdS } from "@/components/finance/doc-viewer";

const TOC = ["제1조 수집 항목", "제2조 이용 목적", "제3조 보유 기간", "제4조 제3자 제공", "제5조 파기", "제6조 정보주체 권리", "제7조 안전성 확보", "제8조 보호 책임자", "제9조 방침 변경"];

export default function PrivacyPolicyPage() {
  return (
    <DocViewer docId="privacy" title="개인정보처리방침" toc={TOC}>
      <h1 className="text-[18px] font-bold text-center mb-6 tracking-[4px]">개인정보처리방침</h1>
      <p className="mb-4 text-[12px]">주식회사 넛유니온(이하 &quot;회사&quot;)은 「개인정보 보호법」 등 관련 법령에 따라 직원 및 이용자의 개인정보를 보호하고 이와 관련한 고충을 신속하게 처리하기 위하여 다음과 같이 개인정보처리방침을 수립·공개합니다.</p>

      <Section title="제1조 (개인정보의 수집 항목 및 방법)" id="toc-privacy-0">
        <p>회사는 다음의 개인정보 항목을 수집합니다.</p>
        <table className="w-full border-collapse my-2">
          <thead><tr><th className={thS}>구분</th><th className={thS}>수집 항목</th></tr></thead>
          <tbody>
            <tr><td className={tdS}>필수</td><td className={`${tdS} text-left`}>성명, 주민등록번호, 연락처, 주소, 계좌정보</td></tr>
            <tr><td className={tdS}>선택</td><td className={`${tdS} text-left`}>학력, 경력, 자격사항, 사진</td></tr>
            <tr><td className={tdS}>자동</td><td className={`${tdS} text-left`}>접속 로그, IP주소, 서비스 이용 기록</td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="제2조 (개인정보의 수집 및 이용 목적)" id="toc-privacy-1">
        <ol className="list-decimal pl-5">
          <li>인사관리: 채용, 근로계약, 인사발령, 급여지급, 4대보험 가입</li>
          <li>급여 및 세무: 급여계산, 원천징수, 연말정산, 퇴직금 산정</li>
          <li>근태관리: 출퇴근 관리, 휴가 관리, 근무시간 산정</li>
          <li>복리후생: 건강검진, 복리후생 제도 운영</li>
          <li>법적 의무 이행: 노동관계법령 등에 따른 의무 이행</li>
        </ol>
      </Section>

      <Section title="제3조 (개인정보의 보유 및 이용 기간)" id="toc-privacy-2">
        <p>회사는 개인정보 수집 및 이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 다만, 관계 법령에 따라 보존할 필요가 있는 경우 해당 기간 동안 보관합니다.</p>
        <table className="w-full border-collapse my-2">
          <thead><tr><th className={thS}>보존 근거</th><th className={thS}>보존 기간</th></tr></thead>
          <tbody>
            <tr><td className={tdS}>근로기준법 (근로계약서 등)</td><td className={tdS}>3년</td></tr>
            <tr><td className={tdS}>국세기본법 (세무 서류)</td><td className={tdS}>5년</td></tr>
            <tr><td className={tdS}>전자상거래법 (계약·거래 기록)</td><td className={tdS}>5년</td></tr>
            <tr><td className={tdS}>통신비밀보호법 (접속 기록)</td><td className={tdS}>3개월</td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="제4조 (개인정보의 제3자 제공)" id="toc-privacy-3">
        <p>회사는 원칙적으로 직원의 개인정보를 외부에 제공하지 않습니다. 다만, 다음의 경우에는 예외로 합니다.</p>
        <ol className="list-decimal pl-5">
          <li>직원의 동의를 얻은 경우</li>
          <li>법령에 의하여 제공이 요구되는 경우 (국세청, 국민연금공단, 건강보험공단 등)</li>
          <li>수사기관의 적법한 요청이 있는 경우</li>
        </ol>
      </Section>

      <Section title="제5조 (개인정보의 파기 절차 및 방법)" id="toc-privacy-4">
        <ol className="list-decimal pl-5">
          <li>파기 절차: 보유 기간이 경과하거나 처리 목적 달성 후 내부 방침에 따라 파기합니다.</li>
          <li>파기 방법: 전자적 파일은 복원이 불가능한 방법으로 삭제하고, 종이 문서는 분쇄기로 분쇄하거나 소각합니다.</li>
        </ol>
      </Section>

      <Section title="제6조 (정보주체의 권리·의무 및 행사 방법)" id="toc-privacy-5">
        <p>직원은 다음의 권리를 행사할 수 있습니다.</p>
        <ol className="list-decimal pl-5">
          <li>개인정보 열람 요구</li>
          <li>오류 등이 있을 경우 정정 요구</li>
          <li>삭제 요구</li>
          <li>처리 정지 요구</li>
        </ol>
        <p>위 요구는 서면, 전화, 이메일 등으로 할 수 있으며, 회사는 지체 없이 조치합니다.</p>
      </Section>

      <Section title="제7조 (개인정보의 안전성 확보 조치)" id="toc-privacy-6">
        <p>회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취합니다.</p>
        <ol className="list-decimal pl-5">
          <li>관리적 조치: 개인정보 취급자 지정 및 교육</li>
          <li>기술적 조치: 접근 권한 관리, 접근 통제, 암호화</li>
          <li>물리적 조치: 서류 보관실 접근 통제</li>
        </ol>
      </Section>

      <Section title="제8조 (개인정보 보호 책임자)" id="toc-privacy-7">
        <table className="w-3/5 border-collapse my-2">
          <tbody>
            <tr><td className={`${tdS} font-semibold w-[120px]`}>부서</td><td className={tdS}>경영지원팀</td></tr>
            <tr><td className={`${tdS} font-semibold`}>연락처</td><td className={tdS}>관리자 이메일 또는 사내 시스템</td></tr>
          </tbody>
        </table>
      </Section>

      <Section title="제9조 (개인정보처리방침의 변경)" id="toc-privacy-8">
        <p>이 개인정보처리방침은 시행일로부터 적용되며, 변경 사항이 있는 경우 변경 시행 7일 전에 공지합니다.</p>
        <p className="mt-3 font-semibold">시행일: 2024년 1월 1일</p>
      </Section>
    </DocViewer>
  );
}

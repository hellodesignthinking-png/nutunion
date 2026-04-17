import { DocViewer, Section, Article, thS, tdS } from "@/components/finance/doc-viewer";

const TOC = ["제1장 총칙", "제2장 주식", "제3장 주주총회", "제4장 이사 및 이사회", "제5장 감사", "제6장 회계", "부칙"];

export default function CharterPage() {
  return (
    <DocViewer docId="charter" title="정관" toc={TOC}>
      <h1 className="text-[18px] font-bold text-center mb-6 tracking-[4px]">정 관</h1>

      <Section title="제1장 총칙" id="toc-charter-0">
        <Article n={1} title="상호">이 회사는 주식회사 넛유니온(이하 &quot;회사&quot;)이라 한다. 영문명은 nutunion Co., Ltd.로 표기한다.</Article>
        <Article n={2} title="목적">
          <p>회사는 다음의 사업을 목적으로 한다.</p>
          <ol className="list-decimal pl-5">
            <li>소프트웨어 개발 및 판매</li>
            <li>부동산 기술(PropTech) 서비스</li>
            <li>경영 컨설팅 및 자문</li>
            <li>위 각 호에 부대되는 일체의 사업</li>
          </ol>
        </Article>
        <Article n={3} title="본점 소재지">회사의 본점은 서울특별시에 둔다.</Article>
        <Article n={4} title="공고방법">회사의 공고는 회사의 인터넷 홈페이지에 게재한다.</Article>
      </Section>

      <Section title="제2장 주식" id="toc-charter-1">
        <Article n={5} title="발행할 주식의 총수">회사가 발행할 주식의 총수는 100,000주로 한다.</Article>
        <Article n={6} title="1주의 금액">회사가 발행하는 주식 1주의 금액은 금 5,000원으로 한다.</Article>
        <Article n={7} title="주식의 종류">회사가 발행하는 주식은 기명식 보통주식으로 한다.</Article>
        <Article n={8} title="주권의 종류">회사의 주권은 1주권, 5주권, 10주권, 50주권, 100주권, 500주권, 1,000주권의 7종으로 한다.</Article>
      </Section>

      <Section title="제3장 주주총회" id="toc-charter-2">
        <Article n={9} title="소집시기">정기주주총회는 매 사업연도 종료 후 3개월 이내에, 임시주주총회는 필요에 따라 수시로 소집한다.</Article>
        <Article n={10} title="소집권자">주주총회는 법령에 다른 정함이 있는 경우를 제외하고는 이사회의 결의에 의하여 대표이사가 소집한다.</Article>
        <Article n={11} title="의장">주주총회의 의장은 대표이사로 한다.</Article>
        <Article n={12} title="결의방법">주주총회의 결의는 법령에 다른 정함이 있는 경우를 제외하고 출석한 주주의 의결권의 과반수와 발행주식총수의 4분의 1 이상의 수로 한다.</Article>
      </Section>

      <Section title="제4장 이사 및 이사회" id="toc-charter-3">
        <Article n={13} title="이사의 수">회사의 이사는 1인 이상 3인 이내로 한다.</Article>
        <Article n={14} title="이사의 선임">이사는 주주총회에서 선임한다.</Article>
        <Article n={15} title="이사의 임기">이사의 임기는 3년으로 한다. 다만, 그 임기가 최종 결산기 종료 후 당해 결산기에 관한 정기주주총회 전에 만료될 경우에는 그 총회 종결 시까지 그 임기를 연장한다.</Article>
        <Article n={16} title="대표이사">회사의 대표이사는 이사회에서 선임한다.</Article>
        <Article n={17} title="이사회">
          <ol className="list-decimal pl-5">
            <li>이사회는 이사 전원으로 구성하며, 회사의 업무에 관한 중요사항을 결의한다.</li>
            <li>이사회의 결의는 이사 과반수의 출석과 출석이사 과반수로 한다.</li>
          </ol>
        </Article>
      </Section>

      <Section title="제5장 감사" id="toc-charter-4">
        <Article n={18} title="감사의 수와 선임">회사는 1인의 감사를 둘 수 있으며, 주주총회에서 선임한다.</Article>
        <Article n={19} title="감사의 임기">감사의 임기는 취임 후 3년 내의 최종 결산기에 관한 정기주주총회 종결 시까지로 한다.</Article>
        <Article n={20} title="감사의 직무">감사는 회사의 회계와 업무를 감사한다.</Article>
      </Section>

      <Section title="제6장 회계" id="toc-charter-5">
        <Article n={21} title="사업연도">회사의 사업연도는 매년 1월 1일부터 12월 31일까지로 한다.</Article>
        <Article n={22} title="재무제표의 작성">대표이사는 매 결산기에 재무상태표, 손익계산서 기타 법령이 정하는 서류를 작성하여 이사회의 승인을 받아야 한다.</Article>
        <Article n={23} title="이익배당">
          <ol className="list-decimal pl-5">
            <li>이익의 배당은 금전 또는 주식으로 할 수 있다.</li>
            <li>이익배당은 매 결산기말 현재의 주주명부에 기재된 주주에게 지급한다.</li>
          </ol>
        </Article>
      </Section>

      <Section title="부칙" id="toc-charter-6">
        <Article n={1} title="시행일">이 정관은 회사 설립등기일부터 시행한다.</Article>
        <Article n={2} title="발기인">
          <table className="w-3/5 border-collapse my-2">
            <thead><tr><th className={thS}>성명</th><th className={thS}>주소</th><th className={thS}>주식수</th></tr></thead>
            <tbody>
              <tr><td className={tdS}>(대표자명)</td><td className={tdS}>서울특별시</td><td className={tdS}>&nbsp;</td></tr>
            </tbody>
          </table>
        </Article>
      </Section>
    </DocViewer>
  );
}

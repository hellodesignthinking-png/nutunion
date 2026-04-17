import { DocViewer, Section, Article, thS, tdS } from "@/components/finance/doc-viewer";

const TOC = ["제1장 총칙", "제2장 채용", "제3장 근로시간·휴게·휴일", "제4장 휴가", "제5장 임금", "제6장 복무", "제7장 퇴직·해고", "부칙"];

export default function EmploymentRulesPage() {
  return (
    <DocViewer docId="rules" title="취업규칙" toc={TOC}>
      <h1 className="text-[18px] font-bold text-center mb-6 tracking-[4px]">취 업 규 칙</h1>

      <Section title="제1장 총칙" id="toc-rules-0">
        <Article n={1} title="목적">이 규칙은 회사와 직원 간의 근로조건 및 복무에 관한 사항을 정함을 목적으로 한다.</Article>
        <Article n={2} title="적용범위">이 규칙은 회사에 근무하는 모든 직원에게 적용한다. 다만, 일용직·단기 계약직 등 특수한 고용형태의 근로자에 대하여는 별도로 정할 수 있다.</Article>
        <Article n={3} title="용어의 정의">
          <ol className="list-decimal pl-5">
            <li>&quot;직원&quot;이라 함은 이 규칙에 의하여 채용된 자를 말한다.</li>
            <li>&quot;정규직&quot;이라 함은 기간의 정함이 없는 근로계약을 체결한 자를 말한다.</li>
            <li>&quot;계약직&quot;이라 함은 기간의 정함이 있는 근로계약을 체결한 자를 말한다.</li>
          </ol>
        </Article>
      </Section>

      <Section title="제2장 채용" id="toc-rules-1">
        <Article n={4} title="채용">회사는 취업을 원하는 자 중에서 소정의 전형을 거쳐 채용한다.</Article>
        <Article n={5} title="채용서류">
          <p>채용 시 다음 서류를 제출하여야 한다.</p>
          <ol className="list-decimal pl-5">
            <li>이력서 1부 (사진 첨부)</li>
            <li>주민등록등본 1부</li>
            <li>최종학력 졸업증명서 1부</li>
            <li>경력증명서 (해당자)</li>
            <li>기타 회사가 필요로 하는 서류</li>
          </ol>
        </Article>
        <Article n={6} title="수습기간">신규 채용된 직원에 대하여 3개월의 수습기간을 둘 수 있다. 수습기간 중의 근로조건은 이 규칙에 의한다.</Article>
        <Article n={7} title="근로계약">회사는 직원 채용 시 근로계약서를 작성하여 직원에게 교부한다.</Article>
      </Section>

      <Section title="제3장 근로시간·휴게·휴일" id="toc-rules-2">
        <Article n={8} title="근로시간">
          <ol className="list-decimal pl-5">
            <li>1주간의 소정근로시간은 40시간으로 한다.</li>
            <li>1일의 소정근로시간은 8시간으로 하며, 시업 및 종업시각은 다음과 같다.</li>
          </ol>
          <table className="w-full border-collapse my-2">
            <thead><tr><th className={thS}>구분</th><th className={thS}>시간</th><th className={thS}>비고</th></tr></thead>
            <tbody>
              <tr><td className={tdS}>출근시간</td><td className={tdS}>09:00</td><td className={tdS}></td></tr>
              <tr><td className={tdS}>퇴근시간</td><td className={tdS}>18:00</td><td className={tdS}>주 40시간</td></tr>
              <tr><td className={tdS}>휴게시간</td><td className={tdS}>12:00 ~ 13:00</td><td className={tdS}>무급 1시간</td></tr>
            </tbody>
          </table>
        </Article>
        <Article n={9} title="연장·야간·휴일근로">업무상 필요한 경우 근로자 대표와의 합의 및 근로자의 동의를 얻어 연장·야간·휴일근로를 시킬 수 있으며, 이 경우 근로기준법에 따른 가산수당을 지급한다.</Article>
        <Article n={10} title="휴일">
          <ol className="list-decimal pl-5">
            <li>주휴일: 매주 일요일</li>
            <li>근로자의 날 (5월 1일)</li>
            <li>「관공서의 공휴일에 관한 규정」에 따른 공휴일 및 대체공휴일</li>
          </ol>
        </Article>
      </Section>

      <Section title="제4장 휴가" id="toc-rules-3">
        <Article n={11} title="연차유급휴가">
          <ol className="list-decimal pl-5">
            <li>1년간 80% 이상 출근한 직원에게 15일의 유급휴가를 부여한다.</li>
            <li>계속 근로연수가 1년 미만인 직원에게는 1개월 개근 시 1일의 유급휴가를 부여한다.</li>
            <li>3년 이상 계속 근로한 직원에게는 최초 1년을 초과하는 계속 근로연수 매 2년에 대하여 1일을 가산한 유급휴가를 부여한다 (한도 25일).</li>
          </ol>
        </Article>
        <Article n={12} title="병가">직원이 업무 외 질병·부상으로 근무할 수 없을 때에는 연간 60일 이내의 병가를 허가할 수 있다. 병가 기간은 무급으로 한다.</Article>
        <Article n={13} title="경조사 휴가">
          <table className="w-full border-collapse my-2">
            <thead><tr><th className={thS}>구분</th><th className={thS}>일수</th></tr></thead>
            <tbody>
              <tr><td className={tdS}>본인 결혼</td><td className={tdS}>5일</td></tr>
              <tr><td className={tdS}>자녀 결혼</td><td className={tdS}>1일</td></tr>
              <tr><td className={tdS}>배우자 출산</td><td className={tdS}>10일</td></tr>
              <tr><td className={tdS}>본인·배우자 부모 사망</td><td className={tdS}>5일</td></tr>
              <tr><td className={tdS}>본인·배우자 조부모·형제자매 사망</td><td className={tdS}>3일</td></tr>
            </tbody>
          </table>
        </Article>
      </Section>

      <Section title="제5장 임금" id="toc-rules-4">
        <Article n={14} title="임금의 구성">임금은 기본급, 제수당, 상여금으로 구성한다.</Article>
        <Article n={15} title="임금의 계산 및 지급">
          <ol className="list-decimal pl-5">
            <li>임금은 매월 1일부터 말일까지를 산정기간으로 한다.</li>
            <li>임금은 매월 25일에 직원이 지정한 예금계좌로 지급한다.</li>
            <li>지급일이 휴일인 경우 전일에 지급한다.</li>
          </ol>
        </Article>
        <Article n={16} title="연장·야간·휴일근로수당">연장·야간·휴일근로에 대하여는 통상임금의 50%를 가산하여 지급한다.</Article>
        <Article n={17} title="퇴직급여">1년 이상 계속 근로한 직원이 퇴직하는 경우 근로자퇴직급여 보장법에 따라 퇴직급여를 지급한다.</Article>
      </Section>

      <Section title="제6장 복무" id="toc-rules-5">
        <Article n={18} title="복무의무">
          <p>직원은 다음 사항을 준수하여야 한다.</p>
          <ol className="list-decimal pl-5">
            <li>직무에 전념하고 성실히 근무한다.</li>
            <li>업무상 취득한 비밀을 누설하지 아니한다.</li>
            <li>회사의 재산을 소중히 하고 허가 없이 사용하지 아니한다.</li>
            <li>상사의 정당한 직무상 명령에 따른다.</li>
            <li>근무시간을 엄수한다.</li>
          </ol>
        </Article>
        <Article n={19} title="출·퇴근">직원은 소정의 시업시각까지 출근하여야 하며, 질병 기타 사유로 결근하고자 할 때에는 사전에 승인을 받아야 한다.</Article>
      </Section>

      <Section title="제7장 퇴직·해고" id="toc-rules-6">
        <Article n={20} title="퇴직">
          <p>직원이 다음 각 호에 해당하는 경우 퇴직으로 한다.</p>
          <ol className="list-decimal pl-5">
            <li>본인이 퇴직을 원하는 경우 (30일 전 서면 통보)</li>
            <li>근로계약기간이 만료된 경우</li>
            <li>사망한 경우</li>
          </ol>
        </Article>
        <Article n={21} title="해고">회사는 근로기준법에 정한 정당한 사유가 있는 경우에 한하여 직원을 해고할 수 있으며, 해고 시 30일 전에 예고하거나 30일분 이상의 통상임금을 지급한다.</Article>
      </Section>

      <Section title="부칙" id="toc-rules-7">
        <p>이 규칙은 공포한 날로부터 시행한다.</p>
      </Section>
    </DocViewer>
  );
}

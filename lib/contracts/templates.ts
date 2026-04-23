/**
 * 계약서 표준 템플릿 — Markdown 본문.
 * placeholder: {{title}}, {{clientName}}, {{contractorName}}, {{amount}}, {{startDate}}, {{endDate}}
 */

export const CONTRACT_TEMPLATES = {
  standard_service: {
    label: "표준 용역 계약",
    description: "일반적인 프로젝트 용역 (개발/디자인/리서치 등)",
    body: `# 용역 계약서

**계약명**: {{title}}
**발주자 (갑)**: {{clientName}}
**수주자 (을)**: {{contractorName}}

## 1. 계약 목적
갑과 을은 본 계약에 따라 아래 용역을 성실히 수행한다.

- 용역명: {{title}}
- 용역 기간: {{startDate}} ~ {{endDate}}

## 2. 계약 금액
- 총 계약 금액: **₩{{amount}}** (부가세 별도)
- 원천징수 3.3% 자동 공제 후 지급 (개인 프리랜서 기준)

## 3. 대금 지급
- 1차: 계약 체결 후 30% 선금
- 2차: 중간 산출물 납품 시 40%
- 3차: 최종 산출물 납품 및 검수 완료 시 30%

## 4. 납품 및 검수
- 을은 약정된 기일 내 산출물을 갑에게 제출한다.
- 갑은 산출물 수령 후 7영업일 이내 검수 의견을 서면으로 통지한다.

## 5. 저작권·지식재산권
- 최종 산출물의 저작권은 계약 금액 전액 지급 완료 시 갑에게 이전된다.
- 을은 포트폴리오 공개 권한을 보유한다.

## 6. 비밀유지
- 양 당사자는 계약 이행 중 알게 된 정보를 제3자에게 누설하지 않는다.

## 7. 계약 해제
- 중대한 사유가 있는 경우 상대방에게 서면 통지 후 계약을 해제할 수 있다.

## 8. 분쟁 해결
- 본 계약과 관련한 분쟁은 nutunion 커뮤니티 중재 → 서울중앙지방법원 관할 순으로 처리한다.

## 9. 기타
- 본 계약서에 명시되지 않은 사항은 관련 법령 및 상관례에 따른다.
- 본 계약서는 전자서명으로 효력을 가진다.

---

**계약 체결일**: _____________

**갑 (발주자)**: {{clientName}} _서명_

**을 (수주자)**: {{contractorName}} _서명_
`,
  },
  nda: {
    label: "비밀유지협약서 (NDA)",
    description: "프로젝트 킥오프 전 기밀 정보 보호 계약",
    body: `# 비밀유지협약서 (NDA)

**당사자 A**: {{clientName}}
**당사자 B**: {{contractorName}}

## 1. 비밀정보의 정의
양 당사자가 본 프로젝트와 관련하여 교환하는 모든 기술·사업·재무 정보.

## 2. 비밀유지 의무
- 제3자에게 공개·누설하지 않는다.
- 본 프로젝트 목적 외에 사용하지 않는다.
- 기간: 본 계약 체결일로부터 **2년**.

## 3. 예외
- 공지의 사실이거나 법적 강제력에 의한 공개.

## 4. 위반 시 손해배상
위반 시 실손해 및 징벌적 배상 책임을 진다.

---
체결일: _____________
A: {{clientName}} _서명_
B: {{contractorName}} _서명_
`,
  },
  revenue_share: {
    label: "수익 분배 계약",
    description: "공동 제작 / 성과 기반 보상",
    body: `# 수익 분배 계약서

**프로젝트**: {{title}}
**당사자 A (리드)**: {{clientName}}
**당사자 B (파트너)**: {{contractorName}}

## 1. 기여 범위
- A: 기획 / 운영 / 마케팅
- B: 실행 / 제작 / 납품

## 2. 수익 분배
- 순수익의 **A: __%**, **B: __%**
- 분배 주기: 월간 (매월 말일 정산)

## 3. 비용 공제
플랫폼 수수료, 결제 수수료 등은 공제 후 분배.

## 4. 계약 기간
{{startDate}} ~ {{endDate}} (연장 시 서면 합의)

## 5. 종료 후 권리
계약 종료 후에도 계약 기간 중 발생한 수익은 본 계약에 따라 분배.

---
체결일: _____________
A: {{clientName}} _서명_
B: {{contractorName}} _서명_
`,
  },
  custom: {
    label: "커스텀 계약",
    description: "자유 양식 (직접 작성)",
    body: `# {{title}}

**당사자 A**: {{clientName}}
**당사자 B**: {{contractorName}}

여기에 계약 내용을 작성하세요.

---
체결일: _____________
`,
  },
} as const;

export type ContractTemplateKey = keyof typeof CONTRACT_TEMPLATES;

export function renderTemplate(
  key: ContractTemplateKey,
  vars: { title: string; clientName: string; contractorName: string; amount: number; startDate: string; endDate: string }
): string {
  const body = CONTRACT_TEMPLATES[key].body;
  const formatted = vars.amount.toLocaleString("ko-KR");
  return body
    .replaceAll("{{title}}", vars.title || "—")
    .replaceAll("{{clientName}}", vars.clientName || "—")
    .replaceAll("{{contractorName}}", vars.contractorName || "—")
    .replaceAll("{{amount}}", formatted)
    .replaceAll("{{startDate}}", vars.startDate || "—")
    .replaceAll("{{endDate}}", vars.endDate || "—");
}

/**
 * 3.3% 원천징수 자동 계산 (개인 프리랜서 기준)
 * 소득세 3% + 지방소득세 0.3% = 3.3%
 */
export function calcWithholding(contractAmount: number, rate = 0.033) {
  const withholding = Math.round(contractAmount * rate);
  const net = contractAmount - withholding;
  return { withholding, net, rate };
}

/**
 * 세금계산서 계산 (사업자 간)
 * 공급가액 + VAT 10%
 */
export function calcVat(supplyAmount: number) {
  const vat = Math.round(supplyAmount * 0.1);
  const total = supplyAmount + vat;
  return { vat, total };
}

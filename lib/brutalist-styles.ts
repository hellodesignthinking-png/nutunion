// 브루탈리스트 스타일 프리셋 — shadcn primitive 에 className 으로 적용.
//
// shadcn 의 Dialog/Select/Tabs 같은 compound 컴포넌트는 variant prop 을 추가하기
// 복잡하므로, 사전 정의된 className 문자열을 재사용합니다.
//
// 사용 예:
//   <DialogContent className={brutalist.dialogContent}>
//   <SelectTrigger className={brutalist.selectTrigger}>
//   <TabsList className={brutalist.tabsList}>

export const brutalist = {
  // ── Dialog ─────────────────────────────────────────────────────
  dialogContent:
    "rounded-none border-[2.5px] border-nu-ink bg-nu-paper shadow-[4px_4px_0_0_rgba(13,13,13,1)]",
  dialogOverlay:
    "bg-nu-ink/30 backdrop-blur-sm",
  dialogTitle:
    "font-mono-nu text-[12px] uppercase tracking-[0.15em] text-nu-ink border-b-[2px] border-nu-ink pb-2",

  // ── Select ─────────────────────────────────────────────────────
  selectTrigger:
    "rounded-none border-[2.5px] border-nu-ink bg-nu-paper text-nu-ink font-sans text-[14px] h-10 focus:border-nu-pink focus:ring-0",
  selectContent:
    "rounded-none border-[2.5px] border-nu-ink bg-nu-paper shadow-[4px_4px_0_0_rgba(13,13,13,1)] p-0",
  selectItem:
    "rounded-none px-3 py-2 font-sans text-[13px] data-[highlighted]:bg-nu-ink data-[highlighted]:text-nu-paper",

  // ── Tabs ───────────────────────────────────────────────────────
  tabsList:
    "rounded-none border-b-[2.5px] border-nu-ink bg-transparent p-0 gap-0 h-auto",
  tabsTrigger:
    "rounded-none border-r-[2px] border-nu-ink/20 last:border-r-0 bg-transparent data-[state=active]:bg-nu-ink data-[state=active]:text-nu-paper data-[state=active]:shadow-none font-mono-nu text-[11px] uppercase tracking-widest px-4 py-2.5 h-auto",
  tabsContent: "mt-0 pt-4",

  // ── Sheet (모바일 side drawer) ──────────────────────────────────
  sheetContent:
    "rounded-none border-[2.5px] border-nu-ink bg-nu-paper",

  // ── Popover ────────────────────────────────────────────────────
  popoverContent:
    "rounded-none border-[2.5px] border-nu-ink bg-nu-paper shadow-[4px_4px_0_0_rgba(13,13,13,1)] p-0",

  // ── 레이블 / 필드 ───────────────────────────────────────────────
  fieldLabel:
    "font-mono-nu text-[10px] uppercase tracking-[0.15em] text-nu-graphite mb-1.5 block",

  // ── 컨테이너 — 일관된 본문 박스 ─────────────────────────────────
  panel:
    "border-[2.5px] border-nu-ink bg-nu-paper rounded-none",
  panelHeader:
    "border-b-[2px] border-nu-ink px-4 py-3 font-mono-nu text-[11px] uppercase tracking-widest",
  panelBody:
    "p-4",

  // ── Divider — 강조 섹션 구분 ───────────────────────────────────
  divider:
    "border-t-[2px] border-nu-ink/10",
  dividerStrong:
    "border-t-[2.5px] border-nu-ink",
} as const;

export type BrutalistStyles = typeof brutalist;

# Community Reader Mode — 커뮤니티 페이지 가독성 설계

## 진단 요약

### 컴포넌트 분류
| 컴포넌트 | 분류 | 비고 |
|---|---|---|
| Compact Hero (상단 그룹명·호스트·참여) | **[CHROME]** | 유지. 브랜드 확인 지점 |
| Quick Actions Bar | **[MIXED]** | 카드 브루탈리스트 → 리더블 액션 바로 분리 |
| GroupAnnouncements | **[CONTENT]** | 공지 본문 — Reader 적용 |
| DailyDigest | **[CONTENT]** | 본문 — Reader 적용 |
| GroupUpcomingSection | **[CONTENT]** | 일정 리스트 — Reader 적용 |
| ActivitySection | **[CONTENT]** | 피드 스트림 — Reader 적용 |
| GroupSidebarSections | **[CONTENT]** | 멤버·리소스 — Reader 적용 |
| GroupStatusPanel | **[MIXED]** | 데이터 읽기인데 `border-[2.5px]` · `font-mono-nu uppercase` 사용 |
| 페이지 헤더·하단 바 | **[CHROME]** | 유지 |

### 방해 요소 목록
1. **두꺼운 검정 테두리** (`border-[2.5px-3px] border-nu-ink`) — 카드마다 시각 노이즈
2. **전면 대문자 + tracking-widest** — 모든 라벨 / 위계 구분이 안 됨
3. **브루탈리스트 그림자** (`shadow-[4px_4px_0_0_...]`) — 본문 카드에서 무거움
4. **Riso 핑크 오버레이** (`bg-nu-pink/10`) — 본문에 스며들어 눈이 피곤
5. **혼용된 폰트 패밀리** — `font-head` / `font-mono-nu` / 기본 Pretendard 가 본문 내에서 섞임
6. **불규칙 px 값** — `py-2.5`, `px-[13px]` 등 홀수 / 비규칙 여백

### 현재 본문 타이포 값
- font-size: 11~14px 랜덤
- line-height: 기본값 (1.5 이하 가끔)
- max-width: 없음 (전체 뷰포트)
- letter-spacing: 대문자 라벨에 0.25em 적용, 본문엔 없음

### 기존 Tailwind 토큰 (유지 대상)
- 색상: `nu-ink` / `nu-paper` / `nu-pink` / `nu-blue` / `nu-amber` / `nu-graphite` / `nu-muted` / `nu-cream`
- 폰트: `font-head` (Riso Display) / `font-mono-nu` (모노) / `font-serif-nu`

---

## Reader Mode 설계 원칙

### 원칙 1 — Chrome/Content 분리
- 페이지 전역 헤더·푸터: 기존 Riso 유지
- 본문 영역(`<main>` 내부): 무채색 + Pretendard
- ⊕ 심볼·Liquid gradient 는 Reader Shell 안에서 제거 (CSS isolation)

### 원칙 2 — Korean-First 타이포
- 본문: Pretendard Variable 15px / line-height 1.75 / tracking -0.01em / `#1a1a1a` on `#fafafa`
- H1 (그룹명/게시물 제목): 24px semibold / 1.35
- H2 (섹션): 18px semibold / 1.4
- H3: 15px semibold / 1.5
- Meta: 13px regular / `#737373`
- 본문 최대 폭: 680px (사이드바 제외)

### 원칙 3 — 위계 3단
한 뷰포트에 텍스트 위계 최대 3단. 4단부터 탭/아코디언/별도 페이지로 분리.

### 원칙 4 — 4의 배수 리듬
- 섹션 간 48px · 카드 간 24px · 카드 내부 16px · 인라인 8px
- 홀수 / 비규칙 여백 금지

### 원칙 5 — 컬러 팔레트 (Reader 전용)
```
--reader-bg:        #fafafa
--reader-card:      #ffffff
--reader-border:    #e5e5e5
--reader-text:      #1a1a1a
--reader-muted:     #737373
--reader-accent:    var(--nu-pink)   /* 오늘의 Liquid 컬러 1개만 — 강성·뱃지·링크 */
```

### 원칙 6 — 반응형
모바일 `sm: 640px` 기준 — 사이드바 → 하단 탭 전환.

---

## 컴포넌트 Tailwind 명세

### ReaderShell
```tsx
<div className="reader-shell bg-[#fafafa] min-h-screen">
  <div className="max-w-[1040px] mx-auto px-4 md:px-6 py-6 md:py-8">
    <article className="max-w-[680px] mx-auto">{children}</article>
  </div>
</div>
```
CSS isolation: `.reader-shell { isolation: isolate; --liquid-gradient: none; }` + 심볼 selector 재정의.

### GroupHeader (Reader 버전)
```tsx
<header className="mb-8 pb-6 border-b border-[#e5e5e5]">
  <p className="text-[13px] text-[#737373] mb-2">{category} · 너트</p>
  <h1 className="font-[family:'Pretendard'] text-[24px] font-semibold text-[#1a1a1a] leading-[1.35] mb-3">
    {group.name}
  </h1>
  <p className="text-[15px] leading-[1.75] text-[#1a1a1a] mb-4">
    {group.description}
  </p>
  <div className="flex items-center gap-3 text-[13px] text-[#737373]">
    <span>호스트 <strong className="text-[#1a1a1a]">{host.nickname}</strong></span>
    <span>멤버 {memberCount}</span>
  </div>
</header>
```

### GroupTabs
```tsx
<nav className="flex gap-1 border-b border-[#e5e5e5] mb-6" role="tablist">
  {tabs.map(t => (
    <button role="tab" aria-selected={active === t.key}
      className={`px-4 py-3 text-[14px] font-medium border-b-2 -mb-px transition-colors
        ${active === t.key ? 'text-[#1a1a1a] border-[#1a1a1a]' : 'text-[#737373] border-transparent hover:text-[#1a1a1a]'}`}>
      {t.label}
    </button>
  ))}
</nav>
```

### PostCard
```tsx
<article className="bg-white border border-[#e5e5e5] rounded-lg p-4 mb-3 hover:border-[#d4d4d4]">
  <div className="flex items-center gap-2 text-[13px] text-[#737373] mb-2">
    <span>{author.nickname}</span>
    <span>·</span>
    <time>{timeAgo}</time>
  </div>
  <h2 className="text-[17px] font-semibold text-[#1a1a1a] leading-[1.4] mb-2">{title}</h2>
  <p className="text-[15px] text-[#1a1a1a] leading-[1.75] line-clamp-2">{preview}</p>
  <div className="flex gap-4 mt-3 text-[13px] text-[#737373]">
    <span>💬 {comments}</span>
    <span>👍 {likes}</span>
  </div>
</article>
```

### MemberListItem
```tsx
<li className="flex items-center gap-3 py-3 border-b border-[#f0f0f0]">
  <Avatar className="w-9 h-9 rounded-full" />
  <div className="flex-1 min-w-0">
    <div className="text-[14px] font-medium text-[#1a1a1a] truncate">{nickname}</div>
    <div className="text-[12px] text-[#737373]">{role} · 강성 {stiffness}</div>
  </div>
  <Link className="text-[13px] text-[var(--nu-pink)]">프로필</Link>
</li>
```

### EmptyState (Riso 유지 허용)
카드 내부 12px 패딩 / 이모지 + 단문 + CTA. 나머지 본문은 무채색.

---

## 접근성
- `role="tablist" / "tab"` + `aria-selected`
- 본문 링크 `underline decoration-[#e5e5e5] underline-offset-2 hover:decoration-[#1a1a1a]`
- 포커스 링: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nu-pink)]`

## 구현 순서
1. `ReaderShell` 컴포넌트 + CSS isolation
2. `GroupHeader` · `GroupTabs` (첫인상)
3. `PostCard` · `PostDetail` (본문 핵심)
4. `MemberListItem`

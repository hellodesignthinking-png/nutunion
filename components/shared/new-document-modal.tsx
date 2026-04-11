"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  FileText, Sheet, Presentation, X, Loader2, Plus,
  BookOpen, CheckSquare, Table, ListOrdered
} from "lucide-react";

interface NewDocumentModalProps {
  /** "group" or "project" */
  targetType: "group" | "project";
  /** group_id or project_id */
  targetId: string;
  /** For project resources: the stage */
  stage?: string;
  onCreated: () => void;
  onClose: () => void;
}

interface DocTemplate {
  key: string;
  name: string;
  icon: typeof FileText;
  iconColor: string;
  description: string;
  content: string;
}

const DOC_TEMPLATES: DocTemplate[] = [
  {
    key: "blank-doc",
    name: "빈 문서",
    icon: FileText,
    iconColor: "text-nu-blue",
    description: "빈 문서에서 자유롭게 작성합니다",
    content: "# 새 문서\n\n내용을 입력하세요...\n",
  },
  {
    key: "meeting-notes",
    name: "회의록",
    icon: BookOpen,
    iconColor: "text-nu-pink",
    description: "회의 내용을 체계적으로 기록합니다",
    content: `# 회의록

## 기본 정보
| 항목 | 내용 |
|------|------|
| 일시 | YYYY.MM.DD HH:MM |
| 장소 | |
| 참석자 | |
| 작성자 | |

---

## 안건

### 1. 안건 제목
- 논의 내용:
- 결정 사항:
- 담당자:

### 2. 안건 제목
- 논의 내용:
- 결정 사항:
- 담당자:

---

## 액션 아이템
- [ ] 액션 아이템 1 (담당: , 기한: )
- [ ] 액션 아이템 2 (담당: , 기한: )

## 다음 회의
- 일시:
- 안건:
`,
  },
  {
    key: "spreadsheet",
    name: "스프레드시트",
    icon: Sheet,
    iconColor: "text-green-600",
    description: "표 형식으로 데이터를 정리합니다",
    content: `# 데이터 시트

## 현황표

| No. | 항목 | 담당자 | 상태 | 비고 |
|-----|------|--------|------|------|
| 1 | | | 진행 중 | |
| 2 | | | 대기 | |
| 3 | | | 완료 | |
| 4 | | | 진행 중 | |
| 5 | | | 대기 | |

---

## 예산 현황

| 항목 | 예산 | 실제 | 차이 | 비율 |
|------|------|------|------|------|
| 인건비 | | | | |
| 재료비 | | | | |
| 기타비 | | | | |
| **합계** | | | | |

---

## 메모
-
`,
  },
  {
    key: "slides",
    name: "프레젠테이션",
    icon: Presentation,
    iconColor: "text-nu-amber",
    description: "발표 자료를 슬라이드 형식으로 작성합니다",
    content: `# 프레젠테이션

---

## 슬라이드 1: 제목

### 프로젝트 이름
**팀명 · 날짜**

발표자:

---

## 슬라이드 2: 목차

1. 프로젝트 개요
2. 현황 분석
3. 제안 방향
4. 기대 효과
5. 일정 및 예산

---

## 슬라이드 3: 프로젝트 개요

### 배경
-

### 목표
-

### 범위
-

---

## 슬라이드 4: 현황 분석

### 현재 상태
-

### 문제점
-

### 기회 요소
-

---

## 슬라이드 5: 제안 방향

### 핵심 전략
1.
2.
3.

### 실행 계획
-

---

## 슬라이드 6: 일정 및 예산

| 단계 | 기간 | 예산 | 담당 |
|------|------|------|------|
| 기획 | | | |
| 실행 | | | |
| 검수 | | | |

---

## Q&A

질문을 받겠습니다.
`,
  },
  {
    key: "checklist",
    name: "체크리스트",
    icon: CheckSquare,
    iconColor: "text-green-500",
    description: "할 일 목록을 체크리스트로 관리합니다",
    content: `# 체크리스트

## 준비 사항
- [ ] 항목 1
- [ ] 항목 2
- [ ] 항목 3
- [ ] 항목 4

## 진행 중
- [ ] 항목 A
- [ ] 항목 B

## 완료
- [x] 완료된 항목 예시

---

## 메모
-
`,
  },
  {
    key: "table-doc",
    name: "테이블 문서",
    icon: Table,
    iconColor: "text-purple-500",
    description: "표 중심의 정리 문서를 작성합니다",
    content: `# 정리 문서

## 비교 분석표

| 기준 | 옵션 A | 옵션 B | 옵션 C |
|------|--------|--------|--------|
| 가격 | | | |
| 품질 | | | |
| 기간 | | | |
| 지원 | | | |
| 총점 | | | |

---

## 일정표

| 주차 | 목표 | 담당 | 결과물 | 비고 |
|------|------|------|--------|------|
| 1주차 | | | | |
| 2주차 | | | | |
| 3주차 | | | | |
| 4주차 | | | | |

---

## 요약
-
`,
  },
];

export function NewDocumentModal({ targetType, targetId, stage, onCreated, onClose }: NewDocumentModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [docName, setDocName] = useState("");
  const [creating, setCreating] = useState(false);

  const template = DOC_TEMPLATES.find(t => t.key === selectedTemplate);

  async function handleCreate() {
    if (!docName.trim()) {
      toast.error("문서 이름을 입력해주세요");
      return;
    }
    if (!template) {
      toast.error("템플릿을 선택해주세요");
      return;
    }

    setCreating(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("로그인이 필요합니다");
      setCreating(false);
      return;
    }

    try {
      if (targetType === "group") {
        // Insert into file_attachments
        const { error } = await supabase.from("file_attachments").insert({
          target_type: "group",
          target_id: targetId,
          uploaded_by: user.id,
          file_name: docName.trim(),
          file_url: `/templates/${template.key}`,
          file_size: null,
          file_type: "document",
          content: template.content.replace("# 새 문서", `# ${docName.trim()}`).replace("# 회의록", `# ${docName.trim()}`).replace("# 데이터 시트", `# ${docName.trim()}`).replace("# 프레젠테이션", `# ${docName.trim()}`).replace("# 체크리스트", `# ${docName.trim()}`).replace("# 정리 문서", `# ${docName.trim()}`),
        });

        if (error) {
          // If content column doesn't exist
          if (error.code === "42703") {
            // Try without content
            const { error: e2 } = await supabase.from("file_attachments").insert({
              target_type: "group",
              target_id: targetId,
              uploaded_by: user.id,
              file_name: docName.trim(),
              file_url: `/templates/${template.key}`,
              file_size: null,
              file_type: "document",
            });
            if (e2) throw e2;
          } else {
            throw error;
          }
        }
      } else {
        // Insert into project_resources
        const typeMap: Record<string, string> = {
          "blank-doc": "google_doc",
          "meeting-notes": "google_doc",
          "spreadsheet": "google_sheet",
          "slides": "google_slide",
          "checklist": "google_doc",
          "table-doc": "google_sheet",
        };

        const { error } = await supabase.from("project_resources").insert({
          project_id: targetId,
          name: docName.trim(),
          url: `/templates/${template.key}`,
          type: typeMap[template.key] || "google_doc",
          stage: stage || "planning",
          description: template.description,
          uploaded_by: user.id,
          content: template.content.replace("# 새 문서", `# ${docName.trim()}`).replace("# 회의록", `# ${docName.trim()}`).replace("# 데이터 시트", `# ${docName.trim()}`).replace("# 프레젠테이션", `# ${docName.trim()}`).replace("# 체크리스트", `# ${docName.trim()}`).replace("# 정리 문서", `# ${docName.trim()}`),
        });

        if (error) {
          if (error.code === "42703") {
            const { error: e2 } = await supabase.from("project_resources").insert({
              project_id: targetId,
              name: docName.trim(),
              url: `/templates/${template.key}`,
              type: typeMap[template.key] || "google_doc",
              stage: stage || "planning",
              description: template.description,
              uploaded_by: user.id,
            });
            if (e2) throw e2;
          } else {
            throw error;
          }
        }
      }

      toast.success(`"${docName.trim()}" 문서가 생성되었습니다`);
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error("문서 생성 실패: " + (err.message || "알 수 없는 오류"));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-nu-paper w-full max-w-lg max-h-[85vh] flex flex-col border-2 border-nu-ink shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-nu-ink bg-nu-ink text-nu-paper">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Plus size={14} className="text-nu-pink" />
              <span className="font-mono-nu text-[9px] font-black uppercase tracking-[0.25em] text-nu-pink">New_Document</span>
            </div>
            <p className="text-[11px] text-nu-paper/60">새 문서를 만들어 자료실에서 바로 편집하세요</p>
          </div>
          <button onClick={onClose} className="text-nu-paper/50 hover:text-nu-paper transition-colors cursor-pointer bg-transparent border-none">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Document name */}
          <div>
            <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block mb-1.5">문서 이름 *</label>
            <input
              value={docName}
              onChange={e => setDocName(e.target.value)}
              placeholder="예: 4월 정기회의록, 프로젝트 일정표..."
              className="w-full h-10 border-2 border-nu-ink/10 bg-nu-white px-3 text-sm focus:outline-none focus:border-nu-pink transition-colors"
              autoFocus
            />
          </div>

          {/* Template selection */}
          <div>
            <label className="font-mono-nu text-[9px] uppercase tracking-widest text-nu-muted block mb-2">문서 유형 선택</label>
            <div className="grid grid-cols-2 gap-2">
              {DOC_TEMPLATES.map(t => {
                const isSelected = selectedTemplate === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setSelectedTemplate(t.key)}
                    className={`text-left p-3 border-2 transition-all cursor-pointer ${
                      isSelected
                        ? "border-nu-pink bg-nu-pink/5 shadow-sm"
                        : "border-nu-ink/[0.08] bg-nu-white hover:border-nu-ink/20"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <t.icon size={16} className={t.iconColor} />
                      <span className="text-sm font-bold text-nu-ink">{t.name}</span>
                    </div>
                    <p className="text-[10px] text-nu-muted leading-snug">{t.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t-2 border-nu-ink/10 flex items-center justify-between bg-nu-cream/20">
          <button
            onClick={onClose}
            className="font-mono-nu text-[10px] uppercase tracking-widest px-4 py-2 border border-nu-ink/10 text-nu-muted hover:bg-nu-ink/5 transition-all cursor-pointer"
          >
            취소
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !docName.trim() || !selectedTemplate}
            className="font-mono-nu text-[10px] font-bold uppercase tracking-widest px-5 py-2 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1.5 border-none"
          >
            {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            문서 만들기
          </button>
        </div>
      </div>
    </div>
  );
}

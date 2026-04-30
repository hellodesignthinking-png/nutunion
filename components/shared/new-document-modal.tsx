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
  /** file_type stored in DB — determines icon & editing behavior */
  fileType: string;
  /** If set, creates a Google Drive document instead of an in-app template. */
  driveType?: "doc" | "sheet" | "slide";
}

const DOC_TEMPLATES: DocTemplate[] = [
  {
    key: "drive-doc",
    name: "📄 Google 문서",
    icon: FileText,
    iconColor: "text-nu-blue",
    description: "내 Drive 에 Google Docs 문서를 생성합니다",
    fileType: "drive-doc",
    driveType: "doc",
    content: "",
  },
  {
    key: "drive-sheet",
    name: "📊 Google 스프레드시트",
    icon: Sheet,
    iconColor: "text-green-600",
    description: "내 Drive 에 Google Sheets 를 생성합니다",
    fileType: "drive-sheet",
    driveType: "sheet",
    content: "",
  },
  {
    key: "drive-slide",
    name: "🖼️ Google 슬라이드",
    icon: Presentation,
    iconColor: "text-nu-amber",
    description: "내 Drive 에 Google Slides 를 생성합니다",
    fileType: "drive-slide",
    driveType: "slide",
    content: "",
  },
  {
    key: "blank-doc",
    name: "빈 문서",
    icon: FileText,
    iconColor: "text-nu-blue",
    description: "빈 문서에서 자유롭게 작성합니다",
    fileType: "document",
    content: "# 새 문서\n\n내용을 입력하세요...\n",
  },
  {
    key: "meeting-notes",
    name: "회의록",
    icon: BookOpen,
    iconColor: "text-nu-pink",
    description: "회의 내용을 체계적으로 기록합니다",
    fileType: "meeting_notes",
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
    fileType: "spreadsheet",
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
    fileType: "presentation",
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
    description: "할일 목록을 체크리스트로 관리합니다",
    fileType: "checklist",
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
    fileType: "table_doc",
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
      // ── Google Drive 문서 생성 분기 ──
      if (template.driveType) {
        const createRes = await fetch("/api/google/drive/create-doc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: template.driveType,
            title: docName.trim(),
            scope: targetType,
            scope_id: targetId,
          }),
        });
        const createJson = await createRes.json();
        if (!createRes.ok || !createJson.web_view_link) {
          if (createJson.code === "NOT_CONNECTED") {
            toast.error("Google 계정 연결 필요 — /settings/integrations 에서 연결해주세요");
          } else if (createJson.code === "TOKEN_EXPIRED") {
            toast.error("Google 토큰 만료 — 다시 연결해주세요");
          } else {
            toast.error(createJson.error || "Drive 문서 생성 실패");
          }
          setCreating(false);
          return;
        }

        // 서버에서 이미 자료실 등록 완료된 경우 → 클라이언트 추가 등록 스킵
        if (createJson.registered) {
          toast.success(`"${docName.trim()}" — Drive 에 생성되어 자료실에 등록되었습니다`);
          onCreated();
          onClose();
          return;
        }

        // Drive 생성 성공 → 자료실 (file_attachments / project_resources) 에 등록 (fallback)
        if (targetType === "group") {
          const r = await fetch("/api/resources/group", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              group_id: targetId,
              file_name: docName.trim(),
              file_url: createJson.web_view_link,
              file_size: 0,
              file_type: template.fileType, // drive-doc | drive-sheet | drive-slide
              storage_type: "drive",
              storage_key: createJson.id,
            }),
          });
          if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error(j.error || "자료실 등록 실패");
          }
        } else {
          const driveTypeMap: Record<string, string> = {
            doc: "google_doc",
            sheet: "google_sheet",
            slide: "google_slide",
          };
          const { error } = await supabase.from("project_resources").insert({
            project_id: targetId,
            name: docName.trim(),
            url: createJson.web_view_link,
            type: driveTypeMap[template.driveType] || "google_doc",
            stage: stage || "planning",
            description: `Google Drive ${template.driveType.toUpperCase()}`,
            uploaded_by: user.id,
          });
          if (error) throw error;
        }

        toast.success(`"${docName.trim()}" — Drive 에 생성되어 자료실에 등록되었습니다`);
        onCreated();
        onClose();
        return;
      }

      // Replace the default heading with user's document name
      const finalContent = template.content
        .replace(/^# .+$/m, `# ${docName.trim()}`);

      if (targetType === "group") {
        // Insert into file_attachments with proper type
        const insertData: Record<string, any> = {
          target_type: "group",
          target_id: targetId,
          uploaded_by: user.id,
          file_name: docName.trim(),
          file_url: `/templates/${template.key}`,
          file_size: null,
          file_type: template.fileType,
          content: finalContent,
        };

        const { error } = await supabase.from("file_attachments").insert(insertData);

        if (error) {
          if (error.code === "42703" && error.message?.includes("content")) {
            // content column missing — try without it
            delete insertData.content;
            const { error: e2 } = await supabase.from("file_attachments").insert(insertData);
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
          "slides": "google_doc",
          "checklist": "google_doc",
          "table-doc": "google_sheet",
        };

        const insertData: Record<string, any> = {
          project_id: targetId,
          name: docName.trim(),
          url: `/templates/${template.key}`,
          type: typeMap[template.key] || "google_doc",
          stage: stage || "planning",
          description: template.description,
          uploaded_by: user.id,
          content: finalContent,
        };

        const { error } = await supabase.from("project_resources").insert(insertData);

        if (error) {
          if (error.code === "42703" && error.message?.includes("content")) {
            delete insertData.content;
            const { error: e2 } = await supabase.from("project_resources").insert(insertData);
            if (e2) throw e2;
          } else {
            throw error;
          }
        }
      }

      toast.success(`"${docName.trim()}" 문서가 생성되었습니다`);
      onCreated();
      onClose();
    } catch (err: unknown) {
    const __err = err as { message?: string; code?: number; name?: string };
      toast.error("문서 생성 실패: " + (__err.message || "알 수 없는 오류"));
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
              <span className="font-mono-nu text-[11px] font-black uppercase tracking-[0.25em] text-nu-pink">New_Document</span>
            </div>
            <p className="text-[13px] text-nu-paper/60">새 문서를 만들어 자료실에서 바로 편집하세요</p>
          </div>
          <button onClick={onClose} className="text-nu-paper/50 hover:text-nu-paper transition-colors cursor-pointer bg-transparent border-none">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Document name */}
          <div>
            <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted block mb-1.5">문서 이름 *</label>
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
            <label className="font-mono-nu text-[11px] uppercase tracking-widest text-nu-muted block mb-2">문서 유형 선택</label>
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
                    <p className="text-[12px] text-nu-muted leading-snug">{t.description}</p>
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
            className="font-mono-nu text-[12px] uppercase tracking-widest px-4 py-2 border border-nu-ink/10 text-nu-muted hover:bg-nu-ink/5 transition-all cursor-pointer"
          >
            취소
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !docName.trim() || !selectedTemplate}
            className="font-mono-nu text-[12px] font-bold uppercase tracking-widest px-5 py-2 bg-nu-ink text-nu-paper hover:bg-nu-graphite transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1.5 border-none"
          >
            {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            문서 만들기
          </button>
        </div>
      </div>
    </div>
  );
}

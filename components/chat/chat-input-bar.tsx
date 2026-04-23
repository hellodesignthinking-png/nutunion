"use client";

/**
 * ChatInputBar — 메시지 입력 + 카카오톡 스타일 첨부 시트.
 *
 * 구성:
 *  - 숨김 input (accept/capture 로 앨범/카메라/동영상/파일 분리)
 *  - + 버튼 → 첨부 시트 토글
 *  - 이모지 피커
 *  - 녹음 중지 버튼 (recording 시)
 *  - textarea (auto-grow)
 *  - 전송 버튼
 *  - 시트 (8개 그리드)
 */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  Mic,
  Square,
  Loader2,
  FileIcon,
  Plus,
  Camera,
  Image as ImageLucide,
  Video,
  Calendar,
  Link2,
  Paperclip,
  FolderOpen,
} from "lucide-react";
import { EmojiPicker } from "./emoji-picker";
import { AttachItem } from "./attach-item";
import { SlashCommandsPalette, parseSlashInput } from "./slash-commands";

export interface ChatInputBarProps {
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  uploading: boolean;
  recording: boolean;
  onToggleRecording: () => void;
  onUpload: (file: File) => Promise<void> | void;
  showAttachMenu: boolean;
  setShowAttachMenu: (v: boolean) => void;
  /** 현재 방이 그룹/볼트에 속해있으면 일정/자료실 버튼 노출 */
  groupId?: string | null;
  projectId?: string | null;
}

export function ChatInputBar({
  draft,
  setDraft,
  onSend,
  sending,
  uploading,
  recording,
  onToggleRecording,
  onUpload,
  showAttachMenu,
  setShowAttachMenu,
  groupId,
  projectId,
}: ChatInputBarProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // textarea auto-grow
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [draft]);

  const resourceLink = groupId ? `/groups/${groupId}` : projectId ? `/projects/${projectId}` : null;

  const handlePickFromInput = async (
    e: React.ChangeEvent<HTMLInputElement>,
    multiple = false,
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) {
      e.target.value = "";
      return;
    }
    if (multiple) {
      for (const f of files.slice(0, 10)) await onUpload(f);
    } else {
      await onUpload(files[0]);
    }
    e.target.value = "";
  };

  const slashActive = !!parseSlashInput(draft);

  return (
    <>
      {/* 입력창 (+ 슬래시 명령어 팔레트) */}
      <div
        className="flex items-end gap-1 px-2 py-2 border-t border-nu-ink/10 bg-white shrink-0 chat-system-font relative"
        style={{ paddingBottom: showAttachMenu ? "8px" : "max(8px, env(safe-area-inset-bottom))" }}
      >
        {slashActive && (
          <SlashCommandsPalette
            draft={draft}
            groupId={groupId}
            projectId={projectId}
            onExecuted={() => setDraft("")}
          />
        )}
        {/* 숨김 input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => handlePickFromInput(e)}
          accept="*/*"
        />
        <input
          ref={imageInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={(e) => handlePickFromInput(e, true)}
          accept="image/*"
        />
        <input
          ref={cameraInputRef}
          type="file"
          className="hidden"
          onChange={(e) => handlePickFromInput(e)}
          accept="image/*"
          capture="environment"
        />
        <input
          ref={videoInputRef}
          type="file"
          className="hidden"
          onChange={(e) => handlePickFromInput(e)}
          accept="video/*"
        />

        {/* + 버튼 */}
        <button
          onClick={() => setShowAttachMenu(!showAttachMenu)}
          disabled={uploading || recording}
          className={`p-2.5 rounded-full transition-all shrink-0 ${
            showAttachMenu
              ? "bg-nu-ink text-white rotate-45"
              : "text-nu-graphite hover:text-nu-ink hover:bg-nu-ink/5"
          } disabled:opacity-40`}
          aria-label="첨부 메뉴"
        >
          {uploading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} strokeWidth={2.2} />}
        </button>

        <EmojiPicker onSelect={(emoji) => setDraft(draft + emoji)} />

        {recording && (
          <button
            onClick={onToggleRecording}
            className="p-2.5 rounded-full bg-nu-pink text-white animate-pulse shrink-0"
            aria-label="녹음 중지"
          >
            <Square size={18} />
          </button>
        )}

        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => {
            // 안드로이드 키보드 올라올 때 jank 방지 — 시트 열려있을 때만 지연 닫기
            if (showAttachMenu) {
              setTimeout(() => setShowAttachMenu(false), 180);
            }
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || (e as any).keyCode === 229) return;
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={recording ? "녹음 중…" : "메시지를 입력하세요"}
          disabled={recording}
          rows={1}
          className="flex-1 px-3.5 py-2 bg-[#F1F2F5] border border-transparent rounded-[20px] text-[15px] leading-[1.4] focus:bg-white focus:border-nu-ink/20 outline-none resize-none max-h-[120px] chat-system-font"
        />
        <button
          onClick={onSend}
          disabled={sending || !draft.trim()}
          className={`p-2.5 rounded-full shrink-0 transition-all ${
            draft.trim() && !sending
              ? "bg-nu-pink text-white shadow-md hover:bg-nu-ink"
              : "bg-nu-ink/10 text-nu-muted cursor-not-allowed"
          }`}
          aria-label="전송"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} strokeWidth={2.2} />}
        </button>
      </div>

      {/* 첨부 시트 */}
      {showAttachMenu && (
        <div
          className="bg-white border-t border-nu-ink/10 shrink-0 animate-slide-up"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
        >
          <div className="grid grid-cols-4 gap-1 p-3">
            <AttachItem
              icon={<ImageLucide size={22} />}
              label="앨범"
              color="#34A853"
              onClick={() => {
                imageInputRef.current?.click();
                setShowAttachMenu(false);
              }}
            />
            <AttachItem
              icon={<Camera size={22} />}
              label="카메라"
              color="#4285F4"
              onClick={() => {
                cameraInputRef.current?.click();
                setShowAttachMenu(false);
              }}
            />
            <AttachItem
              icon={<Video size={22} />}
              label="동영상"
              color="#9333EA"
              onClick={() => {
                videoInputRef.current?.click();
                setShowAttachMenu(false);
              }}
            />
            <AttachItem
              icon={<FileIcon size={22} />}
              label="파일"
              color="#F59E0B"
              onClick={() => {
                fileInputRef.current?.click();
                setShowAttachMenu(false);
              }}
            />
            <AttachItem
              icon={<Mic size={22} />}
              label={recording ? "중지" : "녹음"}
              color="#EC4899"
              onClick={onToggleRecording}
              pulse={recording}
            />
            {resourceLink && (
              <AttachItem
                icon={<Calendar size={22} />}
                label="일정"
                color="#0EA5E9"
                onClick={() => {
                  const calLink = groupId
                    ? `/groups/${groupId}/schedule`
                    : projectId
                      ? `/projects/${projectId}`
                      : null;
                  setShowAttachMenu(false);
                  if (calLink) router.push(calLink);
                }}
              />
            )}
            {resourceLink && (
              <AttachItem
                icon={<FolderOpen size={22} />}
                label="자료실"
                color="#14B8A6"
                onClick={() => {
                  const resLink = groupId
                    ? `/groups/${groupId}/resources`
                    : projectId
                      ? `/projects/${projectId}`
                      : null;
                  setShowAttachMenu(false);
                  if (resLink) router.push(resLink);
                }}
              />
            )}
            <AttachItem
              icon={<Link2 size={22} />}
              label="링크"
              color="#6B7280"
              onClick={() => {
                const url = prompt("공유할 링크 URL");
                if (url?.trim()) {
                  setDraft((draft ? draft + " " : "") + url.trim());
                }
                setShowAttachMenu(false);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

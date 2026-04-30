"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { TimezoneSelect, localToZonedISO, defaultTimezone } from "@/components/shared/timezone-select";

export default function CreateEventPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;
  const [loading, setLoading] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState("weekly");
  const [recurrenceEndType, setRecurrenceEndType] = useState<"count" | "until" | "never">("count");
  const [recurrenceCount, setRecurrenceCount] = useState(10);
  const [recurrenceUntil, setRecurrenceUntil] = useState("");
  const [timezone, setTimezone] = useState<string>(() => defaultTimezone());

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const title = fd.get("title") as string;
    const description = fd.get("description") as string;
    const location = fd.get("location") as string;
    const date = fd.get("date") as string;
    const startTime = fd.get("startTime") as string;
    const endTime = fd.get("endTime") as string;
    const maxAttendees = fd.get("maxAttendees") as string;

    if (!date || !startTime || !endTime) {
      toast.error("날짜와 시간을 입력해주세요");
      setLoading(false);
      return;
    }

    const startAt = localToZonedISO(date, startTime, timezone);
    const endAt = localToZonedISO(date, endTime, timezone);

    let recurrenceRule: string | null = null;
    if (isRecurring) {
      const rules: Record<string, string> = {
        daily: "FREQ=DAILY",
        weekly: "FREQ=WEEKLY",
        biweekly: "FREQ=WEEKLY;INTERVAL=2",
        monthly: "FREQ=MONTHLY",
      };
      let rule = rules[recurrenceType];
      // 종료 조건 추가
      if (recurrenceEndType === "count" && recurrenceCount > 0) {
        rule += `;COUNT=${recurrenceCount}`;
      } else if (recurrenceEndType === "until" && recurrenceUntil) {
        // RFC 5545 UNTIL — UTC YYYYMMDDTHHMMSSZ 형식. 사용자 선택 타임존의 23:59 를
        // UTC 로 변환해야 KST 외 사용자에게도 정확. +09:00 하드코딩 제거.
        const utcIso = localToZonedISO(recurrenceUntil, "23:59", timezone);
        const z = utcIso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
        rule += `;UNTIL=${z}`;
      }
      recurrenceRule = `RRULE:${rule}`;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("events").insert({
      group_id: groupId,
      title,
      description: description || null,
      location: location || null,
      start_at: startAt,
      end_at: endAt,
      max_attendees: maxAttendees ? parseInt(maxAttendees) : null,
      is_recurring: isRecurring,
      recurrence_rule: recurrenceRule,
      created_by: user?.id,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success("일정이 생성되었습니다!");
    router.push(`/groups/${groupId}`);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-12">
      <h1 className="font-head text-3xl font-extrabold text-nu-ink mb-2">
        새 일정 만들기
      </h1>
      <p className="text-nu-gray text-sm mb-8">너트 일정을 추가하세요</p>

      <div className="bg-nu-white border border-nu-ink/[0.08] p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <Label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray">
              제목
            </Label>
            <Input
              name="title"
              required
              placeholder="정기 모임"
              className="mt-1.5 border-nu-ink/15 bg-transparent"
            />
          </div>

          <div>
            <Label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray">
              설명
            </Label>
            <Textarea
              name="description"
              rows={3}
              placeholder="일정에 대한 설명"
              className="mt-1.5 border-nu-ink/15 bg-transparent resize-none"
            />
          </div>

          <div>
            <Label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray">
              장소
            </Label>
            <Input
              name="location"
              placeholder="서울 강남구 역삼동"
              className="mt-1.5 border-nu-ink/15 bg-transparent"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray">
                날짜
              </Label>
              <Input
                name="date"
                type="date"
                required
                className="mt-1.5 border-nu-ink/15 bg-transparent"
              />
            </div>
            <div>
              <Label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray">
                시작 시간
              </Label>
              <Input
                name="startTime"
                type="time"
                required
                className="mt-1.5 border-nu-ink/15 bg-transparent"
              />
            </div>
            <div>
              <Label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray">
                종료 시간
              </Label>
              <Input
                name="endTime"
                type="time"
                required
                className="mt-1.5 border-nu-ink/15 bg-transparent"
              />
            </div>
            <div className="md:col-span-3">
              <Label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray">
                타임존
              </Label>
              <div className="mt-1.5">
                <TimezoneSelect value={timezone} onChange={setTimezone} className="w-full sm:w-auto" />
              </div>
              <p className="text-[11px] text-nu-muted mt-1">해외 멤버를 위한 타임존 — 다른 사용자에게는 자동으로 그쪽 시각으로 표시됩니다</p>
            </div>
          </div>

          <div>
            <Label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray">
              최대 참석 인원 (선택)
            </Label>
            <Input
              name="maxAttendees"
              type="number"
              min={1}
              placeholder="제한 없음"
              className="mt-1.5 border-nu-ink/15 bg-transparent w-32"
            />
          </div>

          {/* Recurring toggle */}
          <div className="flex items-center gap-3 py-2">
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
            <Label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray">
              반복 일정
            </Label>
          </div>

          {isRecurring && (
            <div className="space-y-3 p-4 bg-nu-cream/20 border-2 border-nu-ink/10">
              <div>
                <Label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray">
                  반복 주기
                </Label>
                <Select value={recurrenceType} onValueChange={(v) => v && setRecurrenceType(v)}>
                  <SelectTrigger className="mt-1.5 border-nu-ink/15 bg-transparent w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">매일</SelectItem>
                    <SelectItem value="weekly">매주</SelectItem>
                    <SelectItem value="biweekly">격주</SelectItem>
                    <SelectItem value="monthly">매월</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="font-mono-nu text-[12px] uppercase tracking-widest text-nu-gray">
                  종료 조건
                </Label>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {(["count", "until", "never"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setRecurrenceEndType(opt)}
                      className={`font-mono-nu text-[11px] uppercase tracking-widest px-3 py-1.5 border-[2px] transition-all ${
                        recurrenceEndType === opt
                          ? "border-nu-ink bg-nu-ink text-nu-paper"
                          : "border-nu-ink/15 text-nu-muted hover:border-nu-ink"
                      }`}
                    >
                      {opt === "count" ? "횟수" : opt === "until" ? "특정일까지" : "무제한"}
                    </button>
                  ))}
                </div>
                {recurrenceEndType === "count" && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={recurrenceCount}
                      onChange={(e) => setRecurrenceCount(Math.max(1, Number(e.target.value) || 1))}
                      className="w-20 px-2 py-1 border-2 border-nu-ink/15 text-sm"
                    />
                    <span className="text-[12px] text-nu-muted">번 반복</span>
                  </div>
                )}
                {recurrenceEndType === "until" && (
                  <div className="mt-2">
                    <input
                      type="date"
                      value={recurrenceUntil}
                      onChange={(e) => setRecurrenceUntil(e.target.value)}
                      className="px-2 py-1 border-2 border-nu-ink/15 text-sm"
                    />
                  </div>
                )}
                <p className="mt-2 text-[11px] text-nu-muted">
                  {recurrenceEndType === "count" && `이 일정이 ${recurrenceCount}번 반복된 후 종료됩니다.`}
                  {recurrenceEndType === "until" && (recurrenceUntil ? `${recurrenceUntil} 까지 반복합니다.` : "종료 날짜를 선택해주세요")}
                  {recurrenceEndType === "never" && "수동으로 멈출 때까지 계속 생성됩니다."}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <Button
              type="submit"
              disabled={loading}
              className="bg-nu-ink text-nu-paper hover:bg-nu-pink font-mono-nu text-[13px] uppercase tracking-widest px-8"
            >
              {loading ? "생성 중..." : "일정 만들기"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="font-mono-nu text-[13px] uppercase tracking-widest"
            >
              취소
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

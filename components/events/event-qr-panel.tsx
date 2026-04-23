"use client";

import { useEffect, useState } from "react";
import { QrCode, Copy, Check, Loader2, Users, RefreshCw, Radio, Smartphone } from "lucide-react";
import { toast } from "sonner";

interface Props {
  eventId: string;
  isHost: boolean;
}

/**
 * 이벤트 호스트용 QR 체크인 패널.
 * - QR 토큰 생성/재발급
 * - 공개 체크인 URL 복사 (Google Charts API 로 QR 이미지)
 * - 실시간 체크인 리스트
 */
/**
 * NFC 태그 쓰기 버튼.
 * - Web NFC API (Chrome Android 전용) 로 체크인 URL 을 NFC 태그에 NDEF 메시지로 기록
 * - 미지원 브라우저면 docs 링크 + 수동 인코딩 안내
 */
function NfcWriteButton({ url }: { url: string }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [writing, setWriting] = useState(false);
  const [written, setWritten] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "NDEFReader" in window);
  }, []);

  async function writeTag() {
    setWriting(true); setWritten(false);
    try {
      // @ts-expect-error — experimental Web NFC
      const ndef = new window.NDEFReader();
      await ndef.write({ records: [{ recordType: "url", data: url }] });
      setWritten(true);
      toast.success("NFC 태그에 쓰기 완료!");
    } catch (e: any) {
      toast.error("NFC 쓰기 실패: " + (e.message || "태그를 기기에 가까이 대고 다시 시도"));
    } finally {
      setWriting(false);
    }
  }

  if (supported === null) return null;

  if (!supported) {
    return (
      <details className="mt-2">
        <summary className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-graphite cursor-pointer hover:text-nu-ink inline-flex items-center gap-1">
          <Radio size={10} /> NFC 태그로도 체크인 가능
        </summary>
        <div className="mt-1 text-[10px] text-nu-graphite bg-nu-cream/20 p-2 border border-nu-ink/10 leading-relaxed">
          이 브라우저는 Web NFC 미지원. <strong>Chrome Android</strong>에서 열거나,
          NFC Tools 같은 앱으로 위 URL을 NDEF 메시지로 직접 인코딩하세요.<br />
          <span className="text-nu-muted">NFC 태그(NTAG213 이상) 에 쓰면 폰을 대기만 해도 체크인 페이지가 열립니다.</span>
        </div>
      </details>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-1.5">
      <button
        type="button"
        onClick={writeTag}
        disabled={writing}
        className="inline-flex items-center gap-1 font-mono-nu text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5 border-[2px] border-purple-500 text-purple-600 hover:bg-purple-500 hover:text-white transition-colors disabled:opacity-50"
      >
        {writing ? <Loader2 size={10} className="animate-spin" /> : written ? <Check size={10} className="text-green-600" /> : <Radio size={10} />}
        {written ? "NFC 완료" : writing ? "태그에 대세요..." : "NFC 태그 쓰기"}
      </button>
      <span className="font-mono-nu text-[9px] text-nu-graphite inline-flex items-center gap-1">
        <Smartphone size={9} /> 폰을 NFC 태그에 대세요
      </span>
    </div>
  );
}

export function EventQrPanel({ eventId, isHost }: Props) {
  const [loading, setLoading] = useState(false);
  const [checkinUrl, setCheckinUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    if (!isHost || !showPanel) return;
    loadCheckins();
    const interval = setInterval(loadCheckins, 10000); // 10초 폴링
    return () => clearInterval(interval);
  }, [isHost, showPanel, eventId]);

  async function loadCheckins() {
    try {
      const res = await fetch(`/api/events/${eventId}/checkin`);
      if (res.ok) {
        const data = await res.json();
        setCheckins(data.checkins || []);
      }
    } catch {}
  }

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "QR 생성 실패");
      setCheckinUrl(data.checkin_url);
      toast.success("QR 체크인이 활성화됐습니다");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!checkinUrl) return;
    await navigator.clipboard.writeText(checkinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!isHost) return null;

  // QR 이미지: free Google Charts API
  const qrSrc = checkinUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(checkinUrl)}`
    : null;

  if (!showPanel) {
    return (
      <button
        type="button"
        onClick={() => setShowPanel(true)}
        className="inline-flex items-center gap-1.5 font-mono-nu text-[11px] font-bold uppercase tracking-widest px-3 py-2 border-[2px] border-nu-ink bg-nu-paper hover:bg-nu-ink hover:text-nu-paper transition-colors"
      >
        <QrCode size={12} /> QR 체크인
      </button>
    );
  }

  return (
    <section className="border-[2.5px] border-nu-ink bg-nu-paper">
      <header className="flex items-center justify-between px-4 py-3 border-b-[2px] border-nu-ink bg-nu-cream/30">
        <div className="flex items-center gap-2">
          <QrCode size={14} className="text-nu-pink" />
          <h3 className="font-mono-nu text-[11px] uppercase tracking-[0.25em] font-bold text-nu-ink">QR 체크인</h3>
        </div>
        <button type="button" onClick={() => setShowPanel(false)} className="font-mono-nu text-[10px] text-nu-graphite hover:text-nu-ink uppercase">
          닫기
        </button>
      </header>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          {!checkinUrl ? (
            <div className="flex flex-col items-center justify-center h-60 border-[2px] border-dashed border-nu-ink/20 p-4 text-center">
              <QrCode size={32} className="text-nu-muted mb-2" />
              <p className="text-[12px] text-nu-graphite mb-3">아직 QR 이 생성되지 않았어요</p>
              <button
                type="button"
                onClick={generate}
                disabled={loading}
                className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-4 py-2 bg-nu-pink text-nu-paper hover:bg-nu-pink/90 inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {loading ? <Loader2 size={11} className="animate-spin" /> : <QrCode size={11} />}
                QR 생성
              </button>
            </div>
          ) : (
            <div>
              <div className="border-[2px] border-nu-ink p-3 bg-nu-paper inline-block">
                {qrSrc && <img src={qrSrc} alt="Event check-in QR" className="w-60 h-60" />}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={checkinUrl}
                  readOnly
                  className="flex-1 px-2 py-1.5 border-[2px] border-nu-ink/15 text-[11px] font-mono-nu tabular-nums bg-nu-cream/20"
                />
                <button type="button" onClick={copy} aria-label="URL 복사" className="px-2 py-1.5 border-[2px] border-nu-ink/15 hover:bg-nu-ink hover:text-nu-paper">
                  {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                </button>
                <button type="button" onClick={generate} disabled={loading} aria-label="재발급" title="토큰 재발급 (기존 QR 무효화)" className="px-2 py-1.5 border-[2px] border-nu-ink/15 hover:bg-nu-amber hover:text-nu-paper hover:border-nu-amber">
                  <RefreshCw size={12} />
                </button>
              </div>
              <p className="font-mono-nu text-[9px] text-nu-graphite mt-1 leading-relaxed">
                참가자가 QR 을 스캔하면 로그인 후 자동으로 체크인됩니다.<br />
                체크인은 이벤트 시작 1시간 전부터 가능.
              </p>

              {/* NFC 대안 */}
              <NfcWriteButton url={checkinUrl} />
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-mono-nu text-[10px] uppercase tracking-widest font-bold text-nu-graphite inline-flex items-center gap-1">
              <Users size={11} /> 체크인 ({checkins.length})
            </h4>
            <button type="button" onClick={loadCheckins} aria-label="새로고침" className="text-nu-graphite hover:text-nu-ink">
              <RefreshCw size={11} />
            </button>
          </div>
          {checkins.length === 0 ? (
            <p className="text-[11px] text-nu-graphite italic">아직 체크인이 없습니다</p>
          ) : (
            <ul className="list-none m-0 p-0 space-y-1 max-h-60 overflow-y-auto">
              {checkins.map((c, i) => (
                <li key={c.user_id} className="flex items-center gap-2 py-1 px-2 border-l-[2px] border-nu-pink/30 bg-nu-pink/[0.03]">
                  <span className="font-mono-nu text-[10px] text-nu-muted tabular-nums w-5">#{i + 1}</span>
                  {c.profile?.avatar_url ? (
                    <img src={c.profile.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-nu-pink/20 flex items-center justify-center text-[10px] font-bold text-nu-pink">
                      {(c.profile?.nickname || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="flex-1 text-[12px] font-bold text-nu-ink truncate">{c.profile?.nickname || c.user_id.slice(0, 8)}</span>
                  <span className="font-mono-nu text-[9px] text-nu-muted tabular-nums">
                    {new Date(c.checked_in_at).toLocaleTimeString("ko", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

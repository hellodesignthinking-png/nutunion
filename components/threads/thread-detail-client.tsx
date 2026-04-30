"use client";
import { useState } from "react";
import { useEscapeKey } from "@/lib/hooks/use-escape-key";

type Thread = {
  id: string; slug: string; name: string; description: string | null; icon: string | null;
  category: string; scope: string[]; schema: any; config_schema: any | null;
};

type Review = {
  id: string; user_id: string; rating: number; comment: string | null; created_at: string;
  profile?: { id: string; nickname: string | null; avatar_url: string | null } | null;
};

type Target = { id: string; name: string };

interface Props {
  thread: Thread;
  reviews: Review[];
  myReview: Review | null;
  currentUserId: string;
  installPreview: { nuts: Target[]; bolts: Target[] };
  userNuts: Target[];
  userBolts: Target[];
}

export function ThreadDetailClient({ thread, reviews, myReview, currentUserId, installPreview, userNuts, userBolts }: Props) {
  const [showInstall, setShowInstall] = useState(false);
  const [rating, setRating] = useState(myReview?.rating ?? 5);
  const [comment, setComment] = useState(myReview?.comment ?? "");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  useEscapeKey(() => setShowInstall(false), showInstall);
  useEscapeKey(() => setConfirmingDelete(false), confirmingDelete);

  const submitReview = async () => {
    setReviewBusy(true); setReviewMsg(null);
    try {
      const res = await fetch(`/api/threads/${thread.slug}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      if (res.ok) { setReviewMsg("저장됨"); setTimeout(() => location.reload(), 600); }
      else { const j = await res.json(); setReviewMsg(j.error || "오류"); }
    } catch (e: any) { setReviewMsg(e.message); }
    finally { setReviewBusy(false); }
  };

  const deleteReview = async () => {
    setConfirmingDelete(false);
    setReviewBusy(true);
    try {
      await fetch(`/api/threads/${thread.slug}/reviews`, { method: "DELETE" });
      location.reload();
    } catch (e: any) {
      setReviewMsg(e.message || "오류");
      setReviewBusy(false);
    }
  };

  const schemaProps = thread.schema?.properties || {};
  const configProps = thread.config_schema?.properties || {};

  return (
    <>
      <div className="flex justify-end">
        <button onClick={() => setShowInstall(true)}
          className="border-[3px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[12px] uppercase tracking-widest font-bold px-4 py-2 shadow-[3px_3px_0_0_#0D0F14]">
          설치하기
        </button>
      </div>

      {/* Schema */}
      {Object.keys(schemaProps).length > 0 && (
        <section className="border-[3px] border-nu-ink bg-white p-4 space-y-2">
          <h2 className="font-head text-lg font-extrabold">데이터 스키마</h2>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b-[2px] border-nu-ink">
                <th className="text-left py-1 font-mono-nu uppercase tracking-widest text-[10px]">필드</th>
                <th className="text-left py-1 font-mono-nu uppercase tracking-widest text-[10px]">타입</th>
                <th className="text-left py-1 font-mono-nu uppercase tracking-widest text-[10px]">설명</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(schemaProps).map(([k, v]: [string, any]) => (
                <tr key={k} className="border-b border-nu-ink/20">
                  <td className="py-1 font-bold">{k}</td>
                  <td className="py-1">{Array.isArray(v.type) ? v.type.join("|") : v.type || "—"}</td>
                  <td className="py-1 text-nu-muted">{v.format || v.enum?.join(", ") || (v.maxLength ? `max ${v.maxLength}` : "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {Object.keys(configProps).length > 0 && (
        <section className="border-[3px] border-nu-ink bg-white p-4 space-y-2">
          <h2 className="font-head text-lg font-extrabold">설정 옵션</h2>
          <ul className="text-xs font-mono space-y-1">
            {Object.entries(configProps).map(([k, v]: [string, any]) => (
              <li key={k}><b>{k}</b>: <span className="text-nu-muted">{Array.isArray(v.type) ? v.type.join("|") : v.type}</span> {v.default !== undefined && <span className="text-nu-muted">(default: {JSON.stringify(v.default)})</span>}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Public installations */}
      {(installPreview.nuts.length > 0 || installPreview.bolts.length > 0) && (
        <section className="border-[3px] border-nu-ink bg-white p-4 space-y-2">
          <h2 className="font-head text-lg font-extrabold">이 Thread 를 설치한 너트/볼트</h2>
          <div className="flex flex-wrap gap-1">
            {installPreview.nuts.map((n) => (
              <span key={n.id} className="border-[2px] border-nu-ink bg-nu-cream/40 font-mono text-xs px-2 py-0.5">너트: {n.name}</span>
            ))}
            {installPreview.bolts.map((b) => (
              <span key={b.id} className="border-[2px] border-nu-ink bg-white font-mono text-xs px-2 py-0.5">볼트: {b.name}</span>
            ))}
          </div>
        </section>
      )}

      {/* Reviews */}
      <section className="border-[3px] border-nu-ink bg-white p-4 space-y-3">
        <h2 className="font-head text-lg font-extrabold">리뷰</h2>

        <div className="border-[2px] border-nu-ink bg-nu-cream/20 p-3 space-y-2">
          <div className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted">{myReview ? "내 리뷰 수정" : "리뷰 작성"}</div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} className={`text-xl ${rating >= n ? "text-amber-500" : "text-nu-muted/50"}`}>★</button>
            ))}
          </div>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="이 Thread 에 대한 한 줄 평..."
            className="w-full border-[2px] border-nu-ink p-2 font-mono text-sm" rows={2} />
          <div className="flex gap-2">
            <button onClick={submitReview} disabled={reviewBusy}
              className="border-[2px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1 disabled:opacity-50">
              {reviewBusy ? "..." : myReview ? "수정" : "등록"}
            </button>
            {myReview && (
              <button onClick={() => setConfirmingDelete(true)}
                className="border-[2px] border-nu-ink bg-white font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1 hover:bg-red-50 hover:border-red-600">
                삭제
              </button>
            )}
            {confirmingDelete && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setConfirmingDelete(false)}>
                <div role="dialog" aria-modal="true" aria-labelledby="del-review-title" className="bg-white border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] max-w-sm w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
                  <h3 id="del-review-title" className="font-head text-lg font-extrabold">리뷰 삭제</h3>
                  <p className="text-sm font-mono text-nu-muted">정말 리뷰를 삭제할까요? 이 작업은 되돌릴 수 없습니다.</p>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setConfirmingDelete(false)}
                      className="border-[2px] border-nu-ink bg-white font-mono-nu text-[10px] uppercase tracking-widest px-3 py-1">
                      취소
                    </button>
                    <button onClick={deleteReview} disabled={reviewBusy}
                      className="border-[2px] border-nu-ink bg-red-600 text-white font-mono-nu text-[10px] uppercase tracking-widest font-bold px-3 py-1 disabled:opacity-50">
                      {reviewBusy ? "삭제 중..." : "삭제"}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {reviewMsg && <span className="text-xs font-mono text-nu-muted self-center">{reviewMsg}</span>}
          </div>
        </div>

        {reviews.length === 0 ? (
          <div className="text-sm font-mono text-nu-muted">아직 리뷰가 없습니다.</div>
        ) : (
          <ul className="space-y-2">
            {reviews.map((r) => (
              <li key={r.id} className="border-[2px] border-nu-ink/30 p-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="font-bold">{r.profile?.nickname || "익명"}</span>
                  <span className="text-amber-500">{"★".repeat(r.rating)}</span>
                </div>
                {r.comment && <p className="text-sm mt-1">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {showInstall && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowInstall(false)}>
          <div role="dialog" aria-modal="true" className="bg-white border-[3px] border-nu-ink shadow-[6px_6px_0_0_#0D0F14] max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
            <InstallList thread={thread} userNuts={userNuts} userBolts={userBolts} onClose={() => setShowInstall(false)} />
          </div>
        </div>
      )}
    </>
  );
}

function InstallList({ thread, userNuts, userBolts, onClose }: { thread: Thread; userNuts: Target[]; userBolts: Target[]; onClose: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});

  const eligibleNuts = thread.scope.includes("nut") ? userNuts : [];
  const eligibleBolts = thread.scope.includes("bolt") ? userBolts : [];

  const install = async (target_type: "nut" | "bolt", target_id: string) => {
    const key = `${target_type}:${target_id}`;
    setBusy(key); setError(null);
    try {
      const res = await fetch("/api/threads/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: thread.slug, target_type, target_id, config: {} }),
      });
      const j = await res.json();
      if (!res.ok) setError(j.error || "설치 실패");
      else setDone((d) => ({ ...d, [key]: true }));
    } catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-head text-lg font-extrabold">{thread.name} 설치</h3>
        <button onClick={onClose} aria-label="설치 창 닫기" className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-muted hover:text-nu-ink focus:outline-none focus:ring-2 focus:ring-nu-pink px-2 py-1">✕</button>
      </div>

      {eligibleNuts.length === 0 && eligibleBolts.length === 0 && (
        <div className="text-sm font-mono text-nu-muted">호환되는 너트/볼트가 없습니다.</div>
      )}

      {eligibleNuts.map((n) => {
        const k = `nut:${n.id}`;
        return (
          <div key={k} className="flex items-center justify-between border-[2px] border-nu-ink px-2 py-1">
            <span className="text-sm">너트: {n.name}</span>
            {done[k] ? <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink">설치됨</span>
              : <button disabled={busy === k} onClick={() => install("nut", n.id)}
                  className="border-[2px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5">
                  {busy === k ? "..." : "설치"}
                </button>}
          </div>
        );
      })}
      {eligibleBolts.map((b) => {
        const k = `bolt:${b.id}`;
        return (
          <div key={k} className="flex items-center justify-between border-[2px] border-nu-ink px-2 py-1">
            <span className="text-sm">볼트: {b.name}</span>
            {done[k] ? <span className="font-mono-nu text-[10px] uppercase tracking-widest text-nu-pink">설치됨</span>
              : <button disabled={busy === k} onClick={() => install("bolt", b.id)}
                  className="border-[2px] border-nu-ink bg-nu-pink text-white font-mono-nu text-[10px] uppercase tracking-widest px-2 py-0.5">
                  {busy === k ? "..." : "설치"}
                </button>}
          </div>
        );
      })}

      {error && <div className="border-[2px] border-amber-500 bg-amber-50 p-2 text-xs font-mono">{error}</div>}
    </div>
  );
}

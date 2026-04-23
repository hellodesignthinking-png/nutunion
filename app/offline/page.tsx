export const metadata = { title: "오프라인" };
export const dynamic = "force-static";

import OfflineClient from "./offline-client";

export default function OfflinePage() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-nu-paper">
      <div className="max-w-md w-full border-[2.5px] border-nu-ink bg-nu-paper p-8 text-center shadow-[4px_4px_0_0_rgba(13,13,13,1)]">
        <div className="text-[48px] mb-4" aria-hidden>🛰</div>
        <div className="font-mono-nu text-[10px] uppercase tracking-[0.3em] text-nu-graphite mb-2">
          OFFLINE
        </div>
        <h1 className="text-[22px] font-bold text-nu-ink mb-3">
          네트워크에 연결되지 않았습니다
        </h1>
        <p className="text-[13px] text-nu-graphite mb-6 leading-relaxed">
          인터넷 연결을 확인한 뒤 다시 시도해주세요.<br />
          이미 방문한 페이지는 계속 열 수 있습니다.
        </p>

        <OfflineClient />

        <div className="mt-4 pt-4 border-t border-nu-ink/10">
          <p className="text-[11px] text-nu-muted leading-relaxed">
            네트워크는 연결됐는데 이 화면이 계속 보인다면, 아래 버튼으로 캐시를 초기화하세요.
          </p>
        </div>
      </div>
    </div>
  );
}

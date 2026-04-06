import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-nu-paper px-8">
      <div className="text-center max-w-md">
        <span
          className="font-head text-[120px] font-extrabold leading-none block mb-4"
          style={{ WebkitTextStroke: "2px #0D0D0D", color: "transparent" }}
        >
          404
        </span>
        <h1 className="font-head text-2xl font-extrabold text-nu-ink mb-3">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="text-nu-gray text-sm mb-8">
          요청하신 페이지가 존재하지 않거나 이동되었습니다.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/"
            className="font-mono-nu text-[11px] font-bold uppercase tracking-widest px-6 py-3 bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors no-underline"
          >
            홈으로
          </Link>
          <Link
            href="/crews"
            className="font-mono-nu text-[11px] uppercase tracking-widest px-6 py-3 border border-nu-ink/20 text-nu-graphite hover:bg-nu-ink hover:text-nu-paper transition-colors no-underline"
          >
            크루 탐색
          </Link>
        </div>
      </div>
    </div>
  );
}

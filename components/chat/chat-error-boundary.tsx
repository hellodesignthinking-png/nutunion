"use client";

/**
 * ChatErrorBoundary — 채팅 영역 전용 Error Boundary.
 *
 * 메시지 렌더/실시간/첨부 중 예외가 터지면 앱 전체가 죽지 않도록 잡고,
 * "다시 시도" 버튼으로 내부 상태를 reset. 전역 app error 로는 안 올라감.
 */

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** 재시도 시 외부 상태도 리셋할 수 있는 key (ex. roomId) */
  resetKey?: unknown;
}

interface State {
  error: Error | null;
}

export class ChatErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // 프로덕션 관측용 — 콘솔만. (상용 APM 붙일 때 여기서 hook)
    console.error("[ChatErrorBoundary]", error, info);
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  private retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="h-full flex items-center justify-center p-6 bg-white">
        <div className="max-w-sm text-center">
          <div className="text-[40px] mb-2">🧯</div>
          <div className="font-bold text-[15px] text-nu-ink mb-1">채팅 화면에서 문제가 발생했어요</div>
          <p className="text-[12px] text-nu-graphite mb-4 leading-relaxed">
            일시적인 오류일 수 있어요. 다시 시도해도 계속 나오면 새로고침해 주세요.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={this.retry}
              className="px-4 py-2 bg-nu-pink text-white rounded-full text-[12px] font-semibold hover:bg-nu-ink transition-colors"
            >
              다시 시도
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 border border-nu-ink/20 text-nu-graphite rounded-full text-[12px] hover:bg-nu-ink/5 transition-colors"
            >
              페이지 새로고침
            </button>
          </div>
          {process.env.NODE_ENV !== "production" && (
            <pre className="mt-4 text-left text-[10px] text-red-600 overflow-auto max-h-40 bg-red-50 p-2 rounded">
              {error.message}
              {"\n"}
              {error.stack?.split("\n").slice(0, 8).join("\n")}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

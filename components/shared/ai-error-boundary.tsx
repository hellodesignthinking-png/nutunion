"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AiErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("AI Component Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-nu-red/5 border-[2px] border-nu-red/20 p-8 text-center">
          <AlertTriangle size={32} className="mx-auto mb-3 text-nu-red" />
          <h3 className="font-head text-lg font-bold text-nu-red mb-2">
            {this.props.fallbackTitle || "AI 컴포넌트 오류"}
          </h3>
          <p className="text-sm text-nu-gray mb-4">
            {this.state.error?.message || "예기치 않은 오류가 발생했습니다."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="inline-flex items-center gap-2 px-4 py-2 font-mono-nu text-[12px] uppercase tracking-widest bg-nu-ink text-nu-paper hover:bg-nu-pink transition-colors"
          >
            <RefreshCw size={12} /> 다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

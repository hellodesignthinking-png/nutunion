"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface SidebarCtx {
  collapsed: boolean;
  toggle: () => void;
}

const Ctx = createContext<SidebarCtx>({ collapsed: false, toggle: () => {} });

const STORAGE_KEY = "nu_sidebar_collapsed";

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "1") setCollapsed(true);
    } catch {}
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch {}
      // 반영: body 에 data-attr 로 노출 — CSS 선택자 기반으로 nav/main 폭 조정
      if (typeof document !== "undefined") {
        document.body.dataset.sidebarCollapsed = next ? "1" : "0";
      }
      return next;
    });
  };

  // 초기 body 속성 주입
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.dataset.sidebarCollapsed = collapsed ? "1" : "0";
    }
  }, [collapsed]);

  return <Ctx.Provider value={{ collapsed, toggle }}>{children}</Ctx.Provider>;
}

export function useSidebar() {
  return useContext(Ctx);
}

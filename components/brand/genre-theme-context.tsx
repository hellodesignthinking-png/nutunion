"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { LogoGenre, GENRES, GenreConfig, getDailySeedGenre } from "@/lib/brand/genre-engine";

interface ThemeContextValue {
  activeGenre: LogoGenre;
  cfg: GenreConfig;
  setGenre: (g: LogoGenre) => void;
}

const defaultGenre = getDailySeedGenre();

const ThemeCtx = createContext<ThemeContextValue>({
  activeGenre: defaultGenre,
  cfg: GENRES[defaultGenre],
  setGenre: () => {},
});

export function GenreThemeProvider({ children }: { children: React.ReactNode }) {
  const [activeGenre, setActiveGenre] = useState<LogoGenre>(getDailySeedGenre());

  useEffect(() => {
    const cfg = GENRES[activeGenre];
    const root = document.documentElement;
    // Inject CSS variables for site-wide sync
    root.style.setProperty("--today-bg",        cfg.colors.bg);
    root.style.setProperty("--today-primary",   cfg.colors.primary);
    root.style.setProperty("--today-secondary", cfg.colors.secondary);
    root.style.setProperty("--today-accent",    cfg.colors.accent);
    root.style.setProperty("--today-text",      cfg.colors.text);
    root.style.setProperty("--today-surface",   cfg.colors.surface);
    root.style.setProperty("--today-font",      `'${cfg.font}', sans-serif`);
  }, [activeGenre]);

  return (
    <ThemeCtx.Provider value={{ activeGenre, cfg: GENRES[activeGenre], setGenre: setActiveGenre }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useGenreTheme() {
  return useContext(ThemeCtx);
}

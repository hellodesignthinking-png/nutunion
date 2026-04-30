"use client";
import { useEffect } from "react";

/**
 * useEscapeKey — call `onEscape` when the Escape key is pressed.
 *
 * Use for closing modals/dialogs/popovers.
 *
 * ```tsx
 * useEscapeKey(() => setOpen(false), open);
 * ```
 *
 * The optional `enabled` flag lets callers gate the listener based on whether
 * the modal is open — saves attaching/detaching keyhandlers when closed.
 */
export function useEscapeKey(onEscape: () => void, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onEscape();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onEscape, enabled]);
}

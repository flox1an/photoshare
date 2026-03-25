import { useEffect, useState } from "react";

interface UseViewerKeyboardShortcutsArgs {
  lightboxOpen: boolean;
  toggleGridFullscreen: () => void;
}

export function useViewerKeyboardShortcuts({
  lightboxOpen,
  toggleGridFullscreen,
}: UseViewerKeyboardShortcutsArgs) {
  const [gridFullscreen, setGridFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setGridFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    if (lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "f") toggleGridFullscreen();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxOpen, toggleGridFullscreen]);

  return { gridFullscreen };
}

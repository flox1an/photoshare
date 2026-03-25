import { useEffect, useState } from "react";

export function useViewport() {
  const [viewport, setViewport] = useState(() => ({
    scrollY: typeof window === "undefined" ? 0 : window.scrollY,
    height: typeof window === "undefined" ? 800 : window.innerHeight,
  }));

  useEffect(() => {
    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const nextY = window.scrollY;
        const nextHeight = window.innerHeight;
        setViewport((prev) => {
          if (prev.scrollY === nextY && prev.height === nextHeight) return prev;
          return { scrollY: nextY, height: nextHeight };
        });
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return viewport;
}

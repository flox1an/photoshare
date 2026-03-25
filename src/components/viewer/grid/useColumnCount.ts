import { useEffect, useState } from "react";

function getColumnCount() {
  if (typeof window === "undefined") return 2;
  const w = window.innerWidth;
  if (w >= 1024) return 4;
  if (w >= 640) return 3;
  const isLandscape = window.matchMedia?.("(orientation: landscape)").matches ?? false;
  if (isLandscape && w >= 560) return 3;
  return 2;
}

export function useColumnCount() {
  const [count, setCount] = useState(getColumnCount);

  useEffect(() => {
    const update = () => setCount(getColumnCount());
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return count;
}

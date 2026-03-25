import { useEffect, useState, type RefObject } from "react";

export function useElementWidth<T extends HTMLElement>(ref: RefObject<T | null>) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!ref.current) return;

    const measure = () => {
      const node = ref.current;
      if (!node) return;
      const style = window.getComputedStyle(node);
      const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
      const paddingRight = Number.parseFloat(style.paddingRight) || 0;
      const w = node.clientWidth - paddingLeft - paddingRight;
      if (w > 0) setWidth(w);
    };

    measure();

    const Observer = window.ResizeObserver;
    let observer: ResizeObserver | null = null;
    if (Observer) {
      observer = new Observer(measure);
      observer.observe(ref.current);
    }
    window.addEventListener("resize", measure);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref]);

  return width;
}

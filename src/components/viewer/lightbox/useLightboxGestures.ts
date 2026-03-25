import { useGesture } from "@use-gesture/react";
import { useRef, type MutableRefObject, type RefObject } from "react";

interface Point {
  x: number;
  y: number;
}

interface UseLightboxGesturesArgs {
  currentIndex: number;
  photosLength: number;
  containerRef: RefObject<HTMLDivElement | null>;
  scaleRef: MutableRefObject<number>;
  translateRef: MutableRefObject<Point>;
  isPinchingRef: MutableRefObject<boolean>;
  setScale: (next: number) => void;
  setTranslate: (next: Point) => void;
  clampTranslate: (x: number, y: number, scale: number) => Point;
  setSlideTransition: (next: string | undefined) => void;
  setSlideX: (next: number) => void;
  navigateWithSlide: (direction: "next" | "prev") => void;
}

export function useLightboxGestures({
  currentIndex,
  photosLength,
  containerRef,
  scaleRef,
  translateRef,
  isPinchingRef,
  setScale,
  setTranslate,
  clampTranslate,
  setSlideTransition,
  setSlideX,
  navigateWithSlide,
}: UseLightboxGesturesArgs) {
  const pinchOriginRef = useRef<[number, number]>([0, 0]);

  return useGesture(
    {
      onDrag: ({ swipe: [swipeX], movement: [mx, my], direction: [dirX], memo, first, last, tap }) => {
        if (tap) return;
        if (isPinchingRef.current) return;

        const s = scaleRef.current;
        if (s > 1) {
          const startTranslate = (first ? translateRef.current : memo) as Point;
          const clamped = clampTranslate(startTranslate.x + mx, startTranslate.y + my, s);
          setTranslate(clamped);
          translateRef.current = clamped;
          return startTranslate;
        }

        if (last) {
          const w = containerRef.current?.clientWidth ?? window.innerWidth;
          const hasSufficientDisplacement = Math.abs(mx) > w * 0.33;
          const goNext =
            (swipeX === -1 || (hasSufficientDisplacement && dirX < 0)) &&
            currentIndex < photosLength - 1;
          const goPrev =
            (swipeX === 1 || (hasSufficientDisplacement && dirX > 0)) &&
            currentIndex > 0;

          if (goNext) {
            navigateWithSlide("next");
          } else if (goPrev) {
            navigateWithSlide("prev");
          } else {
            setSlideTransition("transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)");
            setSlideX(0);
          }
        } else {
          setSlideTransition(undefined);
          setSlideX(mx);
        }
      },
      onPinch: ({ da: [distance], origin, memo, first, last }) => {
        isPinchingRef.current = !last;

        type PinchMemo = {
          scale: number;
          translate: Point;
          distance: number;
          origin: [number, number];
        };

        const startState = (
          first
            ? {
                scale: scaleRef.current,
                translate: { ...translateRef.current },
                distance,
                origin,
              }
            : memo
        ) as PinchMemo;

        if (first) {
          pinchOriginRef.current = origin;
        }

        if (!startState || startState.distance === 0) return startState;

        const rawScale = startState.scale * (distance / startState.distance);
        const newScale = Math.min(Math.max(rawScale, 1), 5);

        if (newScale <= 1) {
          const reset = { x: 0, y: 0 };
          setScale(1);
          setTranslate(reset);
          scaleRef.current = 1;
          translateRef.current = reset;
          return startState;
        }

        let newTranslate = startState.translate;
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          const pinchOrigin = pinchOriginRef.current;
          const ox = pinchOrigin[0] - rect.left - rect.width / 2;
          const oy = pinchOrigin[1] - rect.top - rect.height / 2;
          const ratio = newScale / startState.scale;
          newTranslate = {
            x: ox + (startState.translate.x - ox) * ratio,
            y: oy + (startState.translate.y - oy) * ratio,
          };
        }

        const clamped = clampTranslate(newTranslate.x, newTranslate.y, newScale);
        setScale(newScale);
        setTranslate(clamped);
        scaleRef.current = newScale;
        translateRef.current = clamped;

        return startState;
      },
    },
    {
      drag: { filterTaps: true },
      pinch: { scaleBounds: { min: 1, max: 5 } },
    },
  );
}

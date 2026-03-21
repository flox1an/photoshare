"use client";

import { useMemo } from "react";
import { thumbHashToDataURL } from "thumbhash";

interface ThumbhashCanvasProps {
  hash: string;
  aspectRatio: string;
  className?: string;
}

/**
 * Renders a ThumbHash string (base64) as a blurred placeholder image.
 * ThumbHash is decoded to a data URL and displayed via <img>, CSS-scaled to fill its container.
 */
export default function ThumbhashCanvas({ hash, aspectRatio, className }: ThumbhashCanvasProps) {
  const dataUrl = useMemo(() => {
    try {
      const bytes = Uint8Array.from(atob(hash), (c) => c.charCodeAt(0));
      return thumbHashToDataURL(bytes);
    } catch {
      return null;
    }
  }, [hash]);

  if (!dataUrl) return null;

  return (
    <img
      src={dataUrl}
      style={{ aspectRatio, width: "100%", objectFit: "cover" }}
      className={`rounded-md ${className ?? ""}`}
      alt=""
      aria-hidden
    />
  );
}

"use client";

import { useEffect, useRef } from "react";
import { decode } from "blurhash";

interface BlurhashCanvasProps {
  hash: string;
  aspectRatio: string;
  className?: string;
}

const DECODE_SIZE = 32;

/**
 * Renders a BlurHash string to a 32×32 canvas, CSS-scaled to fill its container.
 * Used as a placeholder before the actual thumbnail loads.
 */
export default function BlurhashCanvas({ hash, aspectRatio, className }: BlurhashCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hash) return;
    try {
      const pixels = decode(hash, DECODE_SIZE, DECODE_SIZE);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const imageData = ctx.createImageData(DECODE_SIZE, DECODE_SIZE);
      imageData.data.set(pixels);
      ctx.putImageData(imageData, 0, 0);
    } catch {
      // Invalid blurhash — canvas stays blank, SkeletonCard fallback handles it
    }
  }, [hash]);

  return (
    <canvas
      ref={canvasRef}
      width={DECODE_SIZE}
      height={DECODE_SIZE}
      style={{ aspectRatio, width: "100%", imageRendering: "auto" }}
      className={`rounded-md ${className ?? ""}`}
    />
  );
}

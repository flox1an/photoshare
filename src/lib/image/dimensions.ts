/**
 * Aspect-ratio-preserving dimension calculator for the image processing pipeline.
 * Never upscales: if srcW and srcH are both smaller than maxLongEdge, returns original dimensions.
 */
export function fitToLongEdge(
  srcW: number,
  srcH: number,
  maxLongEdge: number,
): { w: number; h: number } {
  const long = Math.max(srcW, srcH);
  if (long <= maxLongEdge) return { w: srcW, h: srcH };
  const scale = maxLongEdge / long;
  return {
    w: Math.round(srcW * scale),
    h: Math.round(srcH * scale),
  };
}

import type { PhotoEntry } from "@/types/album";

export interface LayoutEntry {
  index: number;
  top: number;
  height: number;
}

export interface ColumnLayout {
  entries: LayoutEntry[];
  totalHeight: number;
}

export function distributeToColumns(photos: PhotoEntry[], colCount: number): number[][] {
  const columns: number[][] = Array.from({ length: colCount }, () => []);
  const heights = new Float64Array(colCount);
  for (let i = 0; i < photos.length; i++) {
    let shortest = 0;
    for (let c = 1; c < colCount; c++) {
      if (heights[c] < heights[shortest]) shortest = c;
    }
    columns[shortest].push(i);
    heights[shortest] += photos[i].height / photos[i].width;
  }
  return columns;
}

export function buildColumnLayout(
  columns: number[][],
  photos: PhotoEntry[],
  columnWidth: number,
  gapPx: number,
): ColumnLayout[] {
  return columns.map((col) => {
    const entries: LayoutEntry[] = [];
    let top = 0;

    col.forEach((index, idx) => {
      const p = photos[index];
      const height = Math.max(1, (columnWidth * p.height) / p.width);
      entries.push({ index, top, height });
      top += height;
      if (idx < col.length - 1) top += gapPx;
    });

    return { entries, totalHeight: top };
  });
}

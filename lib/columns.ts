import type { Photo, PhotoPosition } from "@/types/photo";

export const MIN_COLUMNS = 1;
export const MAX_COLUMNS = 6;
export const SIDEBAR_COLUMN_INDEX = -1;

export function clampColumns(n: number): number {
  return Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, Math.round(n)));
}

function shortestColumn(columns: Photo[][]): Photo[] {
  let target = columns[0];
  for (const col of columns) {
    if (col.length < target.length) target = col;
  }
  return target;
}

/**
 * Group photos into `count` visible columns using their stored column_index /
 * column_order. Photos in the sidebar/tray (column_index = -1) are omitted
 * here and can be read with getSidebarPhotos().
 */
export function groupByColumns(photos: Photo[], count: number): Photo[][] {
  const columns: Photo[][] = Array.from({ length: count }, () => []);

  for (const photo of photos) {
    if (photo.column_index >= 0 && photo.column_index < count) {
      columns[photo.column_index].push(photo);
    }
  }

  for (const column of columns) {
    column.sort((a, b) => a.column_order - b.column_order);
  }

  return columns;
}

export function getSidebarPhotos(photos: Photo[]): Photo[] {
  return photos
    .filter((photo) => photo.column_index === SIDEBAR_COLUMN_INDEX)
    .sort((a, b) => a.column_order - b.column_order);
}

/**
 * Change the number of columns, keeping existing columns intact and moving any
 * photos from removed columns into the shortest remaining column.
 */
export function redistribute(columns: Photo[][], newCount: number): Photo[][] {
  const kept = columns.slice(0, newCount).map((c) => c.slice());
  while (kept.length < newCount) kept.push([]);

  const orphans = columns.slice(newCount).flat();
  for (const photo of orphans) {
    shortestColumn(kept).push(photo);
  }

  return kept;
}

/**
 * Flatten columns into a full position snapshot for persistence.
 */
export function toPositions(
  columns: Photo[][],
  sidebar: Photo[] = []
): PhotoPosition[] {
  const positions: PhotoPosition[] = [];
  columns.forEach((column, columnIndex) => {
    column.forEach((photo, order) => {
      positions.push({
        id: photo.id,
        column_index: columnIndex,
        column_order: order,
      });
    });
  });
  sidebar.forEach((photo, order) => {
    positions.push({
      id: photo.id,
      column_index: SIDEBAR_COLUMN_INDEX,
      column_order: order,
    });
  });
  return positions;
}

/**
 * Build a display layout in row-major reading order, distributed round-robin
 * across `displayCount` columns. Used to collapse the composed layout on small
 * screens while preserving top-to-bottom priority.
 */
export function distributeReadingOrder(
  photos: Photo[],
  displayCount: number
): Photo[][] {
  const ordered = [...photos].sort(
    (a, b) => a.column_order - b.column_order || a.column_index - b.column_index
  );
  const columns: Photo[][] = Array.from({ length: displayCount }, () => []);
  ordered.forEach((photo, i) => {
    columns[i % displayCount].push(photo);
  });
  return columns;
}

export function gridTemplateColumns(count: number): string {
  return `repeat(${count}, minmax(0, 1fr))`;
}

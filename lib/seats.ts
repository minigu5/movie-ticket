import type { MovieSettings } from "./db-types";

export interface HallShape {
  isGrand: boolean;
  rows: string[];
  cols: number[];
}

export const MID_HALL_NAME = "대구과학고등학교 중강당";
export const GRAND_HALL_NAME = "대구과학고등학교 대강당";

export function getHallShape(venue: string): HallShape {
  const isGrand = venue.includes("대강당");
  const rows = isGrand
    ? ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R"]
    : ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
  const cols = isGrand
    ? Array.from({ length: 27 }, (_, i) => i + 1)
    : Array.from({ length: 14 }, (_, i) => i + 1);
  return { isGrand, rows, cols };
}

/**
 * Mid hall: 14 cols → A01..A63 (left 7) | B01..B63 (right 7), with one phantom seat removed.
 * Grand hall: 27 cols → A001..C162 split into 3 blocks of 9.
 * Returns null for the phantom slot in mid hall.
 */
export function getSeatId(rowIndex: number, colIndex: number, isGrand: boolean): string | null {
  if (!isGrand) {
    if (colIndex < 7) {
      const num = rowIndex * 7 + colIndex + 1;
      return `A${String(num).padStart(2, "0")}`;
    }
    const num = rowIndex * 7 + (colIndex - 7) + 1;
    if (num === 63) return null;
    return `B${String(num).padStart(2, "0")}`;
  }
  if (colIndex < 9) {
    const num = rowIndex * 9 + colIndex + 1;
    return `A${String(num).padStart(3, "0")}`;
  }
  if (colIndex < 18) {
    const num = rowIndex * 9 + (colIndex - 9) + 1;
    return `B${String(num).padStart(3, "0")}`;
  }
  const num = rowIndex * 9 + (colIndex - 18) + 1;
  return `C${String(num).padStart(3, "0")}`;
}

export function isAisleColumn(colNum: number, isGrand: boolean): boolean {
  return isGrand ? colNum === 9 || colNum === 18 : colNum === 7;
}

export function computeVipSeats(movie: MovieSettings, shape: HallShape): Set<string> {
  const vips = new Set<string>();
  const startRow = shape.isGrand ? movie.grand_vip_start_row || "A" : movie.mid_vip_start_row || "A";
  const endRow = shape.isGrand ? movie.grand_vip_end_row || "C" : movie.mid_vip_end_row || "C";
  const startCol = shape.isGrand ? movie.grand_vip_start_col || 10 : movie.mid_vip_start_col || 5;
  const endCol = shape.isGrand ? movie.grand_vip_end_col || 18 : movie.mid_vip_end_col || 10;
  shape.rows.forEach((rowChar, rowIndex) => {
    shape.cols.forEach((colNum, colIndex) => {
      const inRow =
        rowChar.charCodeAt(0) >= startRow.charCodeAt(0) &&
        rowChar.charCodeAt(0) <= endRow.charCodeAt(0);
      const inCol = colNum >= startCol && colNum <= endCol;
      if (inRow && inCol) {
        const id = getSeatId(rowIndex, colIndex, shape.isGrand);
        if (id) vips.add(id);
      }
    });
  });
  return vips;
}

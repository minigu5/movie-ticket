"use client";

import { useMemo, useState } from 'react';
import { getGridRows, getGridCols, computeSeatId } from '@/lib/seatGrid';

export type Zone = { startRow: string; endRow: string; startCol: number; endCol: number };

interface Props {
  hall: 'mid' | 'grand';
  onHallChange: (h: 'mid' | 'grand') => void;
  zone: Zone;
  onZoneChange: (z: Zone) => void;
  accent?: string; // tailwind color name, default 'amber'
}

const clampRow = (r: string | undefined) => (r && /^[A-Z]$/.test(r) ? r : 'A');
const clampCol = (c: number | undefined) => (Number.isFinite(c) && (c as number) > 0 ? (c as number) : 1);

export default function VipZonePicker({ hall, onHallChange, zone, onZoneChange, accent = 'amber' }: Props) {
  const isGrand = hall === 'grand';
  const rows = useMemo(() => getGridRows(isGrand), [isGrand]);
  const cols = useMemo(() => getGridCols(isGrand), [isGrand]);
  const [pending, setPending] = useState<{ row: string; col: number } | null>(null);

  const z = {
    startRow: clampRow(zone.startRow),
    endRow: clampRow(zone.endRow),
    startCol: clampCol(zone.startCol),
    endCol: clampCol(zone.endCol),
  };

  const inZone = (row: string, col: number) =>
    row.charCodeAt(0) >= z.startRow.charCodeAt(0) &&
    row.charCodeAt(0) <= z.endRow.charCodeAt(0) &&
    col >= z.startCol && col <= z.endCol;

  const seatCount = useMemo(() => {
    let n = 0;
    rows.forEach((rowChar, ri) => cols.forEach((colNum, ci) => {
      if (inZone(rowChar, colNum) && computeSeatId(isGrand, ri, ci)) n++;
    }));
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, cols, z.startRow, z.endRow, z.startCol, z.endCol, isGrand]);

  const handleCellClick = (row: string, col: number) => {
    if (!pending) { setPending({ row, col }); return; }
    const [sr, er] = pending.row.charCodeAt(0) <= row.charCodeAt(0)
      ? [pending.row, row] : [row, pending.row];
    onZoneChange({
      startRow: sr,
      endRow: er,
      startCol: Math.min(pending.col, col),
      endCol: Math.max(pending.col, col),
    });
    setPending(null);
  };

  const fillClass = accent === 'pink' ? 'bg-pink-500/70' : 'bg-amber-500/70';
  const ringClass = accent === 'pink' ? 'ring-pink-300' : 'ring-amber-300';

  return (
    <div className="bg-neutral-900/60 rounded-lg border border-neutral-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => onHallChange('mid')}
          className={`px-3 py-1.5 rounded text-xs font-bold ${hall === 'mid' ? 'bg-amber-600 text-white' : 'bg-neutral-700 text-neutral-300'}`}
        >
          중강당 (14×9)
        </button>
        <button
          type="button"
          onClick={() => onHallChange('grand')}
          className={`px-3 py-1.5 rounded text-xs font-bold ${hall === 'grand' ? 'bg-pink-600 text-white' : 'bg-neutral-700 text-neutral-300'}`}
        >
          대강당 (27×18)
        </button>
        <span className="text-xs text-neutral-500 ml-auto">
          {pending ? '반대쪽 모서리를 클릭하세요' : '두 모서리 셀을 클릭해 영역 지정'}
        </span>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="inline-block">
          {/* 열 번호 헤더 */}
          <div className="flex">
            <div className="w-5 shrink-0" />
            {cols.map((c) => (
              <div key={c} className="w-[22px] shrink-0 text-center text-[9px] text-neutral-500 leading-4">{c}</div>
            ))}
          </div>
          {rows.map((rowChar, ri) => (
            <div key={rowChar} className="flex">
              <div className="w-5 shrink-0 text-center text-[10px] text-neutral-500 leading-[22px]">{rowChar}</div>
              {cols.map((colNum, ci) => {
                const has = computeSeatId(isGrand, ri, ci);
                const selected = inZone(rowChar, colNum);
                const isPending = pending && pending.row === rowChar && pending.col === colNum;
                return (
                  <button
                    key={colNum}
                    type="button"
                    disabled={!has}
                    onClick={() => handleCellClick(rowChar, colNum)}
                    className={[
                      'relative w-[22px] h-[22px] shrink-0 border border-neutral-800 text-[0px]',
                      !has ? 'bg-transparent cursor-default' : selected ? fillClass : 'bg-neutral-700 hover:bg-neutral-600',
                      isPending ? `ring-2 ${ringClass} z-10` : '',
                    ].join(' ')}
                    aria-label={`${rowChar}${colNum}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3 text-sm">
        <span className="font-bold text-white">
          {z.startRow}{z.startCol} ~ {z.endRow}{z.endCol}
        </span>
        <span className="text-neutral-400">· {seatCount}석</span>
      </div>

      <details className="mt-2">
        <summary className="text-xs text-neutral-500 cursor-pointer">직접 입력 (정밀 조정)</summary>
        <div className="flex gap-2 mt-2">
          <label className="flex-1 text-xs text-neutral-400">시작 행
            <input type="text" maxLength={1} value={z.startRow}
              onChange={(e) => onZoneChange({ ...z, startRow: e.target.value.toUpperCase() || 'A' })}
              className="w-full p-1.5 bg-neutral-700 rounded border border-neutral-600 text-center text-white mt-1" />
          </label>
          <label className="flex-1 text-xs text-neutral-400">끝 행
            <input type="text" maxLength={1} value={z.endRow}
              onChange={(e) => onZoneChange({ ...z, endRow: e.target.value.toUpperCase() || 'A' })}
              className="w-full p-1.5 bg-neutral-700 rounded border border-neutral-600 text-center text-white mt-1" />
          </label>
          <label className="flex-1 text-xs text-neutral-400">시작 열
            <input type="number" value={z.startCol}
              onChange={(e) => onZoneChange({ ...z, startCol: parseInt(e.target.value) || 1 })}
              className="w-full p-1.5 bg-neutral-700 rounded border border-neutral-600 text-center text-white mt-1" />
          </label>
          <label className="flex-1 text-xs text-neutral-400">끝 열
            <input type="number" value={z.endCol}
              onChange={(e) => onZoneChange({ ...z, endCol: parseInt(e.target.value) || 1 })}
              className="w-full p-1.5 bg-neutral-700 rounded border border-neutral-600 text-center text-white mt-1" />
          </label>
        </div>
      </details>
    </div>
  );
}

"use client";

import { useMemo, useState } from 'react';
import { BarChart3, Popcorn, Banknote, Crown, Printer, CircleCheck, RefreshCw, CircleX, Hourglass } from 'lucide-react';
import { analyzePopcorn, parseSeat, STATUS_WEIGHT } from './reservationView';

type SortKey = 'seat' | 'name' | 'status' | 'printed';
type SortDir = 'asc' | 'desc';

interface PopcornStats {
  original: number; consomme: number; caramel: number; none: number; cash: number;
}

interface Props {
  reservations: any[];
  popcornStats: PopcornStats;
  onApprove: (ticket: any) => void;
  onCancel: (ticket: any) => void;
  onResetPrint: (ticket: any) => void;
}

export default function ReservationsTab({ reservations, popcornStats, onApprove, onCancel, onResetPrint }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('seat');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const counts = useMemo(() => ({
    pending: reservations.filter(r => r.payment_status === 'pending').length,
    confirmed: reservations.filter(r => r.payment_status === 'confirmed').length,
    groupPending: reservations.filter(r => r.payment_status === 'group_pending').length,
    unprinted: reservations.filter(r => r.payment_status === 'confirmed' && !r.is_printed).length,
  }), [reservations]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...reservations].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'seat') {
        const [as, an] = parseSeat(a.seat_number);
        const [bs, bn] = parseSeat(b.seat_number);
        cmp = as.localeCompare(bs) || an - bn;
      } else if (sortKey === 'name') {
        cmp = String(a.student_id ?? '').localeCompare(String(b.student_id ?? ''))
          || String(a.student_name ?? '').localeCompare(String(b.student_name ?? ''));
      } else if (sortKey === 'status') {
        cmp = (STATUS_WEIGHT[a.payment_status] ?? 9) - (STATUS_WEIGHT[b.payment_status] ?? 9);
      } else if (sortKey === 'printed') {
        cmp = (a.is_printed ? 1 : 0) - (b.is_printed ? 1 : 0);
      }
      return cmp * dir;
    });
  }, [reservations, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
  };

  const arrow = (k: SortKey) => (sortKey === k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  return (
    <div className="space-y-6">
      {/* 상단 요약 카운터 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Counter label="승인 대기" value={counts.pending} tone="amber" />
        <Counter label="확정" value={counts.confirmed} tone="green" />
        <Counter label="단체 대기" value={counts.groupPending} tone="yellow" />
        <Counter label="미발권 (확정)" value={counts.unprinted} tone="slate" />
      </div>

      {/* 팝콘 / 매출 요약 */}
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <h2 className="text-lg font-bold text-yellow-500 mb-4 flex items-center gap-1.5"><BarChart3 className="w-5 h-5" /> 팝콘 현황 요약 (확정 기준)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-yellow-900/30 p-4 rounded-lg border border-yellow-700"><span className="flex items-center gap-1.5 text-yellow-400 text-sm font-bold mb-1"><Popcorn className="w-4 h-4" /> 오리지널</span><span className="text-2xl font-black text-yellow-400">{popcornStats.original}개</span></div>
          <div className="bg-orange-900/30 p-4 rounded-lg border border-orange-700"><span className="flex items-center gap-1.5 text-orange-400 text-sm font-bold mb-1"><Popcorn className="w-4 h-4" /> 콘소메</span><span className="text-2xl font-black text-orange-400">{popcornStats.consomme}개</span></div>
          <div className="bg-amber-900/30 p-4 rounded-lg border border-amber-700"><span className="flex items-center gap-1.5 text-amber-500 text-sm font-bold mb-1"><Popcorn className="w-4 h-4" /> 카라멜</span><span className="text-2xl font-black text-amber-500">{popcornStats.caramel}개</span></div>
          <div className="bg-green-900/30 p-4 rounded-lg border border-green-700"><span className="flex items-center gap-1.5 text-green-400 text-sm font-bold mb-1"><Banknote className="w-4 h-4" /> 현금 매출</span><span className="text-xl font-black text-green-400">{popcornStats.cash.toLocaleString()}원</span></div>
        </div>
      </div>

      {/* 예매 내역 테이블 */}
      <div className="bg-gray-800 rounded-xl overflow-x-auto border border-gray-700">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-gray-700 text-gray-300 select-none">
            <tr>
              <th className="p-4 cursor-pointer hover:text-white" onClick={() => toggleSort('status')}>상태{arrow('status')}</th>
              <th className="p-4 cursor-pointer hover:text-white" onClick={() => toggleSort('seat')}>좌석{arrow('seat')}</th>
              <th className="p-4 cursor-pointer hover:text-white" onClick={() => toggleSort('name')}>학번/이름{arrow('name')}</th>
              <th className="p-4">결제/팝콘</th>
              <th className="p-4 text-center cursor-pointer hover:text-white" onClick={() => toggleSort('printed')}>발권 여부{arrow('printed')}</th>
              <th className="p-4 text-right">관리 작업</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-500">예매 내역이 없습니다.</td></tr>}
            {sorted.map((ticket) => {
              const { arr, totalPrice, summary } = analyzePopcorn(ticket.popcorn_order);
              return (
                <tr key={ticket.id} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="p-4">
                    {ticket.payment_status === 'group_pending' ? (
                      <span className="bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded border border-yellow-600 font-bold text-xs inline-flex items-center gap-1"><Hourglass className="w-3.5 h-3.5" /> 단체 대기</span>
                    ) : ticket.payment_status === 'pending' ? (
                      <span className="bg-amber-600/20 text-amber-400 px-2 py-1 rounded border border-amber-600 font-bold text-xs">승인 대기</span>
                    ) : (
                      <span className="bg-green-600/20 text-green-500 px-2 py-1 rounded border border-green-600 font-bold">확정됨</span>
                    )}
                    {ticket.is_group_leader && <span className="ml-1 inline-flex items-center text-emerald-400 text-xs font-bold"><Crown className="w-3.5 h-3.5" /></span>}
                  </td>
                  <td className="p-4 font-bold text-lg">{ticket.seat_number}</td>
                  <td className="p-4">{ticket.student_id} <span className="text-orange-300 font-bold">{ticket.student_name}</span></td>
                  <td className="p-4">
                    {arr.length > 0 ? (
                      <div className="flex flex-col">
                        <span className="text-yellow-400 font-bold text-sm tracking-widest">{totalPrice.toLocaleString()}원</span>
                        <span className="flex items-center gap-1.5 text-gray-400 text-xs mt-1"><Popcorn className="w-3.5 h-3.5" /> {summary}</span>
                      </div>
                    ) : (
                      <span className="text-gray-500 text-sm">무료 관람 (0원)</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    {ticket.is_printed ? (
                      <span className="inline-flex items-center gap-1.5 text-orange-400 font-bold border border-orange-600 bg-orange-900/30 px-3 py-1 rounded-lg text-xs tracking-wider"><Printer className="w-3.5 h-3.5" /> 발권 완료</span>
                    ) : (
                      <span className="text-gray-500 font-bold text-sm">미발권</span>
                    )}
                  </td>
                  <td className="p-4 text-right flex justify-end gap-2">
                    {ticket.payment_status === 'pending' && (
                      <button onClick={() => onApprove(ticket)} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded font-bold shadow-md transition-colors"><CircleCheck className="w-4 h-4" /> 승인</button>
                    )}
                    {ticket.is_printed && (
                      <button onClick={() => onResetPrint(ticket)} className="flex items-center gap-1.5 bg-yellow-600 hover:bg-yellow-500 text-black px-3 py-1 rounded font-bold shadow-md transition-colors"><RefreshCw className="w-4 h-4" /> 발권 초기화</button>
                    )}
                    <button onClick={() => onCancel(ticket)} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded font-bold shadow-md transition-colors"><CircleX className="w-4 h-4" /> 강제 취소</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone: 'amber' | 'green' | 'yellow' | 'slate' }) {
  const toneClass = {
    amber: 'border-amber-700 text-amber-400',
    green: 'border-green-700 text-green-400',
    yellow: 'border-yellow-700 text-yellow-400',
    slate: 'border-neutral-600 text-neutral-300',
  }[tone];
  return (
    <div className={`bg-gray-800 p-4 rounded-xl border ${toneClass}`}>
      <span className="block text-gray-400 text-xs font-bold mb-1">{label}</span>
      <span className="text-2xl font-black">{value}</span>
    </div>
  );
}

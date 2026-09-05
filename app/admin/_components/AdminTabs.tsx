"use client";

import { Ticket, Settings, Users, Archive, type LucideIcon } from 'lucide-react';

export type TabKey = 'reservations' | 'settings' | 'members' | 'history';

const TABS: { key: TabKey; label: string; Icon: LucideIcon }[] = [
  { key: 'reservations', label: '예매 관리', Icon: Ticket },
  { key: 'settings', label: '상영 설정', Icon: Settings },
  { key: 'members', label: '회원·권한', Icon: Users },
  { key: 'history', label: '이력·로그', Icon: Archive },
];

interface Props {
  active: TabKey;
  onChange: (k: TabKey) => void;
  pendingCount?: number;
}

export default function AdminTabs({ active, onChange, pendingCount = 0 }: Props) {
  return (
    <div className="flex gap-1 border-b border-gray-700 mb-6 overflow-x-auto">
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-bold whitespace-nowrap transition-colors border-b-2 -mb-px ${
            active === t.key
              ? 'border-blue-400 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <t.Icon size={16} aria-hidden="true" />
          {t.label}
          {t.key === 'reservations' && pendingCount > 0 && (
            <span className="ml-2 bg-green-600 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingCount}</span>
          )}
        </button>
      ))}
    </div>
  );
}

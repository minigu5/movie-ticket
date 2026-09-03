"use client";

import { useState } from 'react';
import VipZonePicker, { type Zone } from './VipZonePicker';

interface Props {
  movieInfo: any;
  editForm: any;
  setEditForm: (updater: any) => void;
  onSaveSettings: () => void;
  bgGenerating: boolean;
  bgStatus: string | null;
  onGenerateBg: () => void;
  onStartNewMovieClick: () => void;
  isStartingNewMovie: boolean;
  newMovieForm: any;
  setNewMovieForm: (updater: any) => void;
  onSubmitNewMovie: () => void;
  onCancelNewMovie: () => void;
}

const zoneFromForm = (form: any, hall: 'mid' | 'grand'): Zone => {
  const p = hall === 'grand' ? 'grand' : 'mid';
  return {
    startRow: form[`${p}_vip_start_row`] ?? 'A',
    endRow: form[`${p}_vip_end_row`] ?? 'C',
    startCol: form[`${p}_vip_start_col`] ?? 1,
    endCol: form[`${p}_vip_end_col`] ?? 1,
  };
};

const applyZone = (setForm: (u: any) => void, hall: 'mid' | 'grand', z: Zone) => {
  const p = hall === 'grand' ? 'grand' : 'mid';
  setForm((prev: any) => ({
    ...prev,
    [`${p}_vip_start_row`]: z.startRow,
    [`${p}_vip_end_row`]: z.endRow,
    [`${p}_vip_start_col`]: z.startCol,
    [`${p}_vip_end_col`]: z.endCol,
  }));
};

function MovieFormFields({ form, setForm }: { form: any; setForm: (u: any) => void }) {
  const set = (patch: any) => setForm((prev: any) => ({ ...prev, ...patch }));
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div><label className="block text-sm text-gray-400 mb-1">영화 제목</label><input type="text" value={form.title ?? ''} onChange={e => set({ title: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none" /></div>
      <div><label className="block text-sm text-gray-400 mb-1">상영 일시 (화면 표시용)</label><input type="text" value={form.date_string ?? ''} onChange={e => set({ date_string: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none" /></div>
      <div><label className="block text-sm text-gray-400 mb-1">DB 기준 날짜 (YYYY-MM-DD)</label><input type="text" value={form.db_date ?? ''} onChange={e => set({ db_date: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none" /></div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">상영 장소</label>
        <select value={form.venue ?? ''} onChange={e => set({ venue: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 outline-none">
          <option value="대구과학고등학교 중강당">중강당 (14x9 배열)</option>
          <option value="대구과학고등학교 대강당">대강당 (27x18 배열)</option>
        </select>
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">관람가 등급</label>
        <select value={form.age_rating ?? '전체관람가'} onChange={e => set({ age_rating: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none">
          <option value="전체관람가">전체관람가</option>
          <option value="12세이상관람가">12세 이상 관람가</option>
          <option value="15세이상관람가">15세 이상 관람가</option>
          <option value="청소년관람불가">청소년 관람불가</option>
        </select>
      </div>
      <div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-1">포스터 주소</label><input type="text" value={form.poster_url ?? ''} onChange={e => set({ poster_url: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none" /></div>
      <div className="md:col-span-2"><label className="block text-sm text-red-400 font-bold mb-1">예매 마감 일시 (ISO 형식)</label><input type="text" value={form.deadline_date ?? ''} onChange={e => set({ deadline_date: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-red-800 outline-none" /></div>
    </div>
  );
}

export default function SettingsTab(props: Props) {
  const {
    movieInfo, editForm, setEditForm, onSaveSettings, bgGenerating, bgStatus, onGenerateBg,
    onStartNewMovieClick, isStartingNewMovie, newMovieForm, setNewMovieForm, onSubmitNewMovie, onCancelNewMovie,
  } = props;
  const [editHall, setEditHall] = useState<'mid' | 'grand'>('mid');
  const [newHall, setNewHall] = useState<'mid' | 'grand'>('mid');

  return (
    <div className="space-y-8">
      {movieInfo && (
        <section className="bg-gray-800 p-6 rounded-xl border border-purple-700">
          <h2 className="text-xl font-bold text-purple-400 mb-4">⚙️ 현재 상영 설정 — {movieInfo.title}</h2>
          <MovieFormFields form={editForm} setForm={setEditForm} />

          <div className="flex items-center gap-3 mt-4">
            <button type="button" onClick={onGenerateBg} disabled={bgGenerating} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded text-sm font-bold">
              {bgGenerating ? '배경 생성 중...' : '티켓 배경 생성'}
            </button>
            {bgStatus && <span className="text-sm text-gray-400">{bgStatus}</span>}
            {editForm.background_template_url && (
              <span className="text-xs text-green-400">배경 템플릿 있음 — 포스터를 바꿨으면 다시 생성하세요.</span>
            )}
          </div>

          <div className="mt-6">
            <h3 className="text-indigo-400 font-bold border-b border-gray-700 pb-2 mb-3">🎟️ 동아리 전용(VIP) 좌석 영역</h3>
            <VipZonePicker
              hall={editHall}
              onHallChange={setEditHall}
              zone={zoneFromForm(editForm, editHall)}
              onZoneChange={(z) => applyZone(setEditForm, editHall, z)}
              accent={editHall === 'grand' ? 'pink' : 'indigo'}
            />
          </div>

          <div className="mt-6 text-right">
            <button onClick={onSaveSettings} className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg">💾 변경사항 저장</button>
          </div>
        </section>
      )}

      <section className="bg-gray-800 p-6 rounded-xl border border-orange-600">
        {!isStartingNewMovie ? (
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-orange-400">🎬 새 회차 시작</h2>
              <p className="text-gray-400 text-sm mt-1">현재 회차를 이력으로 보존하고 새 영화 예매를 시작합니다.</p>
            </div>
            <button onClick={onStartNewMovieClick} className="bg-orange-600 hover:bg-orange-500 px-4 py-2 rounded-lg font-bold">새 영화 정보 입력</button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-orange-400 mb-4">🎬 새 회차 시작 — 새 영화 정보 입력</h2>
            <MovieFormFields form={newMovieForm} setForm={setNewMovieForm} />
            <div className="mt-6">
              <h3 className="text-indigo-400 font-bold border-b border-gray-700 pb-2 mb-3">🎟️ 동아리 전용(VIP) 좌석 영역</h3>
              <VipZonePicker
                hall={newHall}
                onHallChange={setNewHall}
                zone={zoneFromForm(newMovieForm, newHall)}
                onZoneChange={(z) => applyZone(setNewMovieForm, newHall, z)}
                accent={newHall === 'grand' ? 'pink' : 'indigo'}
              />
            </div>
            <div className="mt-6 text-right flex justify-end gap-2">
              <button onClick={onCancelNewMovie} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg">취소</button>
              <button onClick={onSubmitNewMovie} className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg">🎬 새 회차 시작</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

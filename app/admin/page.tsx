// app/admin/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { USER_EMAILS } from '../../lib/emails';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [reservations, setReservations] = useState<any[]>([]);
  const[movieInfo, setMovieInfo] = useState<any>(null);
  
  // 🌟[추가됨] 설정 수정 모드 관련 상태
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const ADMIN_PASSWORD = "영화대교최고"; 

  useEffect(() => {
    if (isAuthenticated) fetchAdminData();
  }, [isAuthenticated]);

  const fetchAdminData = async () => {
    const { data: movieData } = await supabase.from('movie_settings').select('*').eq('id', 1).single();
    if (movieData) {
      setMovieInfo(movieData);
      setEditForm(movieData); // 에디터 폼 초기값 세팅
      const { data: resData } = await supabase.from('reservations').select('*').eq('movie_date', movieData.db_date).order('created_at', { ascending: false });
      if (resData) setReservations(resData);
    }
  };

  // 🌟 [추가됨] 설정 저장 함수
  const handleSaveSettings = async () => {
    if(!confirm("영화 설정을 정말 변경하시겠습니까?\n(웹사이트에 즉시 반영됩니다)")) return;
    
    const { error } = await supabase.from('movie_settings').update({
      title: editForm.title,
      date_string: editForm.date_string,
      db_date: editForm.db_date,
      venue: editForm.venue,
      poster_url: editForm.poster_url,
      deadline_date: editForm.deadline_date,
      vip_start_row: editForm.vip_start_row,
      vip_end_row: editForm.vip_end_row,
      vip_start_col: editForm.vip_start_col,
      vip_end_col: editForm.vip_end_col
    }).eq('id', 1);

    if (error) {
      alert("설정 저장 실패: " + error.message);
    } else {
      alert("✅ 설정이 성공적으로 저장되었습니다!");
      setIsEditingSettings(false);
      fetchAdminData(); // 데이터 새로고침
    }
  };

  const handleApprove = async (ticket: any) => {
    if (!confirm(`${ticket.student_name}님의 입금을 확인하고 예매를 확정하시겠습니까?`)) return;
    const { error } = await supabase.from('reservations').update({ payment_status: 'confirmed' }).eq('id', ticket.id);
    if (!error) {
      const userEmail = ticket.student_id === "교직원" ? USER_EMAILS[ticket.student_name] : USER_EMAILS[ticket.student_id];
      if (userEmail) {
        await fetch('/api/ticket', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail, name: ticket.student_name, seat: ticket.seat_number,
            movieTitle: movieInfo.title, movieDate: movieInfo.date_string,
            statusType: 'confirmed', popcorn: ticket.popcorn_order, ticketId: ticket.id, baseUrl
          })
        });
      }
      alert("승인 완료 및 확정 이메일이 발송되었습니다!");
      fetchAdminData();
    }
  };

  const handleCancel = async (ticket: any) => {
    if (!confirm(`정말 ${ticket.student_name}님의 예매를 취소/거절 하시겠습니까? (이메일이 발송됩니다)`)) return;
    const { error } = await supabase.from('reservations').delete().eq('id', ticket.id);
    if (!error) {
      const userEmail = ticket.student_id === "교직원" ? USER_EMAILS[ticket.student_name] : USER_EMAILS[ticket.student_id];
      if (userEmail) {
        await fetch('/api/ticket', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail, name: ticket.student_name, seat: ticket.seat_number,
            movieTitle: movieInfo.title, movieDate: movieInfo.date_string,
            statusType: 'canceled', popcorn: ticket.popcorn_order, ticketId: ticket.id, baseUrl
          })
        });
      }
      alert("취소 완료 및 안내 이메일이 발송되었습니다!");
      fetchAdminData();
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-sm w-full text-center border border-gray-700">
          <h1 className="text-2xl font-bold text-white mb-6">🔒 관리자 로그인</h1>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && password === ADMIN_PASSWORD && setIsAuthenticated(true)}
            className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 mb-4 text-center" placeholder="비밀번호 입력" />
          <button onClick={() => password === ADMIN_PASSWORD ? setIsAuthenticated(true) : alert('비밀번호가 틀렸습니다.')}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold">접속하기</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-blue-400">👑 영화대교 관리자 대시보드</h1>
        <button 
          onClick={() => setIsEditingSettings(!isEditingSettings)} 
          className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg font-bold transition-colors"
        >
          {isEditingSettings ? '설정 닫기' : '⚙️ 영화 설정 변경'}
        </button>
      </div>

      {/* 🌟[추가됨] 영화 설정 에디터 패널 */}
      {isEditingSettings && movieInfo && (
        <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-purple-600 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="block text-sm text-gray-400 mb-1">영화 제목</label><input type="text" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-purple-500 outline-none"/></div>
          <div><label className="block text-sm text-gray-400 mb-1">상영 일시 (화면 표시용)</label><input type="text" value={editForm.date_string} onChange={e => setEditForm({...editForm, date_string: e.target.value})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none"/></div>
          <div><label className="block text-sm text-gray-400 mb-1">DB 기준 날짜 (YYYY-MM-DD)</label><input type="text" value={editForm.db_date} onChange={e => setEditForm({...editForm, db_date: e.target.value})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none"/></div>
          <div><label className="block text-sm text-gray-400 mb-1">상영 장소</label><input type="text" value={editForm.venue} onChange={e => setEditForm({...editForm, venue: e.target.value})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none"/></div>
          <div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-1">포스터 이미지 주소 (또는 /poster.jpg)</label><input type="text" value={editForm.poster_url} onChange={e => setEditForm({...editForm, poster_url: e.target.value})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none"/></div>
          <div className="md:col-span-2"><label className="block text-sm text-red-400 font-bold mb-1">예매 마감 일시 (ISO 형식)</label><input type="text" value={editForm.deadline_date} onChange={e => setEditForm({...editForm, deadline_date: e.target.value})} className="w-full p-2 bg-gray-700 rounded border border-red-800 outline-none" placeholder="예: 2026-04-18T09:00:00+09:00"/></div>
          
          <div className="md:col-span-2 mt-4"><h3 className="text-indigo-400 font-bold border-b border-gray-700 pb-2 mb-2">동아리 전용(VIP) 좌석 범위 지정</h3></div>
          <div className="flex gap-2">
            <div className="flex-1"><label className="block text-sm text-gray-400 mb-1">시작 행 (A~I)</label><input type="text" maxLength={1} value={editForm.vip_start_row} onChange={e => setEditForm({...editForm, vip_start_row: e.target.value.toUpperCase()})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none text-center"/></div>
            <div className="flex-1"><label className="block text-sm text-gray-400 mb-1">끝 행 (A~I)</label><input type="text" maxLength={1} value={editForm.vip_end_row} onChange={e => setEditForm({...editForm, vip_end_row: e.target.value.toUpperCase()})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none text-center"/></div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1"><label className="block text-sm text-gray-400 mb-1">시작 열 (1~14)</label><input type="number" value={editForm.vip_start_col} onChange={e => setEditForm({...editForm, vip_start_col: parseInt(e.target.value)})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none text-center"/></div>
            <div className="flex-1"><label className="block text-sm text-gray-400 mb-1">끝 열 (1~14)</label><input type="number" value={editForm.vip_end_col} onChange={e => setEditForm({...editForm, vip_end_col: parseInt(e.target.value)})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none text-center"/></div>
          </div>
          
          <div className="md:col-span-2 mt-4 text-right">
            <button onClick={handleSaveSettings} className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg">💾 변경사항 저장</button>
          </div>
        </div>
      )}
      
      <div className="bg-gray-800 rounded-xl overflow-x-auto shadow-2xl border border-gray-700">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-gray-700 text-gray-300">
            <tr>
              <th className="p-4">상태</th>
              <th className="p-4">좌석</th>
              <th className="p-4">학번/이름</th>
              <th className="p-4">팝콘</th>
              <th className="p-4 text-right">관리 작업</th>
            </tr>
          </thead>
          <tbody>
            {reservations.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-500">예매 내역이 없습니다.</td></tr>}
            {reservations.map((ticket) => (
              <tr key={ticket.id} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="p-4">
                  {ticket.payment_status === 'pending' 
                    ? <span className="bg-yellow-600/20 text-yellow-500 px-2 py-1 rounded border border-yellow-600">입금 대기</span>
                    : <span className="bg-green-600/20 text-green-500 px-2 py-1 rounded border border-green-600">확정됨</span>}
                </td>
                <td className="p-4 font-bold text-lg">{ticket.seat_number}</td>
                <td className="p-4">{ticket.student_id} <span className="text-blue-300">{ticket.student_name}</span></td>
                <td className="p-4 text-xs">{ticket.popcorn_order !== 'none' ? `🍿 ${ticket.popcorn_order}` : 'X'}</td>
                <td className="p-4 text-right flex justify-end gap-2">
                  {ticket.payment_status === 'pending' && (
                    <button onClick={() => handleApprove(ticket)} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded font-bold">✅ 승인</button>
                  )}
                  <button onClick={() => handleCancel(ticket)} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded font-bold">❌ 취소</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
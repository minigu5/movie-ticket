// app/admin/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { USER_EMAILS } from '../../lib/emails';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const[reservations, setReservations] = useState<any[]>([]);
  const [movieInfo, setMovieInfo] = useState<any>(null);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  // 🌟 관리자 비밀번호 (원하시는 비밀번호로 바꾸세요!)
  const ADMIN_PASSWORD = "영화대교최고"; 

  useEffect(() => {
    if (isAuthenticated) fetchAdminData();
  }, [isAuthenticated]);

  const fetchAdminData = async () => {
    const { data: movieData } = await supabase.from('movie_settings').select('*').eq('id', 1).single();
    if (movieData) {
      setMovieInfo(movieData);
      const { data: resData } = await supabase.from('reservations').select('*').eq('movie_date', movieData.db_date).order('created_at', { ascending: false });
      if (resData) setReservations(resData);
    }
  };

  // ✅ 예매 승인 (이메일 발송 포함)
  const handleApprove = async (ticket: any) => {
    if (!confirm(`${ticket.student_name}님의 입금을 확인하고 예매를 확정하시겠습니까?`)) return;

    const { error } = await supabase.from('reservations').update({ payment_status: 'confirmed' }).eq('id', ticket.id);
    
    if (!error) {
      const userEmail = ticket.student_id === "교직원" ? USER_EMAILS[ticket.student_name] : USER_EMAILS[ticket.student_id];
      if (userEmail) {
        await fetch('/api/ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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

  // ❌ 예매 취소 (이메일 발송 포함)
  const handleCancel = async (ticket: any) => {
    if (!confirm(`정말 ${ticket.student_name}님의 예매를 취소/거절 하시겠습니까? (이메일이 발송됩니다)`)) return;

    const { error } = await supabase.from('reservations').delete().eq('id', ticket.id);
    
    if (!error) {
      const userEmail = ticket.student_id === "교직원" ? USER_EMAILS[ticket.student_name] : USER_EMAILS[ticket.student_id];
      if (userEmail) {
        await fetch('/api/ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-8 text-blue-400">👑 영화대교 관리자 대시보드</h1>
      
      <div className="bg-gray-800 rounded-xl overflow-hidden shadow-2xl border border-gray-700">
        <table className="w-full text-left text-sm">
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
            {reservations.map((ticket) => (
              <tr key={ticket.id} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="p-4">
                  {ticket.payment_status === 'pending' 
                    ? <span className="bg-yellow-600/20 text-yellow-500 px-2 py-1 rounded border border-yellow-600">입금 대기</span>
                    : <span className="bg-green-600/20 text-green-500 px-2 py-1 rounded border border-green-600">확정됨</span>}
                </td>
                <td className="p-4 font-bold text-lg">{ticket.seat_number}</td>
                <td className="p-4">{ticket.student_id} <span className="text-blue-300">{ticket.student_name}</span></td>
                <td className="p-4">{ticket.popcorn_order !== 'none' ? '🍿 O' : 'X'}</td>
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
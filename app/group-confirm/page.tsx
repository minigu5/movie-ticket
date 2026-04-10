"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { USER_EMAILS } from '@/lib/emails';

function GroupConfirmForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const groupId = searchParams.get('groupId');
  const memberId = searchParams.get('memberId');

  const [loading, setLoading] = useState(true);
  const [myReservation, setMyReservation] = useState<any>(null);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [leader, setLeader] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [showResetButton, setShowResetButton] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [isAlreadyConfirmed, setIsAlreadyConfirmed] = useState(false);

  useEffect(() => {
    if (groupId && memberId) fetchGroupData();
  }, [groupId, memberId]);

  const fetchGroupData = async () => {
    try {
      // 본인 예약 조회
      const { data: myData } = await supabase.from('reservations')
        .select('*').eq('id', memberId).single();
      
      if (!myData) { setLoading(false); return; }
      setMyReservation(myData);

      if (myData.payment_status === 'confirmed') {
        setIsAlreadyConfirmed(true);
      }

      // 만료 체크
      if (myData.group_expires_at && new Date(myData.group_expires_at) < new Date()) {
        setIsExpired(true);
      }

      // 그룹 전체 조회
      const { data: groupData } = await supabase.from('reservations')
        .select('*').eq('group_id', groupId).order('is_group_leader', { ascending: false });
      
      if (groupData) {
        const leaderData = groupData.find(r => r.is_group_leader);
        setLeader(leaderData);
        setGroupMembers(groupData.filter(r => !r.is_group_leader));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!/^\d{4}$/.test(password)) return alert("비밀번호 숫자 4자리를 입력해주세요.");

    const authKey = myReservation.student_id === "교직원" ? myReservation.student_name : myReservation.student_id;
    const { data: authData } = await supabase.from('student_auth')
      .select('password').eq('student_id', authKey).single();

    if (!authData) {
      // 처음 설정하는 비밀번호
      await supabase.from('student_auth').insert({ student_id: authKey, password });
    } else {
      if (authData.password !== password) {
        setShowResetButton(true);
        return alert("❌ 비밀번호가 일치하지 않습니다.");
      }
    }

    // 상태를 confirmed로 변경
    const { error } = await supabase.from('reservations')
      .update({ payment_status: 'confirmed', password })
      .eq('id', memberId);

    if (error) return alert("확정 중 오류가 발생했습니다.");

    await supabase.from('activity_logs').insert([{
      student_id: myReservation.student_id,
      student_name: myReservation.student_name,
      description: `단체 예매 확정 (${myReservation.seat_number})`
    }]);

    // 확정 메일 발송
    const userEmail = myReservation.student_id === "교직원" 
      ? USER_EMAILS[myReservation.student_name] 
      : USER_EMAILS[myReservation.student_id];

    if (userEmail) {
      const { data: movieSettings } = await supabase.from('movie_settings').select('*').eq('id', 1).single();
      if (movieSettings) {
        fetch('/api/ticket', {
          method: 'POST',
          body: JSON.stringify({
            email: userEmail, name: myReservation.student_name, seat: myReservation.seat_number,
            movieTitle: movieSettings.title, movieDate: movieSettings.date_string,
            statusType: 'confirmed', popcorn: 'none', ticketId: memberId,
            baseUrl: window.location.origin
          })
        });
      }
    }

    alert("✅ 예매가 확정되었습니다! 학교 이메일로 티켓이 발송되었습니다.");
    router.push('/');
  };

  const handleLeave = async () => {
    if (!confirm("정말 단체에서 나가시겠습니까?\n해당 좌석이 해제됩니다.")) return;

    await supabase.from('reservations').delete().eq('id', memberId);
    await supabase.from('activity_logs').insert([{
      student_id: myReservation.student_id,
      student_name: myReservation.student_name,
      description: `단체 예매 거절 (${myReservation.seat_number})`
    }]);

    alert("단체에서 나갔습니다. 좌석이 해제되었습니다.");
    router.push('/');
  };

  const handleRequestReset = async () => {
    setIsResetting(true);
    try {
      const res = await fetch('/api/auth/request-reset', {
        method: 'POST',
        body: JSON.stringify({
          studentId: myReservation.student_id,
          studentName: myReservation.student_name,
          baseUrl: window.location.origin,
          returnUrl: `/group-confirm?groupId=${groupId}&memberId=${memberId}`
        })
      });
      if (res.ok) {
        alert("학교 이메일로 비밀번호 재설정 링크가 발송되었습니다.");
        setShowResetButton(false);
      } else {
        alert("이메일 발송에 실패했습니다.");
      }
    } finally {
      setIsResetting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-white font-bold animate-pulse">데이터를 불러오는 중...</p></div>;
  if (!myReservation) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-white font-bold">존재하지 않거나 이미 처리된 초대입니다.</p></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex flex-col items-center select-none">
      <div className="w-full max-w-lg">
        
        <h1 className="text-3xl font-bold text-center mb-2 text-emerald-400">🎬 단체 관람 초대</h1>
        <p className="text-center text-slate-400 mb-8 text-sm">예매를 확정하여 단체에 합류하세요</p>

        {isExpired && (
          <div className="bg-rose-900/30 border border-rose-500/50 p-4 rounded-xl mb-6 text-center">
            <p className="text-rose-400 font-bold">⏰ 초대 시간이 만료되었습니다.</p>
            <p className="text-slate-400 text-sm mt-1">1시간이 경과하여 이 초대는 더 이상 유효하지 않습니다.</p>
          </div>
        )}

        {isAlreadyConfirmed && (
          <div className="bg-emerald-900/30 border border-emerald-500/50 p-4 rounded-xl mb-6 text-center">
            <p className="text-emerald-400 font-bold">✅ 이미 예매가 확정된 상태입니다.</p>
            <button onClick={() => router.push('/')} className="mt-3 text-sm text-indigo-400 underline">메인 페이지로 돌아가기</button>
          </div>
        )}

        {/* 그룹 현황 */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">📋 단체 현황</h2>
          {leader && (
            <div className="bg-emerald-900/30 border border-emerald-500/30 p-3 rounded-xl mb-3 flex items-center gap-3">
              <span className="text-emerald-400 font-bold">👑</span>
              <div>
                <p className="text-emerald-300 font-bold text-sm">{leader.student_name} <span className="text-emerald-500 text-xs">(리더)</span></p>
                <p className="text-slate-400 text-xs">좌석: {leader.seat_number} · ✅ 확정됨</p>
              </div>
            </div>
          )}
          {groupMembers.map((m) => (
            <div key={m.id} className={`p-3 rounded-xl mb-2 flex items-center gap-3 ${m.id === memberId ? 'bg-sky-900/30 border border-sky-500/30' : 'bg-slate-800/50 border border-slate-700'}`}>
              <span className={`font-bold text-sm ${m.id === memberId ? 'text-sky-400' : 'text-slate-500'}`}>
                {m.payment_status === 'confirmed' ? '✅' : '⏳'}
              </span>
              <div>
                <p className={`font-bold text-sm ${m.id === memberId ? 'text-sky-300' : 'text-slate-300'}`}>
                  {m.student_name} {m.id === memberId && <span className="text-sky-500 text-xs">(나)</span>}
                </p>
                <p className="text-slate-400 text-xs">
                  좌석: {m.seat_number} · {m.payment_status === 'confirmed' ? '확정됨' : '대기 중'}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* 본인 정보 */}
        {!isExpired && !isAlreadyConfirmed && (
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 mb-6">
            <h2 className="text-lg font-bold text-white mb-4">🎫 내 예매 정보</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-800 p-3 rounded-lg">
                <p className="text-slate-500 text-xs mb-1">학번</p>
                <p className="text-white font-bold">{myReservation.student_id}</p>
              </div>
              <div className="bg-slate-800 p-3 rounded-lg">
                <p className="text-slate-500 text-xs mb-1">이름</p>
                <p className="text-white font-bold">{myReservation.student_name}</p>
              </div>
              <div className="bg-slate-800 p-3 rounded-lg col-span-2">
                <p className="text-slate-500 text-xs mb-1">좌석</p>
                <p className="text-emerald-400 font-black text-2xl">{myReservation.seat_number}</p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-slate-300 mb-2 text-sm font-bold">비밀번호 (숫자 4자리)</label>
              <input
                type="password" maxLength={4} placeholder="비밀번호 4자리"
                value={password} onChange={(e) => setPassword(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full p-3 rounded-lg bg-slate-800 text-white border border-slate-600 text-center text-xl tracking-widest outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              <p className="text-slate-500 text-xs mt-2">처음 사용하시면 새 비밀번호가 설정됩니다.</p>
              {showResetButton && (
                <button onClick={handleRequestReset} disabled={isResetting} className="mt-3 text-sm text-amber-400 hover:text-amber-300 underline underline-offset-4 font-bold block w-full text-left">
                  {isResetting ? "메일 발송 중..." : "🚨 비밀번호를 재설정하시겠습니까?"}
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={handleLeave} className="flex-1 py-3 bg-rose-600/80 hover:bg-rose-500 border border-rose-500 rounded-lg text-white font-bold transition-all text-sm">
                단체에서 나가기
              </button>
              <button onClick={handleConfirm} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 rounded-lg text-white font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] text-sm">
                예매 확정하기
              </button>
            </div>
          </div>
        )}

        <button onClick={() => router.push('/')} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all border border-slate-600 text-sm">
          🏠 메인 페이지로 돌아가기
        </button>
      </div>
    </div>
  );
}

export default function GroupConfirmPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-white font-bold">로딩 중...</p></div>}>
      <GroupConfirmForm />
    </Suspense>
  );
}

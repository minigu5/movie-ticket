"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { USER_EMAILS } from '@/lib/emails';

function CancelForm() {
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('ticketId');
  const router = useRouter();

  const [ticket, setTicket] = useState<any>(null);
  const[password, setPassword] = useState('');
  const [showResetButton, setShowResetButton] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ticketId) {
      supabase.from('reservations').select('*').eq('id', ticketId).single().then(({ data }) => {
        setTicket(data);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [ticketId]);

  const handleCancel = async () => {
    if (!/^\d{4}$/.test(password)) return alert("비밀번호 숫자 4자리를 입력해주세요.");

    // 1. student_auth 테이블에서 영구 비밀번호 확인
    const { data: authData } = await supabase
      .from('student_auth')
      .select('password')
      .eq('student_id', ticket.student_id)
      .single();

    if (!authData || authData.password !== password) {
      setShowResetButton(true);
      return alert("❌ 비밀번호가 일치하지 않습니다.");
    }

    // 2. 비밀번호가 맞으면 취소 진행 여부 확인
    if (!confirm(`정말 [${ticket.seat_number}] 좌석 예매를 취소하시겠습니까?`)) return;

    // 3. 예매 내역 삭제
    await supabase.from('reservations').delete().eq('id', ticketId);

    // 4. 취소 안내 메일 발송
    const userEmail = ticket.student_id === "교직원" ? USER_EMAILS[ticket.student_name] : USER_EMAILS[ticket.student_id];
    if (userEmail) {
      const { data: movieSettings } = await supabase.from('movie_settings').select('*').eq('id', 1).single();
      await fetch('/api/ticket', {
        method: 'POST',
        body: JSON.stringify({
          email: userEmail, name: ticket.student_name, seat: ticket.seat_number,
          movieTitle: movieSettings.title, movieDate: movieSettings.date_string,
          statusType: 'canceled', popcorn: ticket.popcorn_order, ticketId: ticket.id,
          baseUrl: window.location.origin
        })
      });
    }

    alert("✅ 예매가 정상적으로 취소되었습니다.");
    router.push('/');
  };

  const handleRequestReset = async () => {
    setIsResetting(true);
    try {
      const res = await fetch('/api/auth/request-reset', {
        method: 'POST',
        body: JSON.stringify({
          studentId: ticket.student_id,
          studentName: ticket.student_name,
          baseUrl: window.location.origin,
          returnUrl: `/cancel?ticketId=${ticketId}`
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

  if (loading) return <div className="text-white text-center mt-20 font-bold">데이터를 불러오는 중...</div>;
  if (!ticket) return <div className="text-white text-center mt-20 font-bold">존재하지 않거나 이미 취소된 예매 내역입니다.</div>;

  // 🌟 팝콘 구매 여부 확인
  const hasPopcorn = ticket.popcorn_order !== 'none';

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-xl max-w-sm w-full text-center border border-gray-700 shadow-2xl">
        <h1 className="text-2xl font-bold text-red-500 mb-2">예매 취소 및 보호</h1>
        <p className="text-gray-300 text-sm mb-6 bg-gray-700 p-3 rounded-lg">
          좌석: <span className="font-bold text-white">{ticket.seat_number}</span><br/>
          예매자: <span className="font-bold text-white">{ticket.student_id} {ticket.student_name}</span>
        </p>
        
        {/* 🌟 팝콘을 구매한 경우 취소 입력창 대신 경고문 표시 */}
        {hasPopcorn ? (
          <div className="mb-6 bg-red-900/40 border border-red-800 p-4 rounded-xl">
            <p className="text-red-400 font-bold mb-2">🚫 취소 불가 안내</p>
            <p className="text-sm text-gray-300 mb-4">
              팝콘이 포함된 예매 내역은 직접 취소할 수 없습니다. (다른 자리로의 이동만 가능합니다.)<br/>
              부득이한 경우 동아리 관리자에게 문의해 주세요.
            </p>
            <button 
              onClick={() => router.push('/')} 
              className="w-full py-3 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-bold transition-colors"
            >
              메인 화면으로 돌아가기
            </button>
          </div>
        ) : (
          /* 팝콘을 안 산 경우 정상적으로 취소 가능 */
          <>
            <input
              type="password" maxLength={4} placeholder="비밀번호 4자리"
              value={password} onChange={(e) => setPassword(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 mb-4 text-center text-xl tracking-widest outline-none focus:border-red-500"
            />
            
            <button onClick={handleCancel} className="w-full py-3 bg-red-600 hover:bg-red-500 rounded-lg text-white font-bold transition-colors mb-4 shadow-lg">
              예매 취소하기
            </button>

            {showResetButton && (
              <button onClick={handleRequestReset} disabled={isResetting} className="text-sm text-yellow-400 hover:text-yellow-300 underline underline-offset-4 transition-colors font-bold block w-full">
                {isResetting ? "메일 발송 중..." : "🚨 비밀번호를 모르시나요? (이메일로 재설정)"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function CancelPage() {
  return (
    <Suspense fallback={<div className="text-white text-center mt-20">로딩 중...</div>}>
      <CancelForm />
    </Suspense>
  );
}
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
  const [password, setPassword] = useState('');
  const[showResetButton, setShowResetButton] = useState(false);
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

    // 🌟 [수정됨] 교직원은 이름으로 비밀번호를 찾도록 수정
    const authKey = ticket.student_id === "교직원" ? ticket.student_name : ticket.student_id;

    // 1. student_auth 테이블에서 영구 비밀번호 확인
    const { data: authData } = await supabase
      .from('student_auth')
      .select('password')
      .eq('student_id', authKey)
      .single();

    if (!authData || authData.password !== password) {
      setShowResetButton(true);
      return alert("❌ 비밀번호가 일치하지 않습니다.");
    }


    // 2. 비밀번호가 맞으면 취소 진행 여부 확인
    if (!confirm(`정말[${ticket.seat_number}] 좌석 예매를 취소하시겠습니까?`)) return;

    // 3. 예매 내역 삭제
    await supabase.from('reservations').delete().eq('id', ticketId);

    // 🌟 4. 로그 중복 방지: 여기에만 '본인 예매 취소' 기록을 남깁니다.
    await supabase.from('activity_logs').insert([{ 
      student_id: ticket.student_id, student_name: ticket.student_name, 
      description: `본인 예매 취소 (${ticket.seat_number})` 
    }]);

    // 5. 취소 안내 메일 발송
    const userEmail = ticket.student_id === "교직원" ? USER_EMAILS[ticket.student_name] : USER_EMAILS[ticket.student_id];
    if (userEmail) {
      const { data: movieSettings } = await supabase.from('movie_settings').select('*').eq('id', 1).single();
      
      // 🌟 환불이 필요한 상황인지 체크 (팝콘을 시켰고 & 이미 결제 확정된 경우)
      const isRefundNeeded = ticket.popcorn_order !== 'none' && ticket.payment_status === 'confirmed';
      
      await fetch('/api/ticket', {
        method: 'POST',
        body: JSON.stringify({
          email: userEmail, name: ticket.student_name, seat: ticket.seat_number,
          movieTitle: movieSettings.title, movieDate: movieSettings.date_string,
          statusType: 'canceled', popcorn: ticket.popcorn_order, ticketId: ticket.id,
          baseUrl: window.location.origin, isRefundNeeded
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

  // 🌟 [핵심 변경] 팝콘을 샀더라도, 아직 'pending(결제 대기)' 상태면 취소 가능하도록 로직 변경!
  const isPaidPopcorn = ticket.popcorn_order !== 'none' && ticket.payment_status === 'confirmed';

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-xl max-w-sm w-full text-center border border-gray-700 shadow-2xl">
        <h1 className="text-2xl font-bold text-red-500 mb-2">예매 취소</h1>
        <p className="text-gray-300 text-sm mb-6 bg-gray-700 p-3 rounded-lg">
          좌석: <span className="font-bold text-white">{ticket.seat_number}</span><br/>
          일시: <span className="font-bold text-white">{ticket.movie_date} (시험 다음날 토요일 2차 자습)</span><br/>
          예매자: <span className="font-bold text-white">{ticket.student_id} {ticket.student_name}</span>
        </p>
        
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
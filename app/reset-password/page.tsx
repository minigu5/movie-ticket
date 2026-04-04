"use client";

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const studentId = searchParams.get('id');

  const[newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleReset = async () => {
    if (!/^\d{4}$/.test(newPassword)) return alert("비밀번호는 숫자 4자리여야 합니다.");
    setStatus('loading');

    // 1. 토큰 및 유효시간 검증
    const { data: authData, error: fetchError } = await supabase
      .from('student_auth')
      .select('*')
      .eq('student_id', studentId)
      .eq('reset_token', token)
      .single();

    if (fetchError || !authData) {
      setStatus('error');
      return alert("유효하지 않거나 만료된 링크입니다.");
    }

    if (new Date(authData.token_expires_at) < new Date()) {
      setStatus('error');
      return alert("토큰 유효시간(30분)이 만료되었습니다. 다시 요청해주세요.");
    }

    // 2. 비밀번호 업데이트 및 토큰 초기화
    const { error: updateError } = await supabase
      .from('student_auth')
      .update({ password: newPassword, reset_token: null, token_expires_at: null })
      .eq('student_id', studentId);

    if (updateError) {
      setStatus('error');
      return alert("변경 중 오류가 발생했습니다.");
    }

    await supabase.from('activity_logs').insert([{ 
      student_id: studentId || '알수없음', student_name: '-', 
      description: `비밀번호 재설정 완료` 
    }]);

    setStatus('success');
    
    // 🌟 url에 돌아갈 주소(returnUrl)가 있다면 취소 진행 여부를 묻기
    const returnUrl = searchParams.get('returnUrl');
    
    if (returnUrl) {
      const doCancel = confirm("✅ 비밀번호가 성공적으로 변경되었습니다!\n\n이어서 곧바로 해당 좌석의 예매를 취소하시겠습니까?");
      if (doCancel) {
        router.push(returnUrl); // 취소 페이지로 다시 이동
      } else {
        router.push('/'); // 취소 안하면 메인 홈으로 이동
      }
    } else {
      alert("✅ 비밀번호가 성공적으로 변경되었습니다! 다시 예매를 진행해주세요.");
      router.push('/');
    }
  }; // <-- 🚨 아까는 이 부분까지만 있고, 아래 코드가 없어서 에러가 났습니다!

  // 👇 화면에 보여지는 UI (JSX) 부분
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-xl max-w-sm w-full text-center border border-gray-700 shadow-2xl">
        <h1 className="text-2xl font-bold text-white mb-6">🔒 비밀번호 재설정</h1>
        <p className="text-gray-400 text-sm mb-4">학번: {studentId}</p>
        <input 
          type="password" maxLength={4} placeholder="새로운 숫자 4자리"
          value={newPassword} onChange={(e) => setNewPassword(e.target.value.replace(/[^0-9]/g, ''))}
          className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 mb-6 text-center text-xl tracking-widest outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
        />
        <button 
          onClick={handleReset} disabled={status === 'loading'}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold transition-colors"
        >
          {status === 'loading' ? '변경 중...' : '비밀번호 변경하기'}
        </button>
      </div>
    </div>
  );
}

// 🌟 Suspense(로딩 처리)로 전체 페이지를 감싸주는 부분
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-white text-center mt-20 font-bold">로딩 중...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
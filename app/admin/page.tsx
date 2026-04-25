"use client";

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { USER_EMAILS } from '../../lib/emails';
import Link from 'next/link';

import { STUDENT_LIST, CLUB_MEMBERS } from '../../lib/constants';

const POPCORN_NAMES: Record<string, string> = { "original": "오리지널", "consomme": "콘소메", "caramel": "카라멜" };

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [reservations, setReservations] = useState<any[]>([]);
  const [movieInfo, setMovieInfo] = useState<any>(null);
  const [isLoadingUI, setIsLoadingUI] = useState(true); // 🌟 [추가됨] 로딩 상태 관리

  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [showVenueWarning, setShowVenueWarning] = useState(false);

  const [logs, setLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const [promoTargets, setPromoTargets] = useState({ grade1: false, grade2: false, grade3: false, staff: false, club: true });
  const [singleTarget, setSingleTarget] = useState("");
  const [isSendingPromo, setIsSendingPromo] = useState(false);
  const [promoProgress, setPromoProgress] = useState({ current: 0, total: 0 });
  const [showPromoWarning, setShowPromoWarning] = useState(false);
  const [pendingPromoRecipients, setPendingPromoRecipients] = useState<any[]>([]);

  const [blacklist, setBlacklist] = useState<any[]>([]);
  const [newBlackId, setNewBlackId] = useState('');

  const [baseUrl, setBaseUrl] = useState('');
  useEffect(() => setBaseUrl(window.location.origin), []);
  const [skipAuth, setSkipAuth] = useState(false);

  // 🌟 (신규) 팝콘 통계 계산을 위한 함수
  const popcornStats = useMemo(() => {
    let original = 0; let consomme = 0; let caramel = 0; let none = 0; let cash = 0;
    reservations.filter(r => r.payment_status === 'confirmed').forEach(r => {
      if (!r.popcorn_order || r.popcorn_order === 'none') { none++; return; }
      r.popcorn_order.split(',').forEach((p: string) => {
        if (p === 'original') original++;
        else if (p === 'consomme') consomme++;
        else if (p === 'caramel') caramel++;
        cash += 2500;
      });
    });
    return { original, consomme, caramel, none, cash };
  }, [reservations]);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('skip_auth') === 'true') {
      const savedPass = localStorage.getItem('admin_token');
      if (savedPass) {
        setPassword(savedPass);
        setSkipAuth(true);
        setIsAuthenticated(true);
      } else {
        localStorage.setItem('skip_auth', 'false');
      }
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchAdminData();
  }, [isAuthenticated, password]);

  const toggleSkipAuth = async () => {
    let currentPass = password;
    if (!skipAuth) {
      const pass = prompt("자동 로그인을 켜기 위해 관리자 비밀번호를 입력해주세요:");
      const res = await fetch('/api/admin/action', {
        method: 'POST',
        body: JSON.stringify({ action: 'LOGIN', adminPassword: pass })
      });
      const data = await res.json();
      if (!data.success) {
        alert("비밀번호가 틀렸습니다. 설정을 변경할 수 없습니다.");
        return;
      }
      currentPass = pass || '';
    }

    const newVal = !skipAuth;
    if (typeof window !== 'undefined') {
      if (newVal) {
        localStorage.setItem('skip_auth', 'true');
        localStorage.setItem('admin_token', currentPass);
      } else {
        localStorage.setItem('skip_auth', 'false');
        localStorage.removeItem('admin_token');
      }
    }
    setSkipAuth(newVal);
    alert(newVal ? "현재 브라우저에서 관리자/발권기 접속 시 비밀번호가 생략됩니다! (베타용)" : "비밀번호 생략이 해제되었습니다.");
  };

  const fetchAdminData = async () => {
    setIsLoadingUI(true);
    try {
      const res = await fetch('/api/admin/action', {
        method: 'POST',
        body: JSON.stringify({ action: 'FETCH_INITIAL_DATA', adminPassword: password })
      });
      const { data, success, error } = await res.json();

      if (!success) {
        if (res.status === 401) setIsAuthenticated(false);
        alert(`데이터 불러오기 실패: ${error}`);
        return console.error("데이터 로드 실패:", error);
      }

      const { movieData, resData, blData, logData } = data;
      if (movieData) {
        setMovieInfo(movieData);
        setEditForm({
          ...movieData,
          age_rating: movieData.age_rating || '전체관람가',
          mid_vip_start_row: movieData.mid_vip_start_row || 'A',
          mid_vip_end_row: movieData.mid_vip_end_row || 'C',
          mid_vip_start_col: movieData.mid_vip_start_col || 5,
          mid_vip_end_col: movieData.mid_vip_end_col || 10,
          grand_vip_start_row: movieData.grand_vip_start_row || 'A',
          grand_vip_end_row: movieData.grand_vip_end_row || 'C',
          grand_vip_start_col: movieData.grand_vip_start_col || 10,
          grand_vip_end_col: movieData.grand_vip_end_col || 18,
        });
      }
      if (resData) setReservations(resData);
      if (blData) setBlacklist(blData);
      if (logData) setLogs(logData);
    } catch (err) {
      console.error("데이터 불러오기 오류:", err);
    } finally {
      setIsLoadingUI(false);
    }
  };

  const handleSaveSettingsClick = () => {
    if (editForm.venue !== movieInfo.venue) {
      setShowVenueWarning(true);
    } else {
      proceedSave(false);
    }
  };

  const proceedSave = async (isVenueChanged: boolean) => {
    const payload = {
      title: editForm.title, date_string: editForm.date_string, db_date: editForm.db_date,
      venue: editForm.venue, poster_url: editForm.poster_url, deadline_date: editForm.deadline_date, age_rating: editForm.age_rating,
      mid_vip_start_row: editForm.mid_vip_start_row, mid_vip_end_row: editForm.mid_vip_end_row,
      mid_vip_start_col: editForm.mid_vip_start_col, mid_vip_end_col: editForm.mid_vip_end_col,
      grand_vip_start_row: editForm.grand_vip_start_row, grand_vip_end_row: editForm.grand_vip_end_row,
      grand_vip_start_col: editForm.grand_vip_start_col, grand_vip_end_col: editForm.grand_vip_end_col
    };

    const res = await fetch('/api/admin/action', {
      method: 'POST',
      body: JSON.stringify({ action: 'UPDATE_SETTINGS', adminPassword: password, payload })
    });

    const data = await res.json();
    if (!data.success) {
      alert("설정 저장 실패: " + data.error);
    } else {
      if (isVenueChanged) {
        await fetch('/api/admin/action', {
          method: 'POST',
          body: JSON.stringify({ action: 'CLEAR_RESERVATIONS', adminPassword: password, payload: { movieDate: movieInfo.db_date } })
        });
        alert("🚨 상영관 변경 및 예매 내역 초기화가 완료되었습니다.");
      } else {
        alert("✅ 설정이 성공적으로 저장되었습니다!");
      }
      setShowVenueWarning(false); setIsEditingSettings(false); fetchAdminData();
    }
  };

  const handleApprove = async (ticket: any) => {
    const popcorns = ticket.popcorn_order !== 'none' ? ticket.popcorn_order.split(',') : [];
    const totalPrice = popcorns.length * 2500;

    if (!confirm(`${ticket.student_name}님의 예매를 확정하시겠습니까?\n(입금 확인 금액: ${totalPrice.toLocaleString()}원)`)) return;

    const res = await fetch('/api/admin/action', {
      method: 'POST',
      body: JSON.stringify({
        action: 'APPROVE_RESERVATION',
        adminPassword: password,
        payload: { id: ticket.id, studentId: ticket.student_id, studentName: ticket.student_name, seatNumber: ticket.seat_number }
      })
    });

    const data = await res.json();
    if (!data.success) return alert("승인 실패: " + data.error);

    const userEmail = ticket.student_id === "교직원" ? USER_EMAILS[ticket.student_name] : USER_EMAILS[ticket.student_id];
    if (userEmail) {
      await fetch('/api/ticket', { method: 'POST', body: JSON.stringify({ email: userEmail, name: ticket.student_name, seat: ticket.seat_number, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, statusType: 'confirmed', popcorn: ticket.popcorn_order, ticketId: ticket.id, baseUrl }) });
    }
    alert("승인 완료 및 이메일 발송됨!"); fetchAdminData();
  };

  const handleCancel = async (ticket: any) => {
    if (!confirm(`정말 ${ticket.student_name}님의 예매를 취소하시겠습니까?`)) return;

    const res = await fetch('/api/admin/action', {
      method: 'POST',
      body: JSON.stringify({
        action: 'CANCEL_RESERVATION',
        adminPassword: password,
        payload: { id: ticket.id, studentId: ticket.student_id, studentName: ticket.student_name, seatNumber: ticket.seat_number }
      })
    });

    const data = await res.json();
    if (!data.success) return alert("취소 실패: " + data.error);

    const userEmail = ticket.student_id === "교직원" ? USER_EMAILS[ticket.student_name] : USER_EMAILS[ticket.student_id];
    if (userEmail) {
      const isRefundNeeded = ticket.popcorn_order !== 'none' && ticket.payment_status === 'confirmed';
      await fetch('/api/ticket', {
        method: 'POST',
        body: JSON.stringify({ email: userEmail, name: ticket.student_name, seat: ticket.seat_number, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, statusType: 'canceled', popcorn: ticket.popcorn_order, ticketId: ticket.id, baseUrl, isRefundNeeded })
      });
    }
    alert("취소 완료 및 이메일 발송됨!"); fetchAdminData();
  };

  const handleResetPrint = async (ticket: any) => {
    if (!confirm(`${ticket.student_name}님의 티켓 발권 상태를 '미발권'으로 초기화하시겠습니까?\n(학생이 현장 키오스크에서 다시 티켓을 출력할 수 있게 됩니다.)`)) return;

    const res = await fetch('/api/admin/action', {
      method: 'POST',
      body: JSON.stringify({
        action: 'RESET_PRINT',
        adminPassword: password,
        payload: { id: ticket.id, studentId: ticket.student_id, studentName: ticket.student_name, seatNumber: ticket.seat_number }
      })
    });

    const data = await res.json();
    if (!data.success) {
      alert("초기화 실패: " + data.error);
      return;
    }

    alert("✅ 발권 상태가 초기화되었습니다.");
    fetchAdminData();
  };

  const handleAddBlacklist = async () => {
    if (newBlackId.length !== 4) return alert("학번 4자리를 정확히 입력해주세요.");
    const studentName = STUDENT_LIST[newBlackId];
    if (!studentName) return alert("존재하지 않는 학번입니다.");

    if (!confirm(`${studentName}(${newBlackId}) 학생을 블랙리스트에 추가하시겠습니까?\n(⚠️ 주의: 현재 진행 중이거나 완료된 예매 내역이 있다면 자동으로 취소됩니다.)`)) return;

    const res = await fetch('/api/admin/action', {
      method: 'POST',
      body: JSON.stringify({ action: 'ADD_BLACKLIST', adminPassword: password, payload: { studentId: newBlackId, studentName, movieDate: movieInfo.db_date } })
    });
    const data = await res.json();
    if (!data.success) return alert("추가 실패 (이미 등록된 학생일 수 있습니다.)");

    const userEmail = USER_EMAILS[newBlackId];
    if (data.canceledTicket && userEmail) {
      const ticket = data.canceledTicket;
      const isRefundNeeded = ticket.popcorn_order !== 'none' && ticket.payment_status === 'confirmed';
      await fetch('/api/ticket', {
        method: 'POST',
        body: JSON.stringify({ email: userEmail, name: studentName, seat: ticket.seat_number, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, statusType: 'canceled', popcorn: ticket.popcorn_order, ticketId: ticket.id, baseUrl, isRefundNeeded })
      });
    }

    if (userEmail) {
      await fetch('/api/blacklist', { method: 'POST', body: JSON.stringify({ email: userEmail, name: studentName, action: 'added' }) });
    }

    alert("블랙리스트 추가 및 예매 자동 취소 처리가 완료되었습니다!"); setNewBlackId(''); fetchAdminData();
  };

  const handleRemoveBlacklist = async (studentId: string, studentName: string) => {
    if (!confirm(`${studentName}(${studentId}) 학생의 블랙리스트를 해제하시겠습니까?`)) return;
    await fetch('/api/admin/action', {
      method: 'POST',
      body: JSON.stringify({ action: 'REMOVE_BLACKLIST', adminPassword: password, payload: { studentId } })
    });
    const userEmail = USER_EMAILS[studentId];
    if (userEmail) await fetch('/api/blacklist', { method: 'POST', body: JSON.stringify({ email: userEmail, name: studentName, action: 'removed' }) });
    alert("해제 완료 및 안내 메일 발송!"); fetchAdminData();
  };

  const handleSendPromoClick = () => {
    const recipientMap = new Map();
    if (promoTargets.club) {
      CLUB_MEMBERS.forEach(id => {
        if (USER_EMAILS[id]) recipientMap.set(id, { studentId: id, email: USER_EMAILS[id], name: STUDENT_LIST[id] || "학생" });
      });
    }
    if (singleTarget && USER_EMAILS[singleTarget]) {
      const name = isNaN(Number(singleTarget)) ? singleTarget : STUDENT_LIST[singleTarget] || "학생";
      recipientMap.set(singleTarget, { studentId: singleTarget, email: USER_EMAILS[singleTarget], name });
    }
    Object.keys(USER_EMAILS).forEach(key => {
      let shouldAdd = false;
      if (promoTargets.grade1 && key.startsWith('1') && key.length === 4) shouldAdd = true;
      if (promoTargets.grade2 && key.startsWith('2') && key.length === 4) shouldAdd = true;
      if (promoTargets.grade3 && key.startsWith('3') && key.length === 4) shouldAdd = true;
      if (promoTargets.staff && isNaN(Number(key))) shouldAdd = true;
      if (shouldAdd) recipientMap.set(key, { studentId: key, email: USER_EMAILS[key], name: isNaN(Number(key)) ? key : STUDENT_LIST[key] || "학생" });
    });

    const recipients = Array.from(recipientMap.values());
    if (recipients.length === 0) return alert("선택된 발송 대상이 없습니다.");

    setPendingPromoRecipients(recipients);
    setShowPromoWarning(true);
  };

  const executeSendPromo = async () => {
    setShowPromoWarning(false); setIsSendingPromo(true);
    const recipients = pendingPromoRecipients;
    setPromoProgress({ current: 0, total: recipients.length });

    const CHUNK_SIZE = 15;
    for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
      const chunk = recipients.slice(i, i + CHUNK_SIZE);
      try { await fetch('/api/promo', { method: 'POST', body: JSON.stringify({ chunk, movieInfo, baseUrl }) }); } catch (err) { console.error(err); }
      setPromoProgress({ current: Math.min(i + CHUNK_SIZE, recipients.length), total: recipients.length });
      await new Promise(res => setTimeout(res, 1000));
    }

    await fetch('/api/admin/action', {
      method: 'POST',
      body: JSON.stringify({
        action: 'LOG_ACTION',
        adminPassword: password,
        payload: { studentId: "관리자", studentName: "-", description: `홍보 이메일 발송 완료 (${recipients.length}명)` }
      })
    });

    setIsSendingPromo(false); alert("✅ 홍보 메일 발송 완료!"); fetchAdminData();
  };

  const handleAdminLogin = async () => {
    const res = await fetch('/api/admin/action', {
      method: 'POST',
      body: JSON.stringify({ action: 'LOGIN', adminPassword: password })
    });
    const data = await res.json();
    if (data.success) {
      setIsAuthenticated(true);
    } else {
      alert('비밀번호가 틀렸습니다.');
    }
  };

  if (!isAuthenticated) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-xl max-w-sm w-full text-center border border-gray-700 shadow-2xl">
        <h1 className="text-2xl font-bold text-white mb-6">🔒 관리자 로그인</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
          className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 mb-4 text-center outline-none focus:border-blue-500"
          placeholder="비밀번호 입력"
        />
        <button
          onClick={handleAdminLogin}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold transition-colors"
        >
          접속하기
        </button>

      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 relative">
      <div className="w-full flex flex-wrap justify-end gap-3 mb-6 z-20">
        {isAuthenticated && (
          <button onClick={toggleSkipAuth} className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-colors shadow-lg border ${skipAuth ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/50 text-amber-400' : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-400'}`}>
            {skipAuth ? "🔓 자동 로그인 (ON)" : "🔒 자동 로그인 (OFF)"}
          </button>
        )}
        <Link href="/" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-xs md:text-sm text-gray-300 font-bold transition-colors shadow-lg">🏠 메인 홈</Link>
        <Link href="/print" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-xs md:text-sm text-gray-300 font-bold transition-colors shadow-lg">🖨️ 현장 발권기</Link>
      </div>

      {showVenueWarning && (
        <div className="fixed inset-0 bg-red-900/90 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-red-950 p-8 rounded-2xl max-w-lg border-4 border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.5)] text-center">
            <h2 className="text-4xl font-black text-white mb-4 animate-pulse">🚨 절대 주의 🚨</h2>
            <div className="text-red-200 text-lg font-bold space-y-4 mb-8">
              <p>현재 <span className="text-white text-xl">[{movieInfo.venue}]</span> 에서 <span className="text-white text-xl">[{editForm.venue}]</span> (으)로 상영관을 변경하려고 합니다.</p>
              <p className="bg-red-900 p-4 rounded-xl text-white">상영관이 변경되면 현재까지 예약된<br /><span className="text-3xl text-yellow-300">모든 예매 내역이 즉시 영구 삭제</span>됩니다.<br /><span className="text-sm font-normal text-red-300">(학생들에게 취소 메일은 발송되지 않습니다)</span></p>
              <p>정말 모든 데이터를 초기화하고 상영관을 변경하시겠습니까?</p>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setShowVenueWarning(false)} className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 rounded-xl text-white font-bold text-lg">돌아가기 (취소)</button>
              <button onClick={() => proceedSave(true)} className="flex-1 py-4 bg-red-600 hover:bg-red-500 rounded-xl text-white font-bold text-lg shadow-[0_0_15px_rgba(239,68,68,0.8)]">초기화 및 변경</button>
            </div>
          </div>
        </div>
      )}

      {showPromoWarning && (
        <div className="fixed inset-0 bg-blue-900/90 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-gray-900 p-8 rounded-2xl max-w-lg w-full border-4 border-blue-500 shadow-[0_0_50px_rgba(59,130,246,0.5)] text-center">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4 animate-pulse">📧 대량 메일 발송 확인</h2>
            <div className="text-blue-200 text-base md:text-lg font-bold space-y-4 mb-8">
              <p>현재 선택된 그룹을 바탕으로 명단을 추출했습니다.</p>
              <div className="bg-blue-950 p-6 rounded-xl text-white border border-blue-800 shadow-inner">
                <p className="text-sm text-blue-300 mb-2">발송 예정 총 인원</p>
                <p className="text-6xl text-yellow-400 font-black drop-shadow-md">
                  {pendingPromoRecipients.length}<span className="text-2xl text-white ml-2 font-bold">명</span>
                </p>
              </div>
              <p className="text-sm text-gray-400 font-normal leading-relaxed">
                (발송 중에는 창을 닫거나 새로고침하지 말고,<br />로딩 게이지가 다 찰 때까지 잠시만 기다려 주세요.)
              </p>
              <p className="text-white">위 인원에게 홍보 메일을 발송하시겠습니까?</p>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setShowPromoWarning(false)} className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 rounded-xl text-white font-bold text-lg transition-colors">돌아가기</button>
              <button onClick={executeSendPromo} className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-bold text-lg shadow-[0_0_15px_rgba(59,130,246,0.8)] transition-colors">발송 시작 🚀</button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 [추가됨] 전체 화면 로딩 스피너 (UX 개선) */}
      {isLoadingUI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="flex flex-col items-center bg-gray-900/80 p-8 rounded-2xl shadow-2xl border border-gray-700 w-80">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mb-6 shadow-[0_0_15px_rgba(59,130,246,0.6)]"></div>
            <p className="text-white font-bold text-xl tracking-wider mb-2">서버 동기화 중...</p>
            <p className="text-gray-400 text-sm">최신 데이터를 로드 중입니다.</p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-blue-400">👑 영화대교 관리자 대시보드</h1>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          <button onClick={() => setShowLogs(!showLogs)} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-bold transition-colors whitespace-nowrap">
            {showLogs ? '📜 로그 닫기' : '📜 활동 로그'}
          </button>
          <button onClick={() => { fetchAdminData(); alert("데이터가 새로고침 되었습니다."); }} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold transition-colors whitespace-nowrap">
            🔄 새로고침
          </button>
          <button onClick={() => setIsEditingSettings(!isEditingSettings)} className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg font-bold transition-colors whitespace-nowrap">
            {isEditingSettings ? '설정 닫기' : '⚙️ 설정 변경'}
          </button>
        </div>
      </div>

      {/* 🌟 [추가됨] 관리자 팝콘 통계 대시보드 */}
      <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-yellow-600 mb-8 max-w-4xl mx-auto text-center">
        <h2 className="text-xl font-bold text-yellow-500 mb-4 tracking-widest text-left">📊 예매 및 팝콘 현황 요약 (확정 기준)</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600"><span className="block text-gray-400 text-sm font-bold mb-1">총 확정 예매</span><span className="text-2xl font-black text-white">{reservations.filter(r => r.payment_status === 'confirmed').length}명</span></div>
          <div className="bg-yellow-900/30 p-4 rounded-lg border border-yellow-600"><span className="block text-yellow-400 text-sm font-bold mb-1">🍿 오리지널</span><span className="text-2xl font-black text-yellow-400">{popcornStats.original}개</span></div>
          <div className="bg-orange-900/30 p-4 rounded-lg border border-orange-600"><span className="block text-orange-400 text-sm font-bold mb-1">🧀 콘소메</span><span className="text-2xl font-black text-orange-400">{popcornStats.consomme}개</span></div>
          <div className="bg-amber-900/30 p-4 rounded-lg border border-amber-600"><span className="block text-amber-500 text-sm font-bold mb-1">🍯 카라멜</span><span className="text-2xl font-black text-amber-500">{popcornStats.caramel}개</span></div>
          <div className="bg-green-900/30 p-4 rounded-lg border border-green-600 col-span-2 md:col-span-1"><span className="block text-green-400 text-sm font-bold mb-1">💸 현금 매출금액</span><span className="text-xl md:text-2xl font-black text-green-400">{popcornStats.cash.toLocaleString()}원</span></div>
        </div>
      </div>

      {showLogs && (
        <div className="bg-gray-900 border border-gray-700 p-6 rounded-xl shadow-2xl mb-8 max-h-[500px] overflow-y-auto">
          <h2 className="text-xl font-bold text-blue-400 mb-4 sticky top-0 bg-gray-900 py-2 border-b border-gray-800">
            📜 시스템 활동 로그 <span className="text-sm text-gray-500 font-normal ml-2">(최근 100건)</span>
          </h2>
          <div className="space-y-1 font-mono text-[13px] md:text-sm">
            {logs.length === 0 && <p className="text-gray-500">기록된 로그가 없습니다.</p>}
            {logs.map((log) => {
              const d = new Date(log.created_at);
              const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
              return (
                <div key={log.id} className="text-gray-300 border-b border-gray-800 py-2 hover:bg-gray-800 flex flex-wrap gap-2">
                  <span className="text-gray-500 min-w-[150px]">{dateStr}</span>
                  <span className="text-yellow-400 w-[45px] font-bold">{log.student_id}</span>
                  <span className="text-blue-300 w-[60px]">{log.student_name}</span>
                  <span className="text-white font-bold">{log.description}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isEditingSettings && movieInfo && (
        <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-purple-600 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="block text-sm text-gray-400 mb-1">영화 제목</label><input type="text" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none" /></div>
          <div><label className="block text-sm text-gray-400 mb-1">상영 일시 (화면 표시용)</label><input type="text" value={editForm.date_string} onChange={e => setEditForm({ ...editForm, date_string: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none" /></div>
          <div><label className="block text-sm text-gray-400 mb-1">DB 기준 날짜 (YYYY-MM-DD)</label><input type="text" value={editForm.db_date} onChange={e => setEditForm({ ...editForm, db_date: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none" /></div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">상영 장소 (주의: 변경 시 내역 폭파됨)</label>
            <select value={editForm.venue} onChange={e => setEditForm({ ...editForm, venue: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-purple-500 outline-none">
              <option value="대구과학고등학교 중강당">중강당 (14x9 배열)</option>
              <option value="대구과학고등학교 대강당">대강당 (27x18 배열)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">관람가 등급</label>
            <select value={editForm.age_rating} onChange={e => setEditForm({ ...editForm, age_rating: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none">
              <option value="전체관람가">전체관람가</option>
              <option value="12세이상관람가">12세 이상 관람가</option>
              <option value="15세이상관람가">15세 이상 관람가</option>
              <option value="청소년관람불가">청소년 관람불가</option>
            </select>
          </div>
          <div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-1">포스터 주소</label><input type="text" value={editForm.poster_url} onChange={e => setEditForm({ ...editForm, poster_url: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none" /></div>
          <div className="md:col-span-2"><label className="block text-sm text-red-400 font-bold mb-1">예매 마감 일시 (ISO 형식)</label><input type="text" value={editForm.deadline_date} onChange={e => setEditForm({ ...editForm, deadline_date: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-red-800 outline-none" /></div>
          <div className="md:col-span-2 mt-4"><h3 className="text-indigo-400 font-bold border-b border-gray-700 pb-2 mb-2">동아리 전용(VIP) - 🟦 중강당 기준</h3></div>
          <div className="flex gap-2">
            <div className="flex-1"><label className="block text-xs text-gray-400 mb-1">시작 행</label><input type="text" maxLength={1} value={editForm.mid_vip_start_row} onChange={e => setEditForm({ ...editForm, mid_vip_start_row: e.target.value.toUpperCase() })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-center" /></div>
            <div className="flex-1"><label className="block text-xs text-gray-400 mb-1">끝 행</label><input type="text" maxLength={1} value={editForm.mid_vip_end_row} onChange={e => setEditForm({ ...editForm, mid_vip_end_row: e.target.value.toUpperCase() })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-center" /></div>
            <div className="flex-1"><label className="block text-xs text-gray-400 mb-1">시작 열</label><input type="number" value={editForm.mid_vip_start_col} onChange={e => setEditForm({ ...editForm, mid_vip_start_col: parseInt(e.target.value) })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-center" /></div>
            <div className="flex-1"><label className="block text-xs text-gray-400 mb-1">끝 열</label><input type="number" value={editForm.mid_vip_end_col} onChange={e => setEditForm({ ...editForm, mid_vip_end_col: parseInt(e.target.value) })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-center" /></div>
          </div>
          <div className="md:col-span-2 mt-4"><h3 className="text-pink-400 font-bold border-b border-gray-700 pb-2 mb-2">동아리 전용(VIP) - 🟥 대강당 기준</h3></div>
          <div className="flex gap-2">
            <div className="flex-1"><label className="block text-xs text-gray-400 mb-1">시작 행</label><input type="text" maxLength={1} value={editForm.grand_vip_start_row} onChange={e => setEditForm({ ...editForm, grand_vip_start_row: e.target.value.toUpperCase() })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-center" /></div>
            <div className="flex-1"><label className="block text-xs text-gray-400 mb-1">끝 행</label><input type="text" maxLength={1} value={editForm.grand_vip_end_row} onChange={e => setEditForm({ ...editForm, grand_vip_end_row: e.target.value.toUpperCase() })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-center" /></div>
            <div className="flex-1"><label className="block text-xs text-gray-400 mb-1">시작 열</label><input type="number" value={editForm.grand_vip_start_col} onChange={e => setEditForm({ ...editForm, grand_vip_start_col: parseInt(e.target.value) })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-center" /></div>
            <div className="flex-1"><label className="block text-xs text-gray-400 mb-1">끝 열</label><input type="number" value={editForm.grand_vip_end_col} onChange={e => setEditForm({ ...editForm, grand_vip_end_col: parseInt(e.target.value) })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-center" /></div>
          </div>
          <div className="md:col-span-2 mt-4 text-right"><button onClick={handleSaveSettingsClick} className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg">💾 변경사항 저장</button></div>
        </div>
      )}

      <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-blue-600 mb-8">
        <h2 className="text-xl font-bold text-blue-400 mb-4">📧 상영작 홍보 메일 발송</h2>
        <div className="flex flex-wrap gap-6 mb-6">
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={promoTargets.grade1} onChange={e => setPromoTargets({ ...promoTargets, grade1: e.target.checked })} className="w-5 h-5 accent-blue-600" /> <span className="text-gray-300 font-bold">1학년</span></label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={promoTargets.grade2} onChange={e => setPromoTargets({ ...promoTargets, grade2: e.target.checked })} className="w-5 h-5 accent-blue-600" /> <span className="text-gray-300 font-bold">2학년</span></label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={promoTargets.grade3} onChange={e => setPromoTargets({ ...promoTargets, grade3: e.target.checked })} className="w-5 h-5 accent-blue-600" /> <span className="text-gray-300 font-bold">3학년</span></label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={promoTargets.staff} onChange={e => setPromoTargets({ ...promoTargets, staff: e.target.checked })} className="w-5 h-5 accent-blue-600" /> <span className="text-gray-300 font-bold">교직원</span></label>
          <label className="flex items-center gap-2 cursor-pointer border-l-2 border-gray-600 pl-6 ml-2"><input type="checkbox" checked={promoTargets.club} onChange={e => setPromoTargets({ ...promoTargets, club: e.target.checked })} className="w-5 h-5 accent-purple-600" /> <span className="text-purple-400 font-bold">테스트용 (동아리부원 10명)</span></label>
        </div>

        <div className="mb-6 p-4 bg-gray-700/50 rounded-xl border border-gray-600">
          <label className="block text-gray-300 mb-2 text-sm font-bold">🎯 특정 1인에게만 보내기 (선택)</label>
          <select value={singleTarget} onChange={e => setSingleTarget(e.target.value)} className="w-full p-3 bg-gray-800 text-white rounded-lg border border-gray-600 outline-none focus:border-blue-500">
            <option value="">-- 개인 발송 안 함 (위에 체크된 그룹에게만 발송) --</option>
            <optgroup label="👩‍🏫 교직원">{Object.keys(USER_EMAILS).filter(k => isNaN(Number(k))).sort().map(staff => <option key={staff} value={staff}>{staff}</option>)}</optgroup>
            <optgroup label="🎓 1학년">{Object.keys(USER_EMAILS).filter(k => k.startsWith('1') && k.length === 4).sort().map(id => <option key={id} value={id}>{id} {STUDENT_LIST[id]}</option>)}</optgroup>
            <optgroup label="🎓 2학년">{Object.keys(USER_EMAILS).filter(k => k.startsWith('2') && k.length === 4).sort().map(id => <option key={id} value={id}>{id} {STUDENT_LIST[id]}</option>)}</optgroup>
            <optgroup label="🎓 3학년">{Object.keys(USER_EMAILS).filter(k => k.startsWith('3') && k.length === 4).sort().map(id => <option key={id} value={id}>{id} {STUDENT_LIST[id]}</option>)}</optgroup>
          </select>
        </div>

        {isSendingPromo ? (
          <div className="w-full bg-gray-700 rounded-full h-8 relative overflow-hidden border border-gray-600">
            <div className="bg-blue-600 h-8 transition-all duration-300 flex items-center justify-center" style={{ width: `${(promoProgress.current / promoProgress.total) * 100}%` }}></div>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white drop-shadow-md">안전 발송 중... ({promoProgress.current} / {promoProgress.total})</span>
          </div>
        ) : (
          <button onClick={handleSendPromoClick} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg rounded-xl shadow-lg transition-colors">🚀 체크한 대상에게 홍보 메일 발송하기</button>
        )}
      </div>

      <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-red-600 mb-8">
        <h2 className="text-xl font-bold text-red-400 mb-4">🚫 블랙리스트 관리</h2>
        <div className="flex gap-2 mb-6">
          <input type="text" maxLength={4} value={newBlackId} onChange={(e) => setNewBlackId(e.target.value)} placeholder="학번 4자리 입력" className="p-2 bg-gray-700 rounded border border-gray-600 outline-none text-white w-48" />
          <button onClick={handleAddBlacklist} className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded font-bold transition-colors">추가하기</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {blacklist.length === 0 && <p className="text-gray-500 text-sm">등록된 블랙리스트가 없습니다.</p>}
          {blacklist.map((user) => (
            <div key={user.student_id} className="bg-red-900/40 border border-red-800 rounded-full px-4 py-1 flex items-center gap-2">
              <span className="text-red-200 text-sm">{user.student_id} {user.student_name}</span>
              <button onClick={() => handleRemoveBlacklist(user.student_id, user.student_name)} className="text-red-400 hover:text-white font-bold ml-2">×</button>
            </div>
          ))}
        </div>
      </div>

      {/* 🌟 [수정됨] 예매 내역 테이블에 다중 팝콘 금액 계산 로직 추가 */}
      <div className="bg-gray-800 rounded-xl overflow-x-auto shadow-2xl border border-gray-700">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-gray-700 text-gray-300">
            <tr>
              <th className="p-4">상태</th>
              <th className="p-4">좌석</th>
              <th className="p-4">학번/이름</th>
              <th className="p-4">결제/팝콘</th>
              <th className="p-4 text-center">발권 여부</th>
              <th className="p-4 text-right">관리 작업</th>
            </tr>
          </thead>
          <tbody>
            {reservations.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-500">예매 내역이 없습니다.</td></tr>}
            {reservations.map((ticket) => {

              // 🌟 현재 티켓의 팝콘 데이터 분석
              const popcornArray = ticket.popcorn_order && ticket.popcorn_order !== 'none' ? ticket.popcorn_order.split(',') : [];
              const totalPrice = popcornArray.length * 2500;

              const counts: Record<string, number> = {};
              popcornArray.forEach((p: string) => { counts[p] = (counts[p] || 0) + 1; });
              const popcornSummary = popcornArray.length > 0
                ? Object.entries(counts).map(([k, c]) => `${POPCORN_NAMES[k]} ${c}개`).join(', ')
                : '무료 관람';

              return (
                <tr key={ticket.id} className="border-b border-gray-700 hover:bg-gray-750">
                  <td className="p-4">
                    {ticket.payment_status === 'group_pending' ? (
                      <span className="bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded border border-yellow-600 font-bold text-xs">⏳ 단체 대기</span>
                    ) : (
                      <span className="bg-green-600/20 text-green-500 px-2 py-1 rounded border border-green-600 font-bold">확정됨</span>
                    )}
                    {ticket.is_group_leader && <span className="ml-1 text-emerald-400 text-xs font-bold">👑</span>}
                  </td>
                  <td className="p-4 font-bold text-lg">{ticket.seat_number}</td>
                  <td className="p-4">{ticket.student_id} <span className="text-blue-300 font-bold">{ticket.student_name}</span></td>

                  {/* 🌟 팝콘 결제 내역 및 뱃지 표시란 */}
                  <td className="p-4">
                    {popcornArray.length > 0 ? (
                      <div className="flex flex-col">
                        <span className="text-yellow-400 font-bold text-sm tracking-widest">{totalPrice.toLocaleString()}원</span>
                        <span className="text-gray-400 text-xs mt-1">🍿 {popcornSummary}</span>
                      </div>
                    ) : (
                      <span className="text-gray-500 text-sm">무료 관람 (0원)</span>
                    )}
                  </td>

                  {/* 🌟 [추가됨] 발권 상태 표시 UI */}
                  <td className="p-4 text-center">
                    {ticket.is_printed ? (
                      <span className="text-blue-400 font-bold border border-blue-600 bg-blue-900/30 px-3 py-1 rounded-lg text-xs tracking-wider">🖨️ 발권 완료</span>
                    ) : (
                      <span className="text-gray-500 font-bold text-sm">미발권</span>
                    )}
                  </td>

                  <td className="p-4 text-right flex justify-end gap-2">
                    {/* 🌟 [추가됨] 발권된 티켓만 '초기화' 버튼이 나타남 */}
                    {ticket.payment_status === 'pending' && (
                      <button onClick={() => handleApprove(ticket)} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded font-bold shadow-md transition-colors">
                        ✅ 승인
                      </button>
                    )}
                    {ticket.is_printed && (
                      <button onClick={() => handleResetPrint(ticket)} className="bg-yellow-600 hover:bg-yellow-500 text-black px-3 py-1 rounded font-bold shadow-md transition-colors">
                        🔄 발권 초기화
                      </button>
                    )}
                    <button onClick={() => handleCancel(ticket)} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded font-bold shadow-md transition-colors">
                      ❌ 강제 취소
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
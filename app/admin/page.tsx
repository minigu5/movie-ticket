"use client";

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { ensureProfile, signInWithGoogle, signOutAndClear, authFetch, DomainNotAllowedError, type AppProfile } from '../../lib/supabase-auth';
import Link from 'next/link';
import { extractSchoolEmails } from '../../lib/parseEmails';

const POPCORN_NAMES: Record<string, string> = { "original": "오리지널", "consomme": "콘소메", "caramel": "카라멜" };

export default function AdminPage() {
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [reservations, setReservations] = useState<any[]>([]);
  const [movieInfo, setMovieInfo] = useState<any>(null);
  const [isLoadingUI, setIsLoadingUI] = useState(true); // 🌟 [추가됨] 로딩 상태 관리

  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  const [isStartingNewMovie, setIsStartingNewMovie] = useState(false);
  const [newMovieForm, setNewMovieForm] = useState<any>({});

  const [movieHistory, setMovieHistory] = useState<any[]>([]);
  const [showMovieHistory, setShowMovieHistory] = useState(false);
  const [selectedHistoryMovie, setSelectedHistoryMovie] = useState<any>(null);
  const [historyReservations, setHistoryReservations] = useState<any[]>([]);

  const [logs, setLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const [blacklist, setBlacklist] = useState<{email: string, created_at: string}[]>([]);
  const [newBlacklistText, setNewBlacklistText] = useState('');

  const [admins, setAdmins] = useState<{email: string, added_by: string | null, created_at: string}[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [clubMembers, setClubMembers] = useState<{email: string, added_by: string | null, created_at: string}[]>([]);
  const [newClubMembersText, setNewClubMembersText] = useState('');
  const [kioskPasswordInput, setKioskPasswordInput] = useState('');
  const [profileSearchQuery, setProfileSearchQuery] = useState('');
  const [profileSearchResults, setProfileSearchResults] = useState<{id: string, email: string, student_id: string | null, name: string, role: string}[]>([]);
  const [editingProfile, setEditingProfile] = useState<{id: string, email: string, student_id: string, name: string, role: string} | null>(null);

  const [baseUrl, setBaseUrl] = useState('');
  useEffect(() => setBaseUrl(window.location.origin), []);

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

  const clubEmailPreviewCount = useMemo(() => extractSchoolEmails(newClubMembersText).length, [newClubMembersText]);
  const blacklistEmailPreviewCount = useMemo(() => extractSchoolEmails(newBlacklistText).length, [newBlacklistText]);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      try {
        const p = await ensureProfile();
        if (active) setProfile(p);
      } catch (err) {
        if (err instanceof DomainNotAllowedError) alert('🚫 학교(@ts.hs.kr) 구글 계정으로만 로그인할 수 있습니다.');
      } finally {
        if (active) setAuthLoading(false);
      }
    };
    bootstrap();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (profile) checkAdminAndLoad();
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkAdminAndLoad = async () => {
    setCheckingAdmin(true);
    const ok = await fetchAdminData();
    setIsAdmin(ok);
    setCheckingAdmin(false);
  };

  const fetchAdminData = async (): Promise<boolean> => {
    setIsLoadingUI(true);
    try {
      const res = await authFetch('/api/admin/action', { action: 'FETCH_INITIAL_DATA' });
      const { data, success, error } = await res.json();

      if (!success) {
        if (res.status === 401 || res.status === 403) return false;
        alert(`데이터 불러오기 실패: ${error}`);
        console.error("데이터 로드 실패:", error);
        return true;
      }

      const { movieData, resData, blData, logData, adminData, clubData, kioskPassword } = data;
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
      if (adminData) setAdmins(adminData);
      if (clubData) setClubMembers(clubData);
      if (typeof kioskPassword === 'string') setKioskPasswordInput(kioskPassword);
      return true;
    } catch (err) {
      console.error("데이터 불러오기 오류:", err);
      return true;
    } finally {
      setIsLoadingUI(false);
    }
  };

  const handleSaveSettingsClick = async () => {
    const payload = {
      title: editForm.title, date_string: editForm.date_string, db_date: editForm.db_date,
      venue: editForm.venue, poster_url: editForm.poster_url, deadline_date: editForm.deadline_date, age_rating: editForm.age_rating,
      mid_vip_start_row: editForm.mid_vip_start_row, mid_vip_end_row: editForm.mid_vip_end_row,
      mid_vip_start_col: editForm.mid_vip_start_col, mid_vip_end_col: editForm.mid_vip_end_col,
      grand_vip_start_row: editForm.grand_vip_start_row, grand_vip_end_row: editForm.grand_vip_end_row,
      grand_vip_start_col: editForm.grand_vip_start_col, grand_vip_end_col: editForm.grand_vip_end_col
    };

    const res = await authFetch('/api/admin/action', { action: 'UPDATE_SETTINGS', payload });

    const data = await res.json();
    if (!data.success) {
      alert("설정 저장 실패: " + data.error);
    } else {
      alert("✅ 설정이 성공적으로 저장되었습니다!");
      setIsEditingSettings(false);
      fetchAdminData();
    }
  };

  const handleStartNewMovieClick = () => {
    if (!confirm(`현재 회차 [${movieInfo?.title}]를 이력으로 보존하고 새로운 영화 예매를 시작합니다.\n계속하시겠습니까?`)) return;
    setNewMovieForm({
      ...movieInfo,
      title: '', poster_url: '',
    });
    setIsEditingSettings(false);
    setIsStartingNewMovie(true);
  };

  const handleSubmitNewMovie = async () => {
    const payload = {
      title: newMovieForm.title, date_string: newMovieForm.date_string, db_date: newMovieForm.db_date,
      venue: newMovieForm.venue, poster_url: newMovieForm.poster_url, deadline_date: newMovieForm.deadline_date, age_rating: newMovieForm.age_rating,
      mid_vip_start_row: newMovieForm.mid_vip_start_row, mid_vip_end_row: newMovieForm.mid_vip_end_row,
      mid_vip_start_col: newMovieForm.mid_vip_start_col, mid_vip_end_col: newMovieForm.mid_vip_end_col,
      grand_vip_start_row: newMovieForm.grand_vip_start_row, grand_vip_end_row: newMovieForm.grand_vip_end_row,
      grand_vip_start_col: newMovieForm.grand_vip_start_col, grand_vip_end_col: newMovieForm.grand_vip_end_col
    };

    const res = await authFetch('/api/admin/action', { action: 'START_NEW_MOVIE', payload });

    const data = await res.json();
    if (!data.success) {
      alert("새 회차 시작 실패: " + data.error);
    } else {
      alert("✅ 새 회차가 시작되었습니다!");
      setIsStartingNewMovie(false);
      fetchAdminData();
    }
  };

  const handleToggleMovieHistory = async () => {
    if (!showMovieHistory) {
      const res = await authFetch('/api/admin/action', { action: 'LIST_MOVIE_HISTORY' });
      const data = await res.json();
      if (!data.success) return alert("회차 이력 조회 실패: " + data.error);
      setMovieHistory(data.data);
    }
    setSelectedHistoryMovie(null);
    setHistoryReservations([]);
    setShowMovieHistory(!showMovieHistory);
  };

  const handleSelectHistoryMovie = async (movie: any) => {
    const res = await authFetch('/api/admin/action', { action: 'FETCH_HISTORY_RESERVATIONS', payload: { movieSettingsId: movie.id } });
    const data = await res.json();
    if (!data.success) return alert("예매 내역 조회 실패: " + data.error);
    setSelectedHistoryMovie(movie);
    setHistoryReservations(data.data);
  };

  const handleApprove = async (ticket: any) => {
    const popcorns = ticket.popcorn_order !== 'none' ? ticket.popcorn_order.split(',') : [];
    const totalPrice = popcorns.length * 2500;

    if (!confirm(`${ticket.student_name}님의 예매를 확정하시겠습니까?\n(입금 확인 금액: ${totalPrice.toLocaleString()}원)`)) return;

    const res = await authFetch('/api/admin/action', {
      action: 'APPROVE_RESERVATION',
      payload: { id: ticket.id, studentId: ticket.student_id, studentName: ticket.student_name, seatNumber: ticket.seat_number }
    });

    const data = await res.json();
    if (!data.success) return alert("승인 실패: " + data.error);

    if (ticket.email) {
      fetch('/api/ticket', { method: 'POST', body: JSON.stringify({ email: ticket.email, name: ticket.student_name, seat: ticket.seat_number, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, statusType: 'confirmed', popcorn: ticket.popcorn_order, ticketId: ticket.id, baseUrl }) });
    }
    setReservations(prev => prev.map(r => r.id === ticket.id ? { ...r, payment_status: 'confirmed' } : r));
    alert("승인 완료 및 이메일 발송됨!");
  };

  const handleCancel = async (ticket: any) => {
    if (!confirm(`정말 ${ticket.student_name}님의 예매를 취소하시겠습니까?`)) return;

    const res = await authFetch('/api/admin/action', {
      action: 'CANCEL_RESERVATION',
      payload: { id: ticket.id, studentId: ticket.student_id, studentName: ticket.student_name, seatNumber: ticket.seat_number }
    });

    const data = await res.json();
    if (!data.success) return alert("취소 실패: " + data.error);

    if (ticket.email) {
      const isRefundNeeded = ticket.popcorn_order !== 'none' && ticket.payment_status === 'confirmed';
      fetch('/api/ticket', {
        method: 'POST',
        body: JSON.stringify({ email: ticket.email, name: ticket.student_name, seat: ticket.seat_number, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, statusType: 'canceled', popcorn: ticket.popcorn_order, ticketId: ticket.id, baseUrl, isRefundNeeded })
      });
    }
    setReservations(prev => prev.filter(r => r.id !== ticket.id));
    alert("취소 완료 및 이메일 발송됨!");
  };

  const handleResetPrint = async (ticket: any) => {
    if (!confirm(`${ticket.student_name}님의 티켓 발권 상태를 '미발권'으로 초기화하시겠습니까?\n(학생이 현장 키오스크에서 다시 티켓을 출력할 수 있게 됩니다.)`)) return;

    const res = await authFetch('/api/admin/action', {
      action: 'RESET_PRINT',
      payload: { id: ticket.id, studentId: ticket.student_id, studentName: ticket.student_name, seatNumber: ticket.seat_number }
    });

    const data = await res.json();
    if (!data.success) {
      alert("초기화 실패: " + data.error);
      return;
    }

    setReservations(prev => prev.map(r => r.id === ticket.id ? { ...r, is_printed: false } : r));
    alert("✅ 발권 상태가 초기화되었습니다.");
  };

  const handleAddBlacklistBulk = async () => {
    const emails = extractSchoolEmails(newBlacklistText);
    if (emails.length === 0) return alert("추가할 @ts.hs.kr 이메일이 없습니다.");
    if (!confirm(`${emails.length}명을 블랙리스트에 추가하시겠습니까?\n(⚠️ 주의: 현재 진행 중이거나 완료된 예매 내역이 있다면 자동으로 취소됩니다.)`)) return;

    const res = await authFetch('/api/admin/action', { action: 'ADD_BLACKLIST_BULK', payload: { emails, movieDate: movieInfo.db_date } });
    const data = await res.json();
    if (!data.success) return alert("추가 실패: " + (data.error || ''));

    data.results.forEach((r: any) => {
      if (r.canceledTicket) {
        const ticket = r.canceledTicket;
        const isRefundNeeded = ticket.popcorn_order !== 'none' && ticket.payment_status === 'confirmed';
        fetch('/api/ticket', {
          method: 'POST',
          body: JSON.stringify({ email: r.email, name: r.name, seat: ticket.seat_number, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, statusType: 'canceled', popcorn: ticket.popcorn_order, ticketId: ticket.id, baseUrl, isRefundNeeded })
        });
      }
      fetch('/api/blacklist', { method: 'POST', body: JSON.stringify({ email: r.email, name: r.name, action: 'added' }) });
    });

    setNewBlacklistText('');
    fetchAdminData();
    alert(`✅ ${emails.length}명 블랙리스트 추가 및 예매 자동 취소 처리가 완료되었습니다!`);
  };

  const handleRemoveBlacklist = async (email: string) => {
    if (!confirm(`${email} 블랙리스트를 해제하시겠습니까?`)) return;
    const res = await authFetch('/api/admin/action', { action: 'REMOVE_BLACKLIST', payload: { email } });
    const data = await res.json();
    if (!data.success) return alert("해제 실패");
    fetch('/api/blacklist', { method: 'POST', body: JSON.stringify({ email, name: data.name, action: 'removed' }) });
    fetchAdminData();
    alert("✅ 해제 완료 및 안내 메일 발송!");
  };

  const handleAddAdmin = async () => {
    const email = newAdminEmail.trim().toLowerCase();
    if (!email.endsWith('@ts.hs.kr')) return alert("@ts.hs.kr 이메일만 등록할 수 있습니다.");
    const res = await authFetch('/api/admin/action', { action: 'ADD_ADMIN', payload: { email } });
    const data = await res.json();
    if (!data.success) return alert("추가 실패: " + data.error);
    setAdmins(prev => [{ email, added_by: profile!.email, created_at: new Date().toISOString() }, ...prev]);
    setNewAdminEmail('');
  };

  const handleRemoveAdmin = async (email: string) => {
    if (email === profile!.email) return alert("본인 계정은 스스로 제거할 수 없습니다.");
    if (!confirm(`${email}의 관리자 권한을 제거하시겠습니까?`)) return;
    const res = await authFetch('/api/admin/action', { action: 'REMOVE_ADMIN', payload: { email } });
    const data = await res.json();
    if (!data.success) return alert("제거 실패: " + data.error);
    setAdmins(prev => prev.filter(a => a.email !== email));
  };

  const handleAddClubMembers = async () => {
    const emails = extractSchoolEmails(newClubMembersText);
    if (emails.length === 0) return alert("추가할 @ts.hs.kr 이메일이 없습니다.");
    const res = await authFetch('/api/admin/action', { action: 'ADD_CLUB_MEMBERS', payload: { emails } });
    const data = await res.json();
    if (!data.success) return alert("추가 실패: " + data.error);
    setNewClubMembersText('');
    fetchAdminData();
    alert(`✅ ${emails.length}명 동아리원(VIP)으로 추가되었습니다.`);
  };

  const handleRemoveClubMember = async (email: string) => {
    if (!confirm(`${email} 학생을 동아리원(VIP)에서 제거하시겠습니까?`)) return;
    const res = await authFetch('/api/admin/action', { action: 'REMOVE_CLUB_MEMBER', payload: { email } });
    const data = await res.json();
    if (!data.success) return alert("제거 실패: " + data.error);
    fetchAdminData();
  };

  const handleUpdateKioskPassword = async () => {
    if (!kioskPasswordInput.trim()) return alert("키오스크 비밀번호를 입력해주세요.");
    const res = await authFetch('/api/admin/action', { action: 'UPDATE_KIOSK_PASSWORD', payload: { password: kioskPasswordInput.trim() } });
    const data = await res.json();
    if (!data.success) return alert("변경 실패: " + data.error);
    alert("✅ 키오스크 잠금 비밀번호가 변경되었습니다.");
  };

  const handleSearchProfile = async () => {
    const res = await authFetch('/api/admin/action', { action: 'SEARCH_PROFILE', payload: { query: profileSearchQuery } });
    const data = await res.json();
    if (data.success) setProfileSearchResults(data.data);
  };

  const handleSaveProfile = async () => {
    if (!editingProfile) return;
    if (editingProfile.role === 'student' && !/^\d{4}$/.test(editingProfile.student_id)) {
      return alert("학생은 학번 4자리가 필요합니다.");
    }
    const res = await authFetch('/api/admin/action', {
      action: 'UPDATE_PROFILE',
      payload: { id: editingProfile.id, studentId: editingProfile.student_id, name: editingProfile.name, role: editingProfile.role }
    });
    const data = await res.json();
    if (!data.success) return alert("저장 실패: " + data.error);
    alert("✅ 저장되었습니다.");
    setEditingProfile(null);
    setProfileSearchResults([]);
    setProfileSearchQuery('');
  };

  if (authLoading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <p className="text-white font-bold animate-pulse">로그인 확인 중...</p>
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-xl max-w-sm w-full text-center border border-gray-700 shadow-2xl">
        <h1 className="text-2xl font-bold text-white mb-6">🔒 관리자 로그인</h1>
        <p className="text-gray-400 text-sm mb-6">학교(@ts.hs.kr) 구글 계정으로 로그인해주세요.</p>
        <button
          onClick={() => signInWithGoogle().catch(() => alert('로그인에 실패했습니다.'))}
          className="w-full py-3 bg-white hover:bg-gray-100 text-gray-900 rounded-lg font-bold transition-colors"
        >
          구글 계정으로 로그인
        </button>
      </div>
    </div>
  );

  if (checkingAdmin) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <p className="text-white font-bold animate-pulse">권한 확인 중...</p>
    </div>
  );

  if (!isAdmin) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-xl max-w-sm w-full text-center border border-red-700 shadow-2xl">
        <h1 className="text-2xl font-bold text-red-400 mb-4">🚫 권한 없음</h1>
        <p className="text-gray-400 text-sm">{profile.email} 계정은 관리자로 등록되어 있지 않습니다.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 relative">
      <div className="w-full flex flex-wrap justify-end items-center gap-3 mb-6 z-20">
        <span className="text-xs md:text-sm text-gray-500">{profile.email}</span>
        <button onClick={() => signOutAndClear().then(() => window.location.reload())} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-xs md:text-sm text-slate-400 font-bold transition-colors shadow-lg">
          🚪 로그아웃
        </button>
        <Link href="/" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-xs md:text-sm text-gray-300 font-bold transition-colors shadow-lg">🏠 메인 홈</Link>
        <Link href="/print" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-xs md:text-sm text-gray-300 font-bold transition-colors shadow-lg">🖨️ 현장 발권기</Link>
      </div>

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
          <button onClick={() => { setIsEditingSettings(!isEditingSettings); setIsStartingNewMovie(false); }} className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg font-bold transition-colors whitespace-nowrap">
            {isEditingSettings ? '설정 닫기' : '⚙️ 설정 변경'}
          </button>
          <button onClick={handleStartNewMovieClick} className="bg-orange-600 hover:bg-orange-500 px-4 py-2 rounded-lg font-bold transition-colors whitespace-nowrap">
            🎬 새 회차 시작
          </button>
          <button onClick={handleToggleMovieHistory} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-bold transition-colors whitespace-nowrap">
            {showMovieHistory ? '🗂️ 이력 닫기' : '🗂️ 회차 이력'}
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
            <label className="block text-sm text-gray-400 mb-1">상영 장소</label>
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

      {isStartingNewMovie && (
        <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-orange-500 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2"><h2 className="text-xl font-bold text-orange-400">🎬 새 회차 시작 - 새 영화 정보 입력</h2></div>
          <div><label className="block text-sm text-gray-400 mb-1">영화 제목</label><input type="text" value={newMovieForm.title} onChange={e => setNewMovieForm({ ...newMovieForm, title: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none" /></div>
          <div><label className="block text-sm text-gray-400 mb-1">상영 일시 (화면 표시용)</label><input type="text" value={newMovieForm.date_string} onChange={e => setNewMovieForm({ ...newMovieForm, date_string: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none" /></div>
          <div><label className="block text-sm text-gray-400 mb-1">DB 기준 날짜 (YYYY-MM-DD)</label><input type="text" value={newMovieForm.db_date} onChange={e => setNewMovieForm({ ...newMovieForm, db_date: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none" /></div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">상영 장소</label>
            <select value={newMovieForm.venue} onChange={e => setNewMovieForm({ ...newMovieForm, venue: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-orange-500 outline-none">
              <option value="대구과학고등학교 중강당">중강당 (14x9 배열)</option>
              <option value="대구과학고등학교 대강당">대강당 (27x18 배열)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">관람가 등급</label>
            <select value={newMovieForm.age_rating} onChange={e => setNewMovieForm({ ...newMovieForm, age_rating: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none">
              <option value="전체관람가">전체관람가</option>
              <option value="12세이상관람가">12세 이상 관람가</option>
              <option value="15세이상관람가">15세 이상 관람가</option>
              <option value="청소년관람불가">청소년 관람불가</option>
            </select>
          </div>
          <div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-1">포스터 주소</label><input type="text" value={newMovieForm.poster_url} onChange={e => setNewMovieForm({ ...newMovieForm, poster_url: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none" /></div>
          <div className="md:col-span-2"><label className="block text-sm text-red-400 font-bold mb-1">예매 마감 일시 (ISO 형식)</label><input type="text" value={newMovieForm.deadline_date} onChange={e => setNewMovieForm({ ...newMovieForm, deadline_date: e.target.value })} className="w-full p-2 bg-gray-700 rounded border border-red-800 outline-none" /></div>
          <div className="md:col-span-2 mt-4"><h3 className="text-indigo-400 font-bold border-b border-gray-700 pb-2 mb-2">동아리 전용(VIP) - 🟦 중강당 기준</h3></div>
          <div className="flex gap-2">
            <div className="flex-1"><label className="block text-xs text-gray-400 mb-1">시작 행</label><input type="text" maxLength={1} value={newMovieForm.mid_vip_start_row} onChange={e => setNewMovieForm({ ...newMovieForm, mid_vip_start_row: e.target.value.toUpperCase() })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-center" /></div>
            <div className="flex-1"><label className="block text-xs text-gray-400 mb-1">끝 행</label><input type="text" maxLength={1} value={newMovieForm.mid_vip_end_row} onChange={e => setNewMovieForm({ ...newMovieForm, mid_vip_end_row: e.target.value.toUpperCase() })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-center" /></div>
            <div className="flex-1"><label className="block text-xs text-gray-400 mb-1">시작 열</label><input type="number" value={newMovieForm.mid_vip_start_col} onChange={e => setNewMovieForm({ ...newMovieForm, mid_vip_start_col: parseInt(e.target.value) })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-center" /></div>
            <div className="flex-1"><label className="block text-xs text-gray-400 mb-1">끝 열</label><input type="number" value={newMovieForm.mid_vip_end_col} onChange={e => setNewMovieForm({ ...newMovieForm, mid_vip_end_col: parseInt(e.target.value) })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-center" /></div>
          </div>
          <div className="md:col-span-2 mt-4"><h3 className="text-pink-400 font-bold border-b border-gray-700 pb-2 mb-2">동아리 전용(VIP) - 🟥 대강당 기준</h3></div>
          <div className="flex gap-2">
            <div className="flex-1"><label className="block text-xs text-gray-400 mb-1">시작 행</label><input type="text" maxLength={1} value={newMovieForm.grand_vip_start_row} onChange={e => setNewMovieForm({ ...newMovieForm, grand_vip_start_row: e.target.value.toUpperCase() })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-center" /></div>
            <div className="flex-1"><label className="block text-xs text-gray-400 mb-1">끝 행</label><input type="text" maxLength={1} value={newMovieForm.grand_vip_end_row} onChange={e => setNewMovieForm({ ...newMovieForm, grand_vip_end_row: e.target.value.toUpperCase() })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-center" /></div>
            <div className="flex-1"><label className="block text-xs text-gray-400 mb-1">시작 열</label><input type="number" value={newMovieForm.grand_vip_start_col} onChange={e => setNewMovieForm({ ...newMovieForm, grand_vip_start_col: parseInt(e.target.value) })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-center" /></div>
            <div className="flex-1"><label className="block text-xs text-gray-400 mb-1">끝 열</label><input type="number" value={newMovieForm.grand_vip_end_col} onChange={e => setNewMovieForm({ ...newMovieForm, grand_vip_end_col: parseInt(e.target.value) })} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-center" /></div>
          </div>
          <div className="md:col-span-2 mt-4 text-right flex justify-end gap-2">
            <button onClick={() => setIsStartingNewMovie(false)} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg">취소</button>
            <button onClick={handleSubmitNewMovie} className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg">🎬 새 회차 시작</button>
          </div>
        </div>
      )}

      {showMovieHistory && (
        <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-gray-600 mb-8">
          <h2 className="text-xl font-bold text-gray-300 mb-4">🗂️ 회차 이력 (지난 상영 목록)</h2>
          <div className="space-y-2 mb-6">
            {movieHistory.length === 0 && <p className="text-gray-500 text-sm">지난 회차 이력이 없습니다.</p>}
            {movieHistory.map((movie) => (
              <button
                key={movie.id}
                onClick={() => handleSelectHistoryMovie(movie)}
                className={`w-full text-left px-4 py-2 rounded-lg border transition-colors ${selectedHistoryMovie?.id === movie.id ? 'bg-gray-700 border-gray-400' : 'bg-gray-900/60 border-gray-700 hover:bg-gray-700/60'}`}
              >
                <span className="font-bold text-white">{movie.title}</span>
                <span className="text-gray-400 text-sm ml-2">{movie.date_string} · {movie.venue}</span>
              </button>
            ))}
          </div>

          {selectedHistoryMovie && (
            <div className="bg-gray-900 rounded-xl overflow-x-auto border border-gray-700">
              <h3 className="text-lg font-bold text-gray-200 p-4 border-b border-gray-700">
                [{selectedHistoryMovie.title}] 예매 내역 <span className="text-sm text-gray-500 font-normal ml-2">(읽기 전용)</span>
              </h3>
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-700 text-gray-300">
                  <tr>
                    <th className="p-4">상태</th>
                    <th className="p-4">좌석</th>
                    <th className="p-4">학번/이름</th>
                    <th className="p-4">결제/팝콘</th>
                    <th className="p-4 text-center">발권 여부</th>
                  </tr>
                </thead>
                <tbody>
                  {historyReservations.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-500">예매 내역이 없습니다.</td></tr>}
                  {historyReservations.map((ticket) => {
                    const popcornArray = ticket.popcorn_order && ticket.popcorn_order !== 'none' ? ticket.popcorn_order.split(',') : [];
                    const totalPrice = popcornArray.length * 2500;
                    const counts: Record<string, number> = {};
                    popcornArray.forEach((p: string) => { counts[p] = (counts[p] || 0) + 1; });
                    const popcornSummary = popcornArray.length > 0
                      ? Object.entries(counts).map(([k, c]) => `${POPCORN_NAMES[k]} ${c}개`).join(', ')
                      : '무료 관람';

                    return (
                      <tr key={ticket.id} className="border-b border-gray-800 hover:bg-gray-800">
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
                        <td className="p-4 text-center">
                          {ticket.is_printed ? (
                            <span className="text-blue-400 font-bold border border-blue-600 bg-blue-900/30 px-3 py-1 rounded-lg text-xs tracking-wider">🖨️ 발권 완료</span>
                          ) : (
                            <span className="text-gray-500 font-bold text-sm">미발권</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-emerald-600 mb-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
        <div className="bg-gray-900/60 rounded-lg border border-emerald-800/40 p-4 flex flex-col min-w-0">
          <h2 className="text-lg font-bold text-emerald-400 mb-3">👑 관리자 목록</h2>
          <div className="flex gap-2 mb-3">
            <input type="text" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} placeholder="xxxx@ts.hs.kr" className="flex-1 min-w-0 p-2 bg-gray-700 rounded border border-gray-600 outline-none text-white text-sm" />
            <button onClick={handleAddAdmin} className="bg-emerald-600 hover:bg-emerald-500 px-3 py-2 rounded font-bold text-sm">추가</button>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {admins.map(a => (
              <div key={a.email} className="flex items-center justify-between gap-2 bg-gray-700/50 rounded px-2 py-1 text-xs">
                <span className="text-gray-200 truncate">{a.email}</span>
                <button onClick={() => handleRemoveAdmin(a.email)} className="shrink-0 text-red-400 hover:text-red-300 font-bold">×</button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900/60 rounded-lg border border-indigo-800/40 p-4 flex flex-col min-w-0">
          <h2 className="text-lg font-bold text-indigo-400 mb-3">🎟️ 동아리원(VIP) 목록</h2>
          <textarea
            value={newClubMembersText}
            onChange={e => setNewClubMembersText(e.target.value)}
            placeholder={"이름과 이메일을 붙여넣으면 이메일만 자동 인식됩니다.\n예) 2208 신민규 <ts250024@ts.hs.kr>"}
            rows={3}
            className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none text-white text-sm resize-none mb-1"
          />
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-500 text-xs">{clubEmailPreviewCount}개 이메일 인식됨</span>
            <button onClick={handleAddClubMembers} className="bg-indigo-600 hover:bg-indigo-500 px-3 py-2 rounded font-bold text-sm">일괄 추가</button>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {clubMembers.map(c => (
              <div key={c.email} className="flex items-center justify-between gap-2 bg-gray-700/50 rounded px-2 py-1 text-xs">
                <span className="text-gray-200 truncate">{c.email}</span>
                <button onClick={() => handleRemoveClubMember(c.email)} className="shrink-0 text-red-400 hover:text-red-300 font-bold">×</button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900/60 rounded-lg border border-yellow-800/40 p-4 flex flex-col min-w-0">
          <h2 className="text-lg font-bold text-yellow-400 mb-3">🖨️ 키오스크 잠금 비밀번호</h2>
          <div className="flex gap-2">
            <input type="text" value={kioskPasswordInput} onChange={e => setKioskPasswordInput(e.target.value)} className="flex-1 min-w-0 p-2 bg-gray-700 rounded border border-gray-600 outline-none text-white text-sm" />
            <button onClick={handleUpdateKioskPassword} className="bg-yellow-600 hover:bg-yellow-500 px-3 py-2 rounded font-bold text-sm text-black">변경</button>
          </div>
          <p className="text-gray-500 text-xs mt-2">현장 키오스크(/print) 진입 시 입력하는 비밀번호입니다.</p>
        </div>

        <div className="bg-gray-900/60 rounded-lg border border-pink-800/40 p-4 flex flex-col min-w-0">
          <h2 className="text-lg font-bold text-pink-400 mb-3">🛠️ 사용자 프로필 수정</h2>
          <p className="text-gray-500 text-xs mb-2">구글 이름이 잘못 인식된 경우 여기서 고칩니다.</p>
          <div className="flex gap-2 mb-3">
            <input type="text" value={profileSearchQuery} onChange={e => setProfileSearchQuery(e.target.value)} placeholder="이메일/이름/학번" className="flex-1 min-w-0 p-2 bg-gray-700 rounded border border-gray-600 outline-none text-white text-sm" />
            <button onClick={handleSearchProfile} className="bg-pink-600 hover:bg-pink-500 px-3 py-2 rounded font-bold text-sm">검색</button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto mb-3">
            {profileSearchResults.map(p => (
              <button
                key={p.id}
                onClick={() => setEditingProfile({ id: p.id, email: p.email, student_id: p.student_id ?? '', name: p.name, role: p.role })}
                className="w-full text-left bg-gray-700/50 hover:bg-gray-700 rounded px-2 py-1 text-xs text-gray-200 truncate block"
              >
                {p.email} — {p.name} ({p.student_id ?? '교직원'})
              </button>
            ))}
          </div>
          {editingProfile && (
            <div className="bg-gray-900 p-3 rounded-lg border border-pink-700 space-y-2 max-h-64 overflow-y-auto">
              <p className="text-xs text-gray-400">{editingProfile.email}</p>
              <select value={editingProfile.role} onChange={e => setEditingProfile({ ...editingProfile, role: e.target.value })} className="w-full p-1.5 bg-gray-700 rounded border border-gray-600 text-white text-xs">
                <option value="student">학생</option>
                <option value="staff">교직원</option>
              </select>
              {editingProfile.role === 'student' && (
                <input type="text" maxLength={4} value={editingProfile.student_id} onChange={e => setEditingProfile({ ...editingProfile, student_id: e.target.value })} placeholder="학번 4자리" className="w-full p-1.5 bg-gray-700 rounded border border-gray-600 text-white text-xs" />
              )}
              <input type="text" value={editingProfile.name} onChange={e => setEditingProfile({ ...editingProfile, name: e.target.value })} placeholder="이름" className="w-full p-1.5 bg-gray-700 rounded border border-gray-600 text-white text-xs" />
              <div className="flex gap-2">
                <button onClick={() => setEditingProfile(null)} className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs font-bold">취소</button>
                <button onClick={handleSaveProfile} className="flex-1 py-1.5 bg-pink-600 hover:bg-pink-500 rounded text-xs font-bold">저장</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-red-600 mb-8">
        <h2 className="text-xl font-bold text-red-400 mb-4">🚫 블랙리스트 관리</h2>
        <div className="flex flex-col md:flex-row gap-2 mb-6">
          <textarea
            value={newBlacklistText}
            onChange={(e) => setNewBlacklistText(e.target.value)}
            placeholder={"이름과 이메일을 붙여넣으면 이메일만 자동 인식됩니다.\n예) 2208 신민규 <ts250024@ts.hs.kr>"}
            rows={2}
            className="flex-1 p-2 bg-gray-700 rounded border border-gray-600 outline-none text-white text-sm resize-none"
          />
          <div className="flex md:flex-col justify-between md:justify-center items-center gap-2">
            <span className="text-gray-500 text-xs whitespace-nowrap">{blacklistEmailPreviewCount}개 인식됨</span>
            <button onClick={handleAddBlacklistBulk} className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded font-bold transition-colors whitespace-nowrap">일괄 추가</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {blacklist.length === 0 && <p className="text-gray-500 text-sm">등록된 블랙리스트가 없습니다.</p>}
          {blacklist.map((user) => (
            <div key={user.email} className="bg-red-900/40 border border-red-800 rounded-full px-4 py-1 flex items-center gap-2">
              <span className="text-red-200 text-sm">{user.email}</span>
              <button onClick={() => handleRemoveBlacklist(user.email)} className="text-red-400 hover:text-white font-bold ml-2">×</button>
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
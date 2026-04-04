"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { USER_EMAILS } from '../../lib/emails';

const STUDENT_LIST: Record<string, string> = {
  // (기존 명렬표가 너무 길어 생략된 것처럼 보이지만 작동엔 문제없습니다. 필요시 원래 명렬표로 덮어쓰세요!)
  "1101": "김세준", "1102": "김시우", "1103": "김연우", "1104": "김윤재", "1105": "박시현", "1106": "배하준", "1107": "손민재", "1108": "이동건", "1109": "이주원", "1110": "이주형", "1111": "이지훈", "1112": "이하은", "1113": "전시윤", "1114": "정윤재", "1115": "차승민", "1116": "최은성", "1201": "김민우", "1202": "김민찬", "1203": "김시현", "1204": "김현서", "1205": "김현성", "1206": "류도헌", "1207": "배성호", "1208": "손시흔", "1209": "옥지훈", "1210": "이건우", "1211": "임해준", "1212": "장민하", "1213": "주지환", "1214": "최우진", "1215": "최윤서", "1216": "최정원", "1217": "최지요", "1301": "강도겸", "1302": "고민석", "1303": "김희정", "1304": "박라원", "1305": "박준영", "1306": "신강우", "1307": "신동희", "1308": "오경택", "1309": "윤정우", "1310": "이민희", "1311": "이승현", "1312": "이시안", "1313": "이희승", "1314": "임용준", "1315": "정재우", "1316": "조현찬", "1317": "천현서", "1401": "권예준", "1402": "김보미", "1403": "김율", "1404": "김학현", "1405": "문도윤", "1406": "박기준", "1407": "박지성", "1408": "배채준", "1409": "서현우", "1410": "윤영식", "1411": "이건우", "1412": "이민결", "1413": "전시후", "1414": "조민준", "1415": "조은준", "1416": "최미성", "1417": "하시원", "1501": "김나연", "1502": "김백호", "1503": "김의준", "1504": "박예준", "1505": "박준현", "1506": "방극찬", "1507": "양재우", "1508": "윤나경", "1509": "윤상현", "1510": "윤채원", "1511": "이승윤", "1512": "이준하", "1513": "장현우", "1514": "전준현", "1515": "최선", "1516": "홍재윤", "1517": "황윤찬", "1601": "강민겸", "1602": "강민균", "1603": "김건도", "1604": "김상현", "1605": "김주아", "1606": "김준호", "1607": "나연우", "1608": "박상원", "1609": "박윤후", "1610": "성준서", "1611": "안소이", "1612": "오주원", "1613": "이동준", "1614": "이채린", "1615": "정우진", "1616": "최준혁", "1617": "황의정", "2101": "고도균", "2102": "김동환", "2103": "김예슬", "2104": "김의겸", "2105": "박예찬", "2106": "박지윤", "2107": "서제나", "2108": "손명규", "2109": "안시준", "2110": "안재훈", "2111": "엄지우", "2112": "이승빈", "2113": "이지훈", "2114": "장인호", "2115": "정서범", "2201": "김서후", "2202": "김성윤", "2203": "김승현", "2204": "김은결", "2205": "박시후", "2206": "서준서", "2207": "성윤건", "2208": "신민규", "2209": "이소민", "2210": "이예인", "2211": "조승우", "2212": "최성준", "2213": "최아성", "2214": "최율", "2215": "최준서", "2301": "곽지원", "2302": "김민재", "2303": "남연우", "2304": "노유나", "2305": "박우주", "2306": "박주찬", "2307": "박지효", "2308": "이예서", "2309": "이재준", "2310": "정우성", "2311": "정원준", "2312": "천승준", "2313": "최서울", "2314": "추미강", "2315": "홍지민", "2401": "강승유", "2402": "구민준", "2403": "구성현", "2404": "권민재", "2405": "김민규", "2406": "김시현", "2407": "김태율", "2408": "박도윤", "2409": "박예완", "2410": "이시영", "2411": "이영휘", "2412": "장준혁", "2413": "장현준", "2414": "정원석", "2415": "정유태", "2416": "최준모", "2501": "강민석", "2502": "권미진", "2503": "김민율", "2504": "김민준", "2505": "김준", "2506": "김희찬", "2507": "문서욱", "2508": "안시후", "2509": "이현준", "2510": "임채원", "2511": "장민서", "2512": "장서율", "2513": "최여준", "2514": "허가은", "2515": "황유나", "2601": "김건우", "2602": "김도경", "2603": "김도현", "2604": "김동현", "2605": "김연호", "2606": "도현호", "2607": "류나현", "2608": "박건우", "2609": "박선율", "2610": "오세현", "2611": "우가희", "2612": "이민섭", "2613": "이선민", "2614": "주동준", "2615": "하승진", "3101": "김건희", "3102": "김태경", "3103": "박준우", "3104": "송우주", "3105": "신윤빈", "3106": "안성민", "3107": "이민재", "3108": "이솔민", "3109": "이지헌", "3110": "임태규", "3111": "정재현", "3112": "조용민", "3113": "지승후", "3114": "최승호", "3115": "홍채민", "3201": "강지환", "3202": "김민건", "3203": "김시찬", "3204": "김재윤", "3205": "김준형", "3206": "문시현", "3207": "박주원", "3208": "이우찬", "3209": "이재언", "3210": "장현준", "3211": "정유찬", "3212": "정주영", "3213": "최우진", "3214": "최휘성", "3215": "허진우", "3301": "김대훈", "3302": "김동현", "3303": "김아린", "3304": "김한교", "3305": "노연우", "3306": "로벨즈노아", "3307": "손자훈", "3308": "엄정우", "3309": "왕지환", "3310": "이시현", "3311": "이준현", "3312": "임지웅", "3313": "전지원", "3314": "조현수", "3315": "호준혁", "3401": "김민주", "3402": "김영주", "3403": "김우현", "3404": "김은서", "3405": "김재겸", "3406": "김형빈", "3407": "민동재", "3408": "손현우", "3409": "양동민", "3410": "온주승", "3411": "이도윤", "3412": "이원찬", "3413": "전대원", "3414": "조원준", "3415": "주현섭", "3416": "최원우", "3501": "공리영", "3502": "길은수", "3503": "김대현", "3504": "김동욱", "3505": "김지원", "3506": "류태현", "3507": "류한경", "3508": "박성호", "3509": "손지형", "3510": "염예승", "3511": "이윤승", "3512": "이은성", "3513": "이준우", "3514": "이진수", "3515": "전시현", "3516": "하대엽", "3601": "권윤재", "3602": "김시준", "3603": "김율", "3604": "김태우", "3605": "박성준", "3606": "박시원", "3607": "안혜우", "3608": "양다희", "3609": "유지원", "3610": "이상민", "3611": "이수연", "3612": "이지헌", "3613": "장유승", "3614": "전재형", "3615": "조준서", "3616": "채재현"
};

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [reservations, setReservations] = useState<any[]>([]);
  const [movieInfo, setMovieInfo] = useState<any>(null);
  
  
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const[editForm, setEditForm] = useState<any>({});
  
  // 🌟 [추가됨] 상영관 변경 경고 모달 제어 상태
  const [showVenueWarning, setShowVenueWarning] = useState(false);

  const [logs, setLogs] = useState<any[]>([]);
  const[showLogs, setShowLogs] = useState(false);

  const[blacklist, setBlacklist] = useState<any[]>([]);
  const [newBlackId, setNewBlackId] = useState('');

  const [promoTargets, setPromoTargets] = useState({ grade1: false, grade2: false, grade3: false, staff: false, test: true });
  const [isSendingPromo, setIsSendingPromo] = useState(false);
  const [promoProgress, setPromoProgress] = useState({ current: 0, total: 0 });

  const[singleTarget, setSingleTarget] = useState("");
  const POPCORN_NAMES: Record<string, string> = { original: '오리지널 버터', consomme: '콘소메맛', caramel: '카라멜맛', none: 'X' };
  
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const ADMIN_PASSWORD = "영화대교최고"; 



  useEffect(() => {
    if (isAuthenticated) fetchAdminData();
  }, [isAuthenticated]);

  const fetchAdminData = async () => {
    const { data: movieData } = await supabase.from('movie_settings').select('*').eq('id', 1).single();
    if (movieData) {
      setMovieInfo(movieData);
      setEditForm({
        ...movieData,
        // 혹시 DB에 아직 없는 상태라면 기본값 할당
        mid_vip_start_row: movieData.mid_vip_start_row || 'A',
        mid_vip_end_row: movieData.mid_vip_end_row || 'C',
        mid_vip_start_col: movieData.mid_vip_start_col || 5,
        mid_vip_end_col: movieData.mid_vip_end_col || 10,
        grand_vip_start_row: movieData.grand_vip_start_row || 'A',
        grand_vip_end_row: movieData.grand_vip_end_row || 'C',
        grand_vip_start_col: movieData.grand_vip_start_col || 10,
        grand_vip_end_col: movieData.grand_vip_end_col || 18,
      });
      const { data: resData } = await supabase.from('reservations').select('*').eq('movie_date', movieData.db_date).order('created_at', { ascending: false });
      if (resData) setReservations(resData);
    }
    const { data: blData } = await supabase.from('blacklist').select('*').order('created_at', { ascending: false });
    if (blData) setBlacklist(blData);
    
    const { data: logData } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (logData) setLogs(logData);
  };

  // 🌟 [추가됨] 저장 버튼 클릭 시 장소 변경 여부 감지
  const handleSaveSettingsClick = () => {
    if (editForm.venue !== movieInfo.venue) {
      setShowVenueWarning(true); // 장소가 바뀌었으면 경고창 띄우기
    } else {
      proceedSave(false); // 안 바뀌었으면 바로 저장
    }
  };

  // 🌟 [추가됨] 실제 DB에 저장하는 함수
  const proceedSave = async (isVenueChanged: boolean) => {
    const { error } = await supabase.from('movie_settings').update({
      title: editForm.title, date_string: editForm.date_string, db_date: editForm.db_date,
      venue: editForm.venue, poster_url: editForm.poster_url, deadline_date: editForm.deadline_date,
      mid_vip_start_row: editForm.mid_vip_start_row, mid_vip_end_row: editForm.mid_vip_end_row,
      mid_vip_start_col: editForm.mid_vip_start_col, mid_vip_end_col: editForm.mid_vip_end_col,
      grand_vip_start_row: editForm.grand_vip_start_row, grand_vip_end_row: editForm.grand_vip_end_row,
      grand_vip_start_col: editForm.grand_vip_start_col, grand_vip_end_col: editForm.grand_vip_end_col
    }).eq('id', 1);

    if (error) {
      alert("설정 저장 실패: " + error.message);
    } else {
      // 🌟 [핵심] 장소가 바뀌었다면 모든 예매 내역 폭파 (이메일 발송 안함)
      if (isVenueChanged) {
        await supabase.from('reservations').delete().eq('movie_date', movieInfo.db_date);
        alert("🚨 상영관 변경 및 예매 내역 초기화가 완료되었습니다.");
      } else {
        alert("✅ 설정이 성공적으로 저장되었습니다!");
      }
      setShowVenueWarning(false);
      setIsEditingSettings(false);
      fetchAdminData();
    }
  };

  const handleApprove = async (ticket: any) => {
    if (!confirm(`${ticket.student_name}님의 예매를 확정하시겠습니까?`)) return;
    await supabase.from('reservations').update({ payment_status: 'confirmed' }).eq('id', ticket.id);
    await supabase.from('activity_logs').insert([{ student_id: ticket.student_id, student_name: ticket.student_name, description: `관리자 승인 (${ticket.seat_number})` }]);
    const userEmail = ticket.student_id === "교직원" ? USER_EMAILS[ticket.student_name] : USER_EMAILS[ticket.student_id];
    if (userEmail) {
      await fetch('/api/ticket', { method: 'POST', body: JSON.stringify({ email: userEmail, name: ticket.student_name, seat: ticket.seat_number, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, statusType: 'confirmed', popcorn: ticket.popcorn_order, ticketId: ticket.id, baseUrl }) });
    }
    alert("승인 완료 및 이메일 발송됨!"); fetchAdminData();
  };

  const handleCancel = async (ticket: any) => {
    if (!confirm(`정말 ${ticket.student_name}님의 예매를 취소하시겠습니까?`)) return;
    
    await supabase.from('reservations').delete().eq('id', ticket.id);

    // 🌟 단일 로그 기록 보장!
    await supabase.from('activity_logs').insert([{ student_id: ticket.student_id, student_name: ticket.student_name, description: `관리자 강제 취소 (${ticket.seat_number})` }]);

    const userEmail = ticket.student_id === "교직원" ? USER_EMAILS[ticket.student_name] : USER_EMAILS[ticket.student_id];
    if (userEmail) {
      // 🌟 환불 필요 여부 계산
      const isRefundNeeded = ticket.popcorn_order !== 'none' && ticket.payment_status === 'confirmed';
      
      await fetch('/api/ticket', { 
        method: 'POST', 
        body: JSON.stringify({ 
          email: userEmail, name: ticket.student_name, seat: ticket.seat_number, 
          movieTitle: movieInfo.title, movieDate: movieInfo.date_string, 
          statusType: 'canceled', popcorn: ticket.popcorn_order, ticketId: ticket.id, 
          baseUrl, isRefundNeeded 
        }) 
      });
    }
    alert("취소 완료 및 이메일 발송됨!"); fetchAdminData();
  };

  const handleAddBlacklist = async () => {
    if(newBlackId.length !== 4) return alert("학번 4자리를 정확히 입력해주세요.");
    const studentName = STUDENT_LIST[newBlackId];
    if(!studentName) return alert("존재하지 않는 학번입니다.");
    
    if(!confirm(`${studentName}(${newBlackId}) 학생을 블랙리스트에 추가하시겠습니까?\n(⚠️ 주의: 현재 진행 중이거나 완료된 예매 내역이 있다면 자동으로 취소됩니다.)`)) return;
    
    const { error } = await supabase.from('blacklist').insert([{ student_id: newBlackId, student_name: studentName }]);
    if (error) return alert("추가 실패 (이미 등록된 학생일 수 있습니다.)");

    const userEmail = USER_EMAILS[newBlackId];

    const { data: existingTickets } = await supabase.from('reservations').select('*').eq('student_id', newBlackId).eq('movie_date', movieInfo.db_date);

    if (existingTickets && existingTickets.length > 0) {
      const ticket = existingTickets[0];
      await supabase.from('reservations').delete().eq('id', ticket.id);
      
      // 🌟 단일 로그 기록 보장!
      await supabase.from('activity_logs').insert([{ student_id: newBlackId, student_name: studentName, description: `블랙리스트 등록 및 예매 강제 취소 (${ticket.seat_number})` }]);
      
      if (userEmail) {
        // 🌟 환불 필요 여부 계산
        const isRefundNeeded = ticket.popcorn_order !== 'none' && ticket.payment_status === 'confirmed';
        
        await fetch('/api/ticket', { 
          method: 'POST', 
          body: JSON.stringify({ 
            email: userEmail, name: studentName, seat: ticket.seat_number, 
            movieTitle: movieInfo.title, movieDate: movieInfo.date_string, 
            statusType: 'canceled', popcorn: ticket.popcorn_order, ticketId: ticket.id, 
            baseUrl, isRefundNeeded
          }) 
        });
      }
    }

    if (userEmail) {
      await fetch('/api/blacklist', { method: 'POST', body: JSON.stringify({ email: userEmail, name: studentName, action: 'added' }) });
    }
    
    alert("블랙리스트 추가 및 예매 자동 취소 처리가 완료되었습니다!"); setNewBlackId(''); fetchAdminData();
  };

  const handleSendPromo = async () => {
    const recipientMap = new Map();
    
    // 1. 테스트 계정 추가 (가장 최우선)
    if (promoTargets.test && USER_EMAILS["2208"]) {
      recipientMap.set("2208", { email: USER_EMAILS["2208"], name: "신민규" });
    }
    
    // 🌟 2. 드롭다운에서 선택한 특정 개인 추가
    if (singleTarget && USER_EMAILS[singleTarget]) {
      const name = isNaN(Number(singleTarget)) ? singleTarget : STUDENT_LIST[singleTarget] || "학생";
      recipientMap.set(singleTarget, { email: USER_EMAILS[singleTarget], name });
    }
    
    // 3. 체크된 학년/교직원 스캔 및 수집
    Object.keys(USER_EMAILS).forEach(key => {
      let shouldAdd = false;
      if (promoTargets.grade1 && key.startsWith('1') && key.length === 4) shouldAdd = true;
      if (promoTargets.grade2 && key.startsWith('2') && key.length === 4) shouldAdd = true;
      if (promoTargets.grade3 && key.startsWith('3') && key.length === 4) shouldAdd = true;
      if (promoTargets.staff && isNaN(Number(key))) shouldAdd = true;

      if (shouldAdd) {
        // 이미 테스트로 추가된 2208은 중복 방지를 위해 알아서 덮어써집니다.
        const name = isNaN(Number(key)) ? key : STUDENT_LIST[key] || "학생";
        recipientMap.set(key, { email: USER_EMAILS[key], name });
      }
    });

    const recipients = Array.from(recipientMap.values());
    
    if (recipients.length === 0) return alert("선택된 발송 대상이 없습니다.");
    if (!confirm(`총 ${recipients.length}명에게 홍보 메일을 발송하시겠습니까?\n(인원이 많을 경우 수십 초 정도 소요될 수 있습니다.)`)) return;

    setIsSendingPromo(true);
    setPromoProgress({ current: 0, total: recipients.length });

    // 🌟 안전 장치: 한 번에 15명씩만 보내고 1초 쉬기 (Gmail 블락 및 Vercel 타임아웃 완벽 방어)
    const CHUNK_SIZE = 15; 
    for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
      const chunk = recipients.slice(i, i + CHUNK_SIZE);
      try {
        await fetch('/api/promo', {
          method: 'POST',
          body: JSON.stringify({ chunk, movieInfo, baseUrl })
        });
      } catch (err) {
        console.error("메일 발송 에러:", err);
      }
      // 진행도 업데이트
      setPromoProgress({ current: Math.min(i + CHUNK_SIZE, recipients.length), total: recipients.length });
      
      // 다음 묶음을 보내기 전 1초 대기
      await new Promise(res => setTimeout(res, 1000)); 
    }

    // 로그 기록
    await supabase.from('activity_logs').insert([{ student_id: "관리자", student_name: "-", description: `홍보 이메일 발송 완료 (${recipients.length}명)` }]);

    setIsSendingPromo(false);
    alert("✅ 홍보 메일 발송이 안전하게 완료되었습니다!");
    fetchAdminData();
  };

  const handleRemoveBlacklist = async (studentId: string, studentName: string) => {
    if(!confirm(`${studentName}(${studentId}) 학생의 블랙리스트를 해제하시겠습니까?`)) return;
    await supabase.from('blacklist').delete().eq('student_id', studentId);
    const userEmail = USER_EMAILS[studentId];
    if (userEmail) await fetch('/api/blacklist', { method: 'POST', body: JSON.stringify({ email: userEmail, name: studentName, action: 'removed' }) });
    alert("해제 완료 및 안내 메일 발송!"); fetchAdminData();
  };

  if (!isAuthenticated) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-xl max-w-sm w-full text-center border border-gray-700">
        <h1 className="text-2xl font-bold text-white mb-6">🔒 관리자 로그인</h1>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && password === ADMIN_PASSWORD && setIsAuthenticated(true)} className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 mb-4 text-center" placeholder="비밀번호 입력" />
        <button onClick={() => password === ADMIN_PASSWORD ? setIsAuthenticated(true) : alert('비밀번호가 틀렸습니다.')} className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold">접속하기</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 relative">
      {/* 🚨 상영관 변경 붉은색 경고 모달 */}
      {showVenueWarning && (
        <div className="fixed inset-0 bg-red-900/90 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-red-950 p-8 rounded-2xl max-w-lg border-4 border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.5)] text-center">
            <h2 className="text-4xl font-black text-white mb-4 animate-pulse">🚨 절대 주의 🚨</h2>
            <div className="text-red-200 text-lg font-bold space-y-4 mb-8">
              <p>현재 <span className="text-white text-xl">[{movieInfo.venue}]</span> 에서 <span className="text-white text-xl">[{editForm.venue}]</span> (으)로 상영관을 변경하려고 합니다.</p>
              <p className="bg-red-900 p-4 rounded-xl text-white">상영관이 변경되면 현재까지 예약된<br/><span className="text-3xl text-yellow-300">모든 예매 내역이 즉시 영구 삭제</span>됩니다.<br/><span className="text-sm font-normal text-red-300">(학생들에게 취소 메일은 발송되지 않습니다)</span></p>
              <p>정말 모든 데이터를 초기화하고 상영관을 변경하시겠습니까?</p>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setShowVenueWarning(false)} className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 rounded-xl text-white font-bold text-lg">돌아가기 (취소)</button>
              <button onClick={() => proceedSave(true)} className="flex-1 py-4 bg-red-600 hover:bg-red-500 rounded-xl text-white font-bold text-lg shadow-[0_0_15px_rgba(239,68,68,0.8)]">초기화 및 변경</button>
            </div>
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
      
      {/* 시스템 활동 로그 창 */}
      {showLogs && (
        <div className="bg-gray-900 border border-gray-700 p-6 rounded-xl shadow-2xl mb-8 max-h-[500px] overflow-y-auto">
          <h2 className="text-xl font-bold text-blue-400 mb-4 sticky top-0 bg-gray-900 py-2 border-b border-gray-800">
            📜 시스템 활동 로그 <span className="text-sm text-gray-500 font-normal ml-2">(최근 100건)</span>
          </h2>
          <div className="space-y-1 font-mono text-[13px] md:text-sm">
            {logs.length === 0 && <p className="text-gray-500">기록된 로그가 없습니다.</p>}
            {logs.map((log) => {
              const d = new Date(log.created_at);
              const dateStr = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}. ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
              
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
          <div><label className="block text-sm text-gray-400 mb-1">영화 제목</label><input type="text" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none"/></div>
          <div><label className="block text-sm text-gray-400 mb-1">상영 일시 (화면 표시용)</label><input type="text" value={editForm.date_string} onChange={e => setEditForm({...editForm, date_string: e.target.value})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none"/></div>
          <div><label className="block text-sm text-gray-400 mb-1">DB 기준 날짜 (YYYY-MM-DD)</label><input type="text" value={editForm.db_date} onChange={e => setEditForm({...editForm, db_date: e.target.value})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none"/></div>
          
          {/* 🌟 상영관 드롭다운 */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">상영 장소 (주의: 변경 시 내역 폭파됨)</label>
            <select value={editForm.venue} onChange={e => setEditForm({...editForm, venue: e.target.value})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-purple-500 outline-none">
              <option value="대구과학고등학교 중강당">중강당 (14x9 배열)</option>
              <option value="대구과학고등학교 대강당">대강당 (27x18 배열)</option>
            </select>
          </div>

          <div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-1">포스터 주소</label><input type="text" value={editForm.poster_url} onChange={e => setEditForm({...editForm, poster_url: e.target.value})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none"/></div>
          <div className="md:col-span-2"><label className="block text-sm text-red-400 font-bold mb-1">예매 마감 일시 (ISO 형식)</label><input type="text" value={editForm.deadline_date} onChange={e => setEditForm({...editForm, deadline_date: e.target.value})} className="w-full p-2 bg-gray-700 rounded border border-red-800 outline-none"/></div>
          
          {/* 🌟 장소별 VIP 설정 구역 */}
          <div className="md:col-span-2 mt-4"><h3 className="text-indigo-400 font-bold border-b border-gray-700 pb-2 mb-2">동아리 전용(VIP) - 🟦 중강당 기준</h3></div>
          <div className="flex gap-2">
            <div className="flex-1"><label className="block text-xs text-gray-400 mb-1">시작 행 (A~I)</label><input type="text" maxLength={1} value={editForm.mid_vip_start_row} onChange={e => setEditForm({...editForm, mid_vip_start_row: e.target.value.toUpperCase()})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-center"/></div>
            <div className="flex-1"><label className="block text-xs text-gray-400 mb-1">끝 행 (A~I)</label><input type="text" maxLength={1} value={editForm.mid_vip_end_row} onChange={e => setEditForm({...editForm, mid_vip_end_row: e.target.value.toUpperCase()})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-center"/></div>
            <div className="flex-1"><label className="block text-xs text-gray-400 mb-1">시작 열 (1~14)</label><input type="number" value={editForm.mid_vip_start_col} onChange={e => setEditForm({...editForm, mid_vip_start_col: parseInt(e.target.value)})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-center"/></div>
            <div className="flex-1"><label className="block text-xs text-gray-400 mb-1">끝 열 (1~14)</label><input type="number" value={editForm.mid_vip_end_col} onChange={e => setEditForm({...editForm, mid_vip_end_col: parseInt(e.target.value)})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-center"/></div>
          </div>

          <div className="md:col-span-2 mt-4"><h3 className="text-pink-400 font-bold border-b border-gray-700 pb-2 mb-2">동아리 전용(VIP) - 🟥 대강당 기준</h3></div>
          <div className="flex gap-2">
            <div className="flex-1"><label className="block text-xs text-gray-400 mb-1">시작 행 (A~R)</label><input type="text" maxLength={1} value={editForm.grand_vip_start_row} onChange={e => setEditForm({...editForm, grand_vip_start_row: e.target.value.toUpperCase()})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-center"/></div>
            <div className="flex-1"><label className="block text-xs text-gray-400 mb-1">끝 행 (A~R)</label><input type="text" maxLength={1} value={editForm.grand_vip_end_row} onChange={e => setEditForm({...editForm, grand_vip_end_row: e.target.value.toUpperCase()})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-center"/></div>
            <div className="flex-1"><label className="block text-xs text-gray-400 mb-1">시작 열 (1~27)</label><input type="number" value={editForm.grand_vip_start_col} onChange={e => setEditForm({...editForm, grand_vip_start_col: parseInt(e.target.value)})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-center"/></div>
            <div className="flex-1"><label className="block text-xs text-gray-400 mb-1">끝 열 (1~27)</label><input type="number" value={editForm.grand_vip_end_col} onChange={e => setEditForm({...editForm, grand_vip_end_col: parseInt(e.target.value)})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-center"/></div>
          </div>
          
          <div className="md:col-span-2 mt-4 text-right"><button onClick={handleSaveSettingsClick} className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg">💾 변경사항 저장</button></div>
        </div>
      )}

      {/* 블랙리스트 관리 패널 */}
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

      <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-blue-600 mb-8">
        <h2 className="text-xl font-bold text-blue-400 mb-4">📧 상영작 홍보 메일 발송</h2>
        <div className="flex flex-wrap gap-6 mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={promoTargets.grade1} onChange={e => setPromoTargets({...promoTargets, grade1: e.target.checked})} className="w-5 h-5 accent-blue-600" /> <span className="text-gray-300 font-bold">1학년</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={promoTargets.grade2} onChange={e => setPromoTargets({...promoTargets, grade2: e.target.checked})} className="w-5 h-5 accent-blue-600" /> <span className="text-gray-300 font-bold">2학년</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={promoTargets.grade3} onChange={e => setPromoTargets({...promoTargets, grade3: e.target.checked})} className="w-5 h-5 accent-blue-600" /> <span className="text-gray-300 font-bold">3학년</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={promoTargets.staff} onChange={e => setPromoTargets({...promoTargets, staff: e.target.checked})} className="w-5 h-5 accent-blue-600" /> <span className="text-gray-300 font-bold">교직원</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer border-l-2 border-gray-600 pl-6 ml-2">
            <input type="checkbox" checked={promoTargets.test} onChange={e => setPromoTargets({...promoTargets, test: e.target.checked})} className="w-5 h-5 accent-purple-600" /> <span className="text-purple-400 font-bold">테스트용 (2208 신민규)</span>
          </label>
        </div>
        
        <div className="mb-6 p-4 bg-gray-700/50 rounded-xl border border-gray-600">
          <label className="block text-gray-300 mb-2 text-sm font-bold">🎯 특정 1인에게만 보내기 (선택)</label>
          <select 
            value={singleTarget} 
            onChange={e => setSingleTarget(e.target.value)} 
            className="w-full p-3 bg-gray-800 text-white rounded-lg border border-gray-600 outline-none focus:border-blue-500"
          >
            <option value="">-- 개인 발송 안 함 (위에 체크된 그룹에게만 발송) --</option>
            
            <optgroup label="👩‍🏫 교직원">
              {Object.keys(USER_EMAILS).filter(k => isNaN(Number(k))).sort().map(staff => (
                <option key={staff} value={staff}>{staff}</option>
              ))}
            </optgroup>
            <optgroup label="🎓 1학년">
              {Object.keys(USER_EMAILS).filter(k => k.startsWith('1') && k.length === 4).sort().map(id => (
                <option key={id} value={id}>{id} {STUDENT_LIST[id]}</option>
              ))}
            </optgroup>
            <optgroup label="🎓 2학년">
              {Object.keys(USER_EMAILS).filter(k => k.startsWith('2') && k.length === 4).sort().map(id => (
                <option key={id} value={id}>{id} {STUDENT_LIST[id]}</option>
              ))}
            </optgroup>
            <optgroup label="🎓 3학년">
              {Object.keys(USER_EMAILS).filter(k => k.startsWith('3') && k.length === 4).sort().map(id => (
                <option key={id} value={id}>{id} {STUDENT_LIST[id]}</option>
              ))}
            </optgroup>
          </select>
          <p className="text-xs text-blue-300 mt-2">
            ※ 위쪽 체크박스를 모두 해제하고 여기서 한 명만 선택하면, 해당 사람에게만 1통이 발송됩니다.
          </p>
        </div>
        
        {isSendingPromo ? (
          <div className="w-full bg-gray-700 rounded-full h-8 relative overflow-hidden border border-gray-600">
            <div className="bg-blue-600 h-8 transition-all duration-300 flex items-center justify-center" style={{ width: `${(promoProgress.current / promoProgress.total) * 100}%` }}></div>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white drop-shadow-md">
              안전 발송 중... ({promoProgress.current} / {promoProgress.total})
            </span>
          </div>
        ) : (
          <button onClick={handleSendPromo} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg rounded-xl shadow-lg transition-colors">
            🚀 체크한 대상에게 홍보 메일 발송하기
          </button>
        )}
      </div>
      
      {/* 예매 내역 테이블 */}
      <div className="bg-gray-800 rounded-xl overflow-x-auto shadow-2xl border border-gray-700">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-gray-700 text-gray-300">
            <tr>
              <th className="p-4">상태</th><th className="p-4">좌석</th><th className="p-4">학번/이름</th><th className="p-4">팝콘</th><th className="p-4 text-right">관리 작업</th>
            </tr>
          </thead>
          <tbody>
            {reservations.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-500">예매 내역이 없습니다.</td></tr>}
            {reservations.map((ticket) => (
              <tr key={ticket.id} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="p-4">{ticket.payment_status === 'pending' ? <span className="bg-yellow-600/20 text-yellow-500 px-2 py-1 rounded border border-yellow-600">입금 대기</span> : <span className="bg-green-600/20 text-green-500 px-2 py-1 rounded border border-green-600">확정됨</span>}</td>
                <td className="p-4 font-bold text-lg">{ticket.seat_number}</td>
                <td className="p-4">{ticket.student_id} <span className="text-blue-300">{ticket.student_name}</span></td>
                <td className="p-4 text-xs">{ticket.popcorn_order !== 'none' ? `🍿 ${POPCORN_NAMES[ticket.popcorn_order]}` : 'X'}</td>
                <td className="p-4 text-right flex justify-end gap-2">
                  {ticket.payment_status === 'pending' && <button onClick={() => handleApprove(ticket)} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded font-bold">✅ 승인</button>}
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
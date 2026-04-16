"use client";

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { USER_EMAILS } from '../lib/emails';
import Link from 'next/link'; // 🌟[추가] Next.js Link 임포트


const STUDENT_LIST: Record<string, string> = {
  "1101": "김세준", "1102": "김시우", "1103": "김연우", "1104": "김윤재", "1105": "박시현", "1106": "배하준", "1107": "손민재", "1108": "이동건", "1109": "이주원", "1110": "이주형", "1111": "이지훈", "1112": "이하은", "1113": "전시윤", "1114": "정윤재", "1115": "차승민", "1116": "최은성",
  "1201": "김민우", "1202": "김민찬", "1203": "김시현", "1204": "김현서", "1205": "김현성", "1206": "류도헌", "1207": "배성호", "1208": "손시흔", "1209": "옥지훈", "1210": "이건우", "1211": "임해준", "1212": "장민하", "1213": "주지환", "1214": "최우진", "1215": "최윤서", "1216": "최정원", "1217": "최지요",
  "1301": "강도겸", "1302": "고민석", "1303": "김희정", "1304": "박라원", "1305": "박준영", "1306": "신강우", "1307": "신동희", "1308": "오경택", "1309": "윤정우", "1310": "이민희", "1311": "이승현", "1312": "이시안", "1313": "이희승", "1314": "임용준", "1315": "정재우", "1316": "조현찬", "1317": "천현서",
  "1401": "권예준", "1402": "김보미", "1403": "김율", "1404": "김학현", "1405": "문도윤", "1406": "박기준", "1407": "박지성", "1408": "배채준", "1409": "서현우", "1410": "윤영식", "1411": "이건우", "1412": "이민결", "1413": "전시후", "1414": "조민준", "1415": "조은준", "1416": "최미성", "1417": "하시원",
  "1501": "김나연", "1502": "김백호", "1503": "김의준", "1504": "박예준", "1505": "박준현", "1506": "방극찬", "1507": "양재우", "1508": "윤나경", "1509": "윤상현", "1510": "윤채원", "1511": "이승윤", "1512": "이준하", "1513": "장현우", "1514": "전준현", "1515": "최선", "1516": "홍재윤", "1517": "황윤찬",
  "1601": "강민겸", "1602": "강민균", "1603": "김건도", "1604": "김상현", "1605": "김주아", "1606": "김준호", "1607": "나연우", "1608": "박상원", "1609": "박윤후", "1610": "성준서", "1611": "안소이", "1612": "오주원", "1613": "이동준", "1614": "이채린", "1615": "정우진", "1616": "최준혁", "1617": "황의정",
  "2101": "고도균", "2102": "김동환", "2103": "김예슬", "2104": "김의겸", "2105": "박예찬", "2106": "박지윤", "2107": "서제나", "2108": "손명규", "2109": "안시준", "2110": "안재훈", "2111": "엄지우", "2112": "이승빈", "2113": "이지훈", "2114": "장인호", "2115": "정서범",
  "2201": "김서후", "2202": "김성윤", "2203": "김승헌", "2204": "김은결", "2205": "박시후", "2206": "서준서", "2207": "성윤건", "2208": "신민규", "2209": "이소민", "2210": "이예인", "2211": "조승우", "2212": "최성준", "2213": "최아성", "2214": "최율", "2215": "최준서",
  "2301": "곽지원", "2302": "김민재", "2303": "남연우", "2304": "노유나", "2305": "박우주", "2306": "박주찬", "2307": "박지효", "2308": "이예서", "2309": "이재준", "2310": "정우성", "2311": "정원준", "2312": "천승준", "2313": "최서울", "2314": "추미강", "2315": "홍지민",
  "2401": "강승유", "2402": "구민준", "2403": "구성현", "2404": "권민재", "2405": "김민규", "2406": "김시헌", "2407": "김태율", "2408": "박도윤", "2409": "박예완", "2410": "이시영", "2411": "이영휘", "2412": "장준혁", "2413": "장현준", "2414": "정원석", "2415": "정유태", "2416": "최준모",
  "2501": "강민석", "2502": "권미진", "2503": "김민율", "2504": "김민준", "2505": "김준", "2506": "김희찬", "2507": "문서욱", "2508": "안시후", "2509": "이현준", "2510": "임채원", "2511": "장민서", "2512": "장서율", "2513": "최여준", "2514": "허가은", "2515": "황유나",
  "2601": "김건우", "2602": "김도경", "2603": "김도현", "2604": "김동현", "2605": "김연호", "2606": "도현호", "2607": "류나현", "2608": "박건우", "2609": "박선율", "2610": "오세현", "2611": "우가희", "2612": "이민섭", "2613": "이선민", "2614": "주동준", "2615": "하승진",
  "3101": "김건희", "3102": "김태경", "3103": "박준우", "3104": "송우주", "3105": "신윤빈", "3106": "안성민", "3107": "이민재", "3108": "이솔민", "3109": "이지헌", "3110": "임태규", "3111": "정재현", "3112": "조용민", "3113": "지승후", "3114": "최승호", "3115": "홍채민",
  "3201": "강지환", "3202": "김민건", "3203": "김시찬", "3204": "김재윤", "3205": "김준형", "3206": "문시현", "3207": "박주원", "3208": "이우찬", "3209": "이재언", "3210": "장현준", "3211": "정유찬", "3212": "정주영", "3213": "최우진", "3214": "최휘성", "3215": "허진우",
  "3301": "김대훈", "3302": "김동현", "3303": "김아린", "3304": "김한교", "3305": "노연우", "3306": "로벨즈노아", "3307": "손자훈", "3308": "엄정우", "3309": "왕지환", "3310": "이시현", "3311": "이준현", "3312": "임지웅", "3313": "전지원", "3314": "조현수", "3315": "호준혁",
  "3401": "김민주", "3402": "김영주", "3403": "김우현", "3404": "김은서", "3405": "김재겸", "3406": "김형빈", "3407": "민동재", "3408": "손현우", "3409": "양동민", "3410": "온주승", "3411": "이도윤", "3412": "이원찬", "3413": "전대원", "3414": "조원준", "3415": "주현섭", "3416": "최원우",
  "3501": "공리영", "3502": "길은수", "3503": "김대현", "3504": "김동욱", "3505": "김지원", "3506": "류태현", "3507": "류한경", "3508": "박성호", "3509": "손지형", "3510": "염예승", "3511": "이윤승", "3512": "이은성", "3513": "이준우", "3514": "이진수", "3515": "전시현", "3516": "하대엽",
  "3601": "권윤재", "3602": "김시준", "3603": "김율", "3604": "김태우", "3605": "박성준", "3606": "박시원", "3607": "안혜우", "3608": "양다희", "3609": "유지원", "3610": "이상민", "3611": "이수연", "3612": "이지헌", "3613": "장유승", "3614": "전재형", "3615": "조준서", "3616": "채재현"
};

const STAFF_LIST =[
  "강윤석", "권순정", "김가은", "김동우", "김미정", "김민정", "김상용", "김선옥", "김성진", "김수정", "김승철", "김윤주", "김정석", "김제훈", "김종수", "김종하", "김현심", "도동현", "류상욱", "마예리", "문우현", "박나연", "박소영", "박순덕", "박영희", "박정수", "박준홍", "박진환", "박현숙", "박홍", "배태윤", "백은희", "서미경", "서승은", "손영호", "손중록", "송미희", "송석준", "전리해", "엄경애", "옥창규", "우태성", "우희정", "윤소영", "윤수진", "윤정호", "이계화", "이민아", "이상규", "이승재", "이용호", "이윤아", "이재용", "이재욱", "이재웅", "이주열", "이준구", "이준열", "이지영", "이태현", "이형준", "전경희", "정재환", "정진실", "정휘정", "조우주", "조유경", "주혜령", "채대철", "최유리", "최재선", "추재석", "추철우", "허완규", "홍현주", "황영순"
];

const CLUB_MEMBERS =["2101", "2109", "2115", "2208", "2305", "2412", "2507", "2509", "2605", "2606"];

interface SeatData {
  status: string;
  name: string;
  ticketId: string;
}



export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const[selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const[isModalOpen, setIsModalOpen] = useState(false);
  
  const [seatStatuses, setSeatStatuses] = useState<Record<string, SeatData>>({});
  const [blacklistedUsers, setBlacklistedUsers] = useState<string[]>([]);
  
  const [isClosed, setIsClosed] = useState(false);

  const[movieInfo, setMovieInfo] = useState({
    title: "로딩 중...", date_string: "로딩 중...", db_date: "", venue: "대구과학고등학교 중강당",
    age_rating: "전체관람가", // 🌟 [추가됨]
    poster_url: "/poster.jpg", deadline_date: "2099-12-31T23:59:00+09:00",
    mid_vip_start_row: "A", mid_vip_end_row: "C", mid_vip_start_col: 5, mid_vip_end_col: 10,
    grand_vip_start_row: "A", grand_vip_end_row: "C", grand_vip_start_col: 10, grand_vip_end_col: 18
  });
  
  const[formData, setFormData] = useState({ studentId: '', name: '', password: '' });
  
  const[showResetButton, setShowResetButton] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [clickedSeatInfo, setClickedSeatInfo] = useState<{seatId: string, status: string, ticketId: string} | null>(null);

  const [alertInfo, setAlertInfo] = useState<{message: string, isError: boolean} | null>(null);
  const [confirmInfo, setConfirmInfo] = useState<{message: string, onConfirm: () => void} | null>(null);
  const [successInfo, setSuccessInfo] = useState<{title: string, message: string} | null>(null);

  const showAlert = (message: string, isError = true) => setAlertInfo({ message, isError });
  const showConfirm = (message: string, onConfirm: () => void) => setConfirmInfo({ message, onConfirm });
  const showSuccess = (title: string, message: string) => setSuccessInfo({ title, message });

  const isGrandHall = movieInfo.venue.includes('대강당');
  
  const rows = isGrandHall 
    ?['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R'] 
    :['A','B','C','D','E','F','G','H','I']; 

  const cols = isGrandHall 
    ? Array.from({ length: 27 }, (_, i) => i + 1) 
    : Array.from({ length: 14 }, (_, i) => i + 1); 

  const getSeatId = (rowIndex: number, colIndex: number) => {
    if (!isGrandHall) { 
      if (colIndex < 7) { 
        const num = rowIndex * 7 + colIndex + 1;
        return `A${String(num).padStart(2, '0')}`;
      } else {
        const num = rowIndex * 7 + (colIndex - 7) + 1;
        if (num === 63) return null; 
        return `B${String(num).padStart(2, '0')}`;
      }
    } else {
      if (colIndex < 9) {
        const num = rowIndex * 9 + colIndex + 1;
        return `A${String(num).padStart(3, '0')}`;
      } else if (colIndex < 18) {
        const num = rowIndex * 9 + (colIndex - 9) + 1;
        return `B${String(num).padStart(3, '0')}`;
      } else {
        const num = rowIndex * 9 + (colIndex - 18) + 1;
        return `C${String(num).padStart(3, '0')}`;
      }
    }
  };

  const vipSeats = useMemo(() => {
    const vips = new Set<string>();
    rows.forEach((rowChar, rowIndex) => {
      cols.forEach((colNum, colIndex) => {
        const isVip = isGrandHall
          ? rowChar.charCodeAt(0) >= (movieInfo.grand_vip_start_row || 'A').charCodeAt(0) &&
            rowChar.charCodeAt(0) <= (movieInfo.grand_vip_end_row || 'C').charCodeAt(0) &&
            colNum >= (movieInfo.grand_vip_start_col || 10) &&
            colNum <= (movieInfo.grand_vip_end_col || 18)
          : rowChar.charCodeAt(0) >= (movieInfo.mid_vip_start_row || 'A').charCodeAt(0) &&
            rowChar.charCodeAt(0) <= (movieInfo.mid_vip_end_row || 'C').charCodeAt(0) &&
            colNum >= (movieInfo.mid_vip_start_col || 5) &&
            colNum <= (movieInfo.mid_vip_end_col || 10);
            
        if (isVip) {
          const seatId = getSeatId(rowIndex, colIndex);
          if (seatId) vips.add(seatId);
        }
      });
    });
    return vips;
  }, [movieInfo, isGrandHall, rows, cols]);

  const [inviteName, setInviteName] = useState("");
  const [isManualOpen, setIsManualOpen] = useState(false);

  // 🌟 [단체 예매] Group Mode 상태 관리
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [groupLeader, setGroupLeader] = useState<{studentId: string, name: string, password: string, seat: string} | null>(null);
  const [groupMembers, setGroupMembers] = useState<{studentId: string, name: string, seat: string}[]>([]);
  const [isGroupMemberModal, setIsGroupMemberModal] = useState(false);
  const [memberFormData, setMemberFormData] = useState({studentId: '', name: ''});
  const [isGroupSummaryOpen, setIsGroupSummaryOpen] = useState(false);
  const [groupSendingProgress, setGroupSendingProgress] = useState({current: 0, total: 0, sending: false});

  useEffect(() => {
    fetchInitialData();
  },[]);

  // 🌟 [추가됨] VIP 초청 링크를 통한 접근 시 데이터 자동 채우기
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('invite') === 'true') {
        let paramId = params.get('id') || '';
        let paramName = params.get('name') || '';
        
        if (paramId === 'undefined' || paramId === 'null') paramId = '';
        if (paramName === 'undefined' || paramName === 'null') paramName = '';

        if (paramId || paramName) {
          // 🍎 [추가됨] 숫자가 아닌 학번(교직원/관리자 등)은 '교직원'으로 표시합니다.
          const finalId = (paramId && isNaN(Number(paramId))) ? '교직원' : paramId;
          setFormData(prev => ({ ...prev, studentId: finalId, name: paramName }));
          if (paramName) setInviteName(paramName);
        }
        // 주소창에서 파라미터 숨기기 (깔끔한 UI 유지)
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  // 🌟 [단체 예매] 이메일 발송 중 페이지 이탈 방지
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (groupSendingProgress.sending) { e.preventDefault(); }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [groupSendingProgress.sending]);

  const fetchInitialData = async () => {
    try {
      const { data: settingsData } = await supabase.from('movie_settings').select('*').eq('id', 1).single();
      let currentDbDate = "2026-04-18";
      
      if (settingsData) {
        setMovieInfo(settingsData);
        currentDbDate = settingsData.db_date;
        if (new Date() > new Date(settingsData.deadline_date)) setIsClosed(true);
      }

      const { data: resData } = await supabase.from('reservations')
        .select('id, seat_number, payment_status, student_name, student_id, group_expires_at')
        .eq('movie_date', currentDbDate);
        
      if (resData) {
        const newStatuses: Record<string, SeatData> = {};
        const now = new Date();
        resData.forEach((res) => {
          if (res.payment_status === 'pending' || res.payment_status === 'confirmed') {
            newStatuses[res.seat_number] = { status: res.payment_status, name: res.student_name, ticketId: res.id };
          } else if (res.payment_status === 'group_pending') {
            // 🌟 [단체 예매] 만료 시간이 지나지 않은 경우만 표시 (JIT 필터링)
            if (res.group_expires_at && new Date(res.group_expires_at) > now) {
              newStatuses[res.seat_number] = { status: res.payment_status, name: res.student_name, ticketId: res.id };
            }
          }
        });
        setSeatStatuses(newStatuses);
      }

      const { data: bgData } = await supabase.from('blacklist').select('student_id');
      if (bgData) setBlacklistedUsers(bgData.map(b => b.student_id));

      // 🌟 [단체 예매] 만료된 단체 예매 정리 (백그라운드)
      fetch('/api/cron/group-check').catch(() => {});
    } catch (err) {
      console.error("데이터 불러오기 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeatClick = (seatId: string) => {
    if (isClosed) return;

    // 🌟 [단체 예매] Group Mode에서의 좌석 클릭
    if (isGroupMode) {
      if (seatStatuses[seatId]) return;
      if (groupLeader?.seat === seatId) return;
      const existingMember = groupMembers.find(m => m.seat === seatId);
      if (existingMember) {
        showConfirm(`${existingMember.name}님을 단체에서 제거하시겠습니까?`, () => {
          setGroupMembers(prev => prev.filter(m => m.seat !== seatId));
        });
        return;
      }
      if (groupMembers.length >= 9) return showAlert("단체 예매는 리더를 포함하여 최대 10명까지 가능합니다.");
      if (vipSeats.has(seatId) && groupLeader && !CLUB_MEMBERS.includes(groupLeader.studentId)) {
        return showAlert("👑 선택하신 좌석은 '영화대교' 동아리 전용석입니다.");
      }
      setSelectedSeat(seatId);
      setMemberFormData({studentId: '', name: ''});
      setIsGroupMemberModal(true);
      return;
    }

    if (seatStatuses[seatId]) {
      if (seatStatuses[seatId].status === 'group_pending') return;
      setClickedSeatInfo({
        seatId,
        status: seatStatuses[seatId].status,
        ticketId: seatStatuses[seatId].ticketId
      });
      return;
    }
    setSelectedSeat(seatId);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRequestReset = async () => {
    const cleanStudentId = formData.studentId.replace(/['"]/g, '').trim();
    setIsResetting(true);
    try {
      const res = await fetch('/api/auth/request-reset', {
        method: 'POST',
        body: JSON.stringify({ studentId: cleanStudentId, studentName: formData.name, baseUrl: window.location.origin })
      });
      if (res.ok) {
        showAlert("학교 이메일로 비밀번호 재설정 링크가 발송되었습니다.", false);
        setShowResetButton(false);
      } else { showAlert("발송에 실패했습니다."); }
    } finally { setIsResetting(false); }
  };

  const handleSubmit = async () => {
    if (!formData.studentId || !formData.name || !formData.password) return showAlert("정보를 모두 입력해주세요!");
    if (!/^[0-9]{4}$/.test(formData.password)) return showAlert("❌ 비밀번호는 4자리 '숫자'만 입력해주세요!");

    const cleanStudentId = formData.studentId.replace(/['"]/g, '').trim();

    if (cleanStudentId === "교직원") {
      if (!STAFF_LIST.includes(formData.name)) return showAlert("❌ 등록된 교직원 이름이 아닙니다.");
    } else {
      if (cleanStudentId.length !== 4) return showAlert("학번은 4자리 숫자로 입력해주세요.");
      if (STUDENT_LIST[cleanStudentId] !== formData.name) return showAlert(`❌ 학번과 이름이 일치하지 않습니다.`);
    }

    if (blacklistedUsers.includes(cleanStudentId)) return showAlert("🚫 블랙리스트에 등록되어 예매가 제한되었습니다.");

    if (selectedSeat && vipSeats.has(selectedSeat)) {
      if (!CLUB_MEMBERS.includes(cleanStudentId)) {
        return showAlert("👑 선택하신 좌석은 '영화대교' 동아리 전용석입니다.\n일반 학생은 다른 좌석을 선택해주세요.");
      }
    }

    const authKey = cleanStudentId === "교직원" ? formData.name : cleanStudentId;
    const { data: authResult, error: authError } = await supabase.rpc('verify_student_password', { 
      p_student_id: authKey, 
      p_password: formData.password 
    });

    if (authError) return showAlert("네트워크 오류가 발생했습니다.");

    if (!authResult.exists) {
      // 신규 사용자: INSERT (RLS anon INSERT 허용됨)
      await supabase.from('student_auth').insert({ student_id: authKey, password: formData.password });
      setShowResetButton(false);
    } else {
      if (!authResult.success) {
        setShowResetButton(true);
        return showAlert("❌ 비밀번호가 일치하지 않습니다.");
      } else {
        setShowResetButton(false);
      }
    }

    const processReservation = async () => {
      try {
        const { data: existingTickets } = await supabase.from('reservations')
          .select('*')
          .eq('movie_date', movieInfo.db_date)
          .eq('student_id', cleanStudentId)
          .eq('student_name', formData.name);

        const baseUrl = window.location.origin;
        const userEmail = cleanStudentId === "교직원" ? USER_EMAILS[formData.name] : USER_EMAILS[cleanStudentId];

        if (existingTickets && existingTickets.length > 0) {
          const myOldTicket = existingTickets[0];
          // 💡 이미 위에서 student_auth를 통해 비밀번호 검증이 완료되었으므로 추가 체크를 생략합니다.
          
          showConfirm(`이미 예약된 좌석(${myOldTicket.seat_number})을 새로운 좌석(${selectedSeat})으로 변경하시겠습니까?`, async () => {
            const { data: updatedTicket, error: updateError } = await supabase.from('reservations')
              .update({ seat_number: selectedSeat })
              .eq('id', myOldTicket.id)
              .select('id')
              .single();

            if (updateError) return showAlert("변경 중 오류 발생 (이미 선점된 좌석일 수 있습니다).");

            await supabase.from('activity_logs').insert([{ student_id: cleanStudentId, student_name: formData.name, description: `좌석 변경 (${myOldTicket.seat_number} ➡️ ${selectedSeat})` }]);

            if (userEmail && updatedTicket) {
              fetch('/api/ticket', { method: 'POST', body: JSON.stringify({ email: userEmail, name: formData.name, seat: selectedSeat, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, statusType: 'changed', popcorn: 'none', ticketId: updatedTicket.id, baseUrl }) });
            }
            showSuccess("예매 변경 완료!", "✨ 좌석이 성공적으로 변경되었습니다.\n새로운 티켓이 학교 메일로 발송되었습니다.");
            fetchInitialData(); setIsModalOpen(false); setSelectedSeat(null);
          });
          return;
        }

        // 🌟 이제 모든 예매는 무료이므로 무조건 confirmed 처리
        const { data: newTicket, error: insertError } = await supabase.from('reservations')
          .insert([{ movie_date: movieInfo.db_date, student_id: cleanStudentId, student_name: formData.name, password: formData.password, seat_number: selectedSeat, popcorn_order: 'none', payment_status: 'confirmed' }])
          .select('id').single();

        if (insertError) {
          showAlert("앗! 다른 분이 먼저 예매했습니다.\n다른 좌석을 선택해주세요.");
          fetchInitialData(); return;
        }

        await supabase.from('activity_logs').insert([{ student_id: cleanStudentId, student_name: formData.name, description: `무료 관람 예매 (${selectedSeat})` }]);

        setSeatStatuses((prev) => ({ ...prev,[selectedSeat as string]: { status: 'confirmed', name: formData.name, ticketId: newTicket?.id || '' } }));
        setIsModalOpen(false); 

        if (userEmail && newTicket) {
          fetch('/api/ticket', { method: 'POST', body: JSON.stringify({ email: userEmail, name: formData.name, seat: selectedSeat, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, statusType: 'confirmed', popcorn: 'none', ticketId: newTicket.id, baseUrl }) });
        }

        showSuccess("🎉 예매 성공!", `${formData.name}님 귀중한 예매 감사합니다! 📧\n입력하신 학교 이메일로 VIP 모바일 티켓이 발송되었습니다.`);
        setSelectedSeat(null);
        
      } catch (err) {
        showAlert("네트워크 오류가 발생했습니다.");
      }
    };

    showConfirm(`[${selectedSeat}] 좌석 예매를 확정하시겠습니까?\n확정 시 즉시 학교 이메일로 티켓이 발송됩니다.`, processReservation);
  };

  // ===== 🌟 [단체 예매] Handler Functions =====

  const handleGroupStart = async () => {
    if (!formData.studentId || !formData.name || !formData.password) return showAlert("정보를 모두 입력해주세요!");
    if (!/^[0-9]{4}$/.test(formData.password)) return showAlert("❌ 비밀번호는 4자리 '숫자'만 입력해주세요!");
    const cleanStudentId = formData.studentId.replace(/['\"]/g, '').trim();
    if (cleanStudentId === "교직원") {
      if (!STAFF_LIST.includes(formData.name)) return showAlert("❌ 등록된 교직원 이름이 아닙니다.");
    } else {
      if (cleanStudentId.length !== 4) return showAlert("학번은 4자리 숫자로 입력해주세요.");
      if (STUDENT_LIST[cleanStudentId] !== formData.name) return showAlert(`❌ 학번과 이름이 일치하지 않습니다.`);
    }
    if (blacklistedUsers.includes(cleanStudentId)) return showAlert("🚫 블랙리스트에 등록되어 예매가 제한되었습니다.");
    if (selectedSeat && vipSeats.has(selectedSeat) && !CLUB_MEMBERS.includes(cleanStudentId)) {
      return showAlert("👑 선택하신 좌석은 '영화대교' 동아리 전용석입니다.\n일반 학생은 다른 좌석을 선택해주세요.");
    }
    const authKey = cleanStudentId === "교직원" ? formData.name : cleanStudentId;
    const { data: authResult, error: authError } = await supabase.rpc('verify_student_password', { 
      p_student_id: authKey, 
      p_password: formData.password 
    });

    if (authError) return showAlert("네트워크 오류가 발생했습니다.");

    if (!authResult.exists) {
      await supabase.from('student_auth').insert({ student_id: authKey, password: formData.password });
      setShowResetButton(false);
    } else {
      if (!authResult.success) {
        setShowResetButton(true);
        return showAlert("❌ 비밀번호가 일치하지 않습니다.");
      } else {
        setShowResetButton(false);
      }
    }
    const { data: existingTickets } = await supabase.from('reservations')
      .select('id').eq('movie_date', movieInfo.db_date).eq('student_id', cleanStudentId);
    if (existingTickets && existingTickets.length > 0) {
      return showAlert("이미 예매 내역이 존재하는 학생은 단체 예매 리더가 될 수 없습니다.\n기존 예매를 취소한 뒤 다시 시도해주세요.");
    }
    setGroupLeader({ studentId: cleanStudentId, name: formData.name, password: formData.password, seat: selectedSeat! });
    setGroupMembers([]);
    setIsGroupMode(true);
    setIsModalOpen(false);
    setShowResetButton(false);
  };

  const handleAddGroupMember = async (andFinalize: boolean) => {
    if (!memberFormData.studentId || !memberFormData.name) return showAlert("학번과 이름을 모두 입력해주세요!");
    const cleanId = memberFormData.studentId.replace(/['\"]/g, '').trim();
    if (cleanId === "교직원") {
      if (!STAFF_LIST.includes(memberFormData.name)) return showAlert("❌ 등록된 교직원 이름이 아닙니다.");
    } else {
      if (cleanId.length !== 4) return showAlert("학번은 4자리 숫자로 입력해주세요.");
      if (STUDENT_LIST[cleanId] !== memberFormData.name) return showAlert(`❌ 학번과 이름이 일치하지 않습니다.`);
    }
    if (blacklistedUsers.includes(cleanId)) return showAlert("🚫 블랙리스트에 등록되어 추가할 수 없습니다.");
    if (groupLeader?.studentId === cleanId) return showAlert("리더 본인은 추가할 수 없습니다.");
    if (groupMembers.some(m => m.studentId === cleanId)) return showAlert("이미 단체에 추가된 학생입니다.");
    const { data: existing } = await supabase.from('reservations')
      .select('id').eq('movie_date', movieInfo.db_date).eq('student_id', cleanId);
    if (existing && existing.length > 0) return showAlert("이미 예매가 완료된 학생입니다.");

    // 🌟 [추가] 동아리 전용 좌석 검증 (멤버 추가 시)
    if (selectedSeat && vipSeats.has(selectedSeat)) {
      if (!CLUB_MEMBERS.includes(cleanId)) {
        return showAlert("👑 선택하신 좌석은 '영화대교' 동아리 전용석입니다.\n이 좌석에는 동아리 부원만 추가할 수 있습니다.");
      }
    }

    const newMembers = [...groupMembers, { studentId: cleanId, name: memberFormData.name, seat: selectedSeat! }];
    setGroupMembers(newMembers);
    setIsGroupMemberModal(false);
    setSelectedSeat(null);
    if (andFinalize) {
      setTimeout(() => setIsGroupSummaryOpen(true), 100);
    }
  };

  const handleGroupFinalize = async () => {
    setIsGroupSummaryOpen(false);
    const leaderName = groupLeader!.name;
    const leaderSeat = groupLeader!.seat;
    const leaderStudentId = groupLeader!.studentId;
    const memberCount = groupMembers.length;
    const groupId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const baseUrl = window.location.origin;

    const { data: leaderTicket, error: leaderError } = await supabase.from('reservations')
      .insert([{
        movie_date: movieInfo.db_date, student_id: leaderStudentId, student_name: leaderName,
        password: groupLeader!.password, seat_number: leaderSeat, popcorn_order: 'none',
        payment_status: 'confirmed', group_id: groupId, is_group_leader: true, group_expires_at: expiresAt
      }]).select('id').single();
    if (leaderError) {
      return showAlert("리더 좌석 예매 중 오류가 발생했습니다.\n(이미 선점된 좌석일 수 있습니다.)");
    }

    const memberInserts = groupMembers.map(m => ({
      movie_date: movieInfo.db_date, student_id: m.studentId, student_name: m.name,
      password: '', seat_number: m.seat, popcorn_order: 'none',
      payment_status: 'group_pending', group_id: groupId, is_group_leader: false, group_expires_at: expiresAt
    }));
    const { data: memberTickets, error: memberError } = await supabase.from('reservations')
      .insert(memberInserts).select('id, student_id, student_name, seat_number');
    if (memberError) {
      await supabase.from('reservations').delete().eq('id', leaderTicket.id);
      return showAlert("멤버 좌석 예매 중 오류가 발생했습니다.\n(이미 선점된 좌석이 포함되어 있을 수 있습니다.)");
    }

    await supabase.from('activity_logs').insert([{
      student_id: leaderStudentId, student_name: leaderName,
      description: `단체 예매 생성 (리더: ${leaderSeat}, 멤버 ${memberCount}명)`
    }]);

    const leaderEmail = leaderStudentId === "교직원" ? USER_EMAILS[leaderName] : USER_EMAILS[leaderStudentId];
    if (leaderEmail) {
      fetch('/api/ticket', {
        method: 'POST',
        body: JSON.stringify({
          email: leaderEmail, name: leaderName, seat: leaderSeat,
          movieTitle: movieInfo.title, movieDate: movieInfo.date_string,
          statusType: 'confirmed', popcorn: 'none', ticketId: leaderTicket.id, baseUrl
        })
      });
    }

    setGroupSendingProgress({ current: 0, total: memberTickets!.length, sending: true });
    const emailPayloads = memberTickets!.map(t => ({
      email: t.student_id === "교직원" ? USER_EMAILS[t.student_name] : USER_EMAILS[t.student_id],
      name: t.student_name, seat: t.seat_number, studentId: t.student_id, memberId: t.id
    }));
    const CHUNK_SIZE = 5;
    for (let i = 0; i < emailPayloads.length; i += CHUNK_SIZE) {
      const chunk = emailPayloads.slice(i, i + CHUNK_SIZE);
      try {
        await fetch('/api/group-invite', {
          method: 'POST',
          body: JSON.stringify({ members: chunk, leaderName, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, groupId, baseUrl })
        });
      } catch (err) { console.error(err); }
      setGroupSendingProgress({ current: Math.min(i + CHUNK_SIZE, emailPayloads.length), total: emailPayloads.length, sending: true });
      if (i + CHUNK_SIZE < emailPayloads.length) await new Promise(r => setTimeout(r, 1000));
    }

    setGroupSendingProgress(prev => ({ ...prev, sending: false }));
    setIsGroupMode(false);
    setGroupLeader(null);
    setGroupMembers([]);
    fetchInitialData();
    showSuccess("🎉 단체 예매 완료!", `${leaderName}님의 단체 예매가 등록되었습니다!\n\n리더의 예매는 즉시 확정되었습니다.\n멤버 ${memberCount}명에게 초대 이메일이 발송되었습니다.\n\n⏰ 멤버들은 1시간 이내에 이메일을 통해 예매를 확정해야 합니다.`);
  };

  const handleCancelGroupMode = () => {
    showConfirm("단체 예매를 취소하시겠습니까?\n추가된 멤버 정보가 모두 삭제됩니다.", () => {
      setIsGroupMode(false);
      setGroupLeader(null);
      setGroupMembers([]);
      setSelectedSeat(null);
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center select-none overflow-hidden">
        <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=Song+Myung&display=swap');` }} />
        <div className="relative flex flex-col items-center justify-center animate-pulse">
          <div className="absolute w-48 h-48 md:w-64 md:h-64 bg-indigo-500/20 rounded-full blur-[80px] pointer-events-none"></div>
          <div style={{ fontFamily: "'Song Myung', serif" }} className="text-center flex flex-col leading-tight z-10 text-slate-100">
            <span className="text-[60px] md:text-[80px] tracking-[0.1em] drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">영화</span>
            <span className="text-[60px] md:text-[80px] tracking-[0.1em] drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">대교</span>
          </div>
          <p className="mt-8 text-amber-500/80 text-[10px] md:text-xs tracking-[0.4em] font-bold z-10 uppercase font-sans">시스템 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 flex flex-col items-center select-none overflow-x-hidden">
      
      <div className="w-full max-w-4xl flex justify-end gap-3 z-20 mt-2 md:mt-0">
        <button onClick={() => setIsManualOpen(true)} className="px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-500/50 rounded-lg text-xs md:text-sm text-indigo-300 font-bold transition-all shadow-lg">
          📖 이용 안내
        </button>
        <Link href="/admin" className="px-4 py-2 bg-white/5 backdrop-blur-md hover:bg-white/10 border border-white/10 rounded-lg text-xs md:text-sm text-slate-300 font-bold transition-all shadow-lg hover:shadow-white/5">
          ⚙️ 관리자
        </Link>
        <Link href="/print" className="px-4 py-2 bg-white/5 backdrop-blur-md hover:bg-white/10 border border-white/10 rounded-lg text-xs md:text-sm text-slate-300 font-bold transition-all shadow-lg hover:shadow-white/5">
          🖨️ 발권기
        </Link>
      </div>

      <div className="relative flex flex-col items-center justify-center mb-10 mt-4 select-none group">
        <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=Song+Myung&display=swap');` }} />
        <div className="absolute w-32 h-32 md:w-40 md:h-40 bg-indigo-500/20 rounded-full blur-[60px] pointer-events-none transition-all duration-1000 group-hover:bg-indigo-500/30 group-hover:scale-110"></div>
        <div style={{ fontFamily: "'Song Myung', serif" }} className="text-center flex flex-col leading-tight z-10 text-slate-100">
          <span className="text-[40px] md:text-[50px] tracking-[0.1em] drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">영화</span>
          <span className="text-[40px] md:text-[50px] tracking-[0.1em] drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">대교</span>
        </div>
      </div>

      {inviteName && (
        <div className="w-full max-w-4xl bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-amber-500/20 border border-amber-500/30 rounded-2xl p-5 mb-6 text-center transform shadow-[0_0_30px_rgba(245,158,11,0.15)] animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="text-amber-400 font-bold text-lg md:text-xl tracking-wide flex items-center justify-center gap-2">
            <span>✨</span>
            <span><span className="text-white">{inviteName}</span>님, 특별 초청을 환영합니다!</span>
            <span>✨</span>
          </div>
          <p className="text-slate-400 text-sm mt-2 font-light">예매 시 귀하의 학번과 이름이 자동으로 입력되어 있습니다.</p>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-center gap-6 mb-12 bg-white/5 backdrop-blur-xl p-6 rounded-2xl w-full max-w-4xl shadow-2xl border border-white/10 transition-all duration-500 hover:border-white/20 hover:bg-white/10">
        <img src={movieInfo.poster_url} alt="영화 포스터" className="w-40 h-56 md:w-44 md:h-64 object-cover rounded-xl shadow-[0_0_25px_rgba(0,0,0,0.6)] border border-white/10 bg-slate-800" />
        <div className="flex flex-col text-center md:text-left w-full">
          <span className="text-indigo-400 font-bold mb-1 text-sm tracking-wide">이달의 명작 상영작</span>
          <div className="flex flex-col md:flex-row md:items-end gap-2 mb-2 justify-center md:justify-start">
            <h2 className="text-2xl md:text-3xl font-bold text-white">{movieInfo.title}</h2>
            <span className="text-slate-400 border border-slate-600/50 bg-slate-800/50 text-[10px] md:text-xs px-2 py-0.5 rounded-sm whitespace-nowrap w-fit mx-auto md:mx-0 mb-1">
              관람가: {movieInfo.age_rating}
            </span>
          </div>
          <p className="text-slate-300 mt-2 text-sm md:text-base font-light">📍 장소: {movieInfo.venue}</p>
          <p className="text-slate-300 text-sm md:text-base font-light">⏰ 일시: {movieInfo.date_string}</p>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
            <span className="text-rose-400 font-bold text-xs md:text-sm bg-rose-500/10 px-2 py-1 rounded-md">
              🚨 마감: {new Date(movieInfo.deadline_date).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      <div className="relative w-full overflow-x-auto pb-8">
        {isClosed && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/80 rounded-xl">
            <span className="text-4xl font-black text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.6)] transform -rotate-12 border-4 border-rose-500 p-4 rounded-xl">예매가 마감되었습니다</span>
          </div>
        )}

        <div className="flex flex-col items-center gap-1 md:gap-2 min-w-max px-4 pt-6 w-fit mx-auto relative">
          
          <div className={`w-[70%] h-8 md:h-10 rounded-t-3xl flex items-center justify-center mb-8 md:mb-12 border-t border-white/40 ${isGroupMode ? 'bg-emerald-400/90 shadow-[0_-10px_30px_rgba(16,185,129,0.3)]' : 'bg-slate-200/90 shadow-[0_-10px_30px_rgba(255,255,255,0.15)]'}`}>
            <span className={`font-black text-xs md:text-base ml-2 ${isGroupMode ? 'text-emerald-900 tracking-[0.3em] animate-pulse' : 'text-slate-800 tracking-[1em]'}`}>
              {isGroupMode ? '단체 예매 중' : 'SCREEN'}
            </span>
          </div>

          <div className="md:hidden absolute top-0 left-6 animate-bounce text-amber-400 font-bold text-xs flex items-center gap-1 z-10 pointer-events-none drop-shadow-md">
            옆으로 밀어서 확인 <span className="text-lg">👉</span>
          </div>

          {rows.map((rowChar, rowIndex) => (
            <div key={rowIndex} className={`flex items-center gap-1 md:gap-2 ${isGrandHall && rowChar === 'H' ? 'mb-8 md:mb-12' : ''}`}>
              <span className="w-6 md:w-8 text-center font-bold text-slate-500 text-xs md:text-sm">{rowChar}</span>
              
              <div className="flex gap-0.5 md:gap-1">
                {cols.map((colNum, colIndex) => {
                  
                  const seatId = getSeatId(rowIndex, colIndex);
                  
                  const isAisle = isGrandHall ? (colNum === 9 || colNum === 18) : (colNum === 7);
                  const aisleMargin = isGrandHall ? 'mr-4 md:mr-8' : 'mr-8 md:mr-12';
                  
                  const btnSize = isGrandHall ? 'w-8 h-10 md:w-10 md:h-12' : 'w-10 h-12 md:w-12 md:h-14';

                  if (!seatId) {
                    return <div key={`empty-${colNum}`} className={`${isAisle ? aisleMargin : ''} ${btnSize}`} />;
                  }

                  const isSelected = selectedSeat === seatId;
                  const seatData = seatStatuses[seatId];
                  const isConfirmed = seatData?.status === 'confirmed';
                  const isGroupPending = seatData?.status === 'group_pending';
                  const isReserved = isConfirmed || isGroupPending;
                  
                  const isVipSeat = vipSeats.has(seatId);

                  // 🌟 [단체 예매] 로컬 그룹 좌석 확인
                  const isGroupLeaderSeat = isGroupMode && groupLeader?.seat === seatId;
                  const isGroupMemberSeat = isGroupMode && groupMembers.some(m => m.seat === seatId);

                  const displayText = isGroupLeaderSeat ? groupLeader!.name
                    : isGroupMemberSeat ? groupMembers.find(m => m.seat === seatId)!.name
                    : isReserved ? seatData.name : seatId;

                  const textSize = (isReserved || isGroupLeaderSeat || isGroupMemberSeat)
                    ? (isGrandHall ? 'text-[10px] md:text-[11px] tracking-tighter whitespace-nowrap' : 'text-[12px] md:text-[14px] tracking-tighter whitespace-nowrap') 
                    : (isGrandHall ? 'text-[11px] md:text-[12px] tracking-tighter whitespace-nowrap' : 'text-[13px] md:text-[15px] tracking-tighter whitespace-nowrap');

                  return (
                    <div key={seatId} className={`flex ${isAisle ? aisleMargin : ''}`}>
                      <button
                        onClick={() => handleSeatClick(seatId)}
                        disabled={isClosed} 
                        className={`${btnSize} ${textSize} rounded-t-xl rounded-b-md flex items-center justify-center font-bold px-0 transition-colors overflow-hidden
                          ${isGroupLeaderSeat ? 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)] transform -translate-y-1 z-10 font-black ring-2 ring-emerald-400'
                            : isGroupMemberSeat ? 'bg-sky-600 text-white shadow-[0_0_10px_rgba(14,165,233,0.4)] transform -translate-y-0.5 z-10 font-bold ring-1 ring-sky-400'
                            : isGroupPending ? 'bg-teal-900/40 text-teal-300 cursor-not-allowed opacity-70'
                            : isConfirmed ? 'bg-slate-800/80 text-slate-500 cursor-not-allowed opacity-80' 
                            : isSelected ? 'bg-amber-500 text-slate-900 shadow-[0_0_15px_rgba(245,158,11,0.6)] transform -translate-y-1 z-10 font-black' 
                            : isVipSeat ? 'bg-indigo-900/60 text-indigo-300 hover:bg-indigo-600/80'
                            : 'bg-white/10 hover:bg-white/20 text-slate-300'}
                        `}
                      >
                        {displayText}
                      </button>
                    </div>
                  );
                })}
              </div>
              <span className="w-6 md:w-8 text-center font-bold text-slate-500 text-xs md:text-sm ml-1 md:ml-2">{rowChar}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-6 text-sm text-slate-400">
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-white/10 border border-white/5 rounded-sm"></div>예매 가능</div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 border border-indigo-500/50 bg-indigo-900/60 rounded-sm"></div>동아리 전용</div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-slate-800/80 border border-white/5 rounded-sm"></div>예매 완료</div>
        {(isGroupMode || Object.values(seatStatuses).some(s => s.status === 'group_pending')) && (
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-teal-900/40 border border-teal-500/50 rounded-sm"></div>단체 대기 중</div>
        )}
        {isGroupMode && (
          <>
            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-emerald-600 rounded-sm"></div>리더 (나)</div>
            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-sky-600 rounded-sm"></div>단체 멤버</div>
          </>
        )}
      </div>

      <div className="mt-8 p-6 bg-white/5 backdrop-blur-xl rounded-2xl w-full max-w-xl text-center shadow-2xl border border-white/10">
        {isGroupMode ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-emerald-400 font-bold">👑 리더: {groupLeader?.name} ({groupLeader?.seat})</span>
              <span className="text-slate-400">멤버: {groupMembers.length}명 / 9명</span>
            </div>
            {groupMembers.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center">
                {groupMembers.map(m => (
                  <span key={m.seat} className="bg-sky-600/20 text-sky-300 px-3 py-1 rounded-full text-sm border border-sky-500/30">
                    {m.name} ({m.seat})
                  </span>
                ))}
              </div>
            )}
            <p className="text-slate-400 text-xs">빈 좌석을 클릭하여 멤버를 추가하세요 (최대 10명)</p>
            <div className="flex gap-3">
              <button onClick={handleCancelGroupMode} className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 font-bold transition-all">단체 예매 취소</button>
              <button onClick={() => { if (groupMembers.length === 0) return showAlert("최소 1명의 멤버를 추가해주세요."); setIsGroupSummaryOpen(true); }} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 rounded-lg text-white font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]">완료하기 →</button>
            </div>
          </div>
        ) : isClosed ? (
           <div className="py-4 px-8 rounded-xl w-full bg-rose-900/40 border border-rose-800 text-rose-400 font-bold text-lg cursor-not-allowed">예매가 모두 마감되었습니다</div>
        ) : selectedSeat ? (
          <>
            <p className="text-lg md:text-xl mb-6 text-slate-200">선택된 좌석: <span className="text-amber-400 font-bold text-3xl md:text-4xl ml-2 tracking-tighter drop-shadow-md">{selectedSeat}</span></p>
            <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-500 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(79,70,229,0.5)] transition-all text-white font-bold py-4 px-8 rounded-xl w-full text-lg border border-indigo-500">예매하기</button>
          </>
        ) : <p className="text-slate-400 py-4 font-light">관람하실 좌석을 선택해주세요.</p>}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/95 flex items-center justify-center p-4 z-50 overflow-y-auto duration-300">
          <div className="bg-slate-900/90 backdrop-blur-xl p-6 rounded-2xl w-full max-w-md border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] my-8">
            <h2 className="text-2xl font-bold text-white mb-6">예매 정보 입력</h2>
            <div className="space-y-4 text-left">
              <div>
                <label className="block text-slate-300 mb-1 text-sm">학번</label>
                <input type="text" name="studentId" value={formData.studentId} onChange={handleInputChange} className="w-full p-3 rounded-lg bg-slate-800/80 text-white border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" placeholder="예: 2703 (교직원은 '교직원')"/>
              </div>
              <div>
                <label className="block text-slate-300 mb-1 text-sm">이름 (본명)</label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full p-3 rounded-lg bg-slate-800/80 text-white border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" placeholder="이름을 정확히 입력하세요"/>
              </div>
              <div>
                <label className="block text-slate-300 mb-1 text-sm">예매 확인용 비밀번호 (숫자 4자리)</label>
                <input type="password" name="password" maxLength={4} value={formData.password} onChange={handleInputChange} className="w-full p-3 rounded-lg bg-slate-800/80 text-white border border-white/10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" placeholder="반드시 숫자 4자리 입력"/>
                <p className="text-rose-400/90 text-xs mt-2 font-bold">* 좌석 변경 및 영화관 입장 확인 시 필요하므로 절대 잊어버리지 마세요!</p>
                {showResetButton && (
                  <button onClick={handleRequestReset} disabled={isResetting} className="mt-3 text-sm text-amber-400 hover:text-amber-300 underline underline-offset-4 font-bold block w-full text-left">
                    {isResetting ? "메일 발송 중..." : "🚨 본인인데 비밀번호를 모르겠나요? (이메일로 재설정)"}
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex gap-3 mt-8">
              <button onClick={() => setIsModalOpen(false)} className="py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 font-bold transition-all text-sm">취소</button>
              <button onClick={handleSubmit} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 rounded-lg text-white font-bold transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] text-sm">예매 확정하기</button>
              <button onClick={handleGroupStart} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 rounded-lg text-white font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] text-sm">단체 예매하기</button>
            </div>
          </div>
        </div>
      )}

      {isManualOpen && (
        <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center p-4 z-50 animate-in fade-in zoom-in duration-200">
          <div className="bg-slate-900 border border-slate-700 p-6 md:p-8 rounded-2xl w-full max-w-lg shadow-[0_0_40px_rgba(0,0,0,0.8)] max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-indigo-400 mb-6 flex items-center gap-2">📖 영화대교 예매 가이드</h2>
            
            <div className="space-y-6 text-slate-300 text-sm md:text-base">
              <div>
                <h3 className="font-bold text-white text-lg mb-1">1. 좌석 선택 및 예매</h3>
                <p>배치도에서 원하는 좌석을 누른 후, 화면 하단의 <span className="text-indigo-400 font-bold">예매하기</span> 버튼을 클릭하세요. 본인의 학번, 이름, 그리고 예매 확인용 4자리 비밀번호를 입력하면 예약이 확정됩니다.</p>
                <div className="mt-3 bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl text-sm">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">💡</span>
                    <p className="text-indigo-200 leading-relaxed">
                      <span className="font-bold text-indigo-300">4자리 비밀번호는 영구적으로 유지되며,</span><br/>
                      티켓 출력 및 좌석 변경 시 반드시 필요하니 꼭 기억해 주세요!
                    </p>
                  </div>
                </div>

                {/* 🌟 [디자인 개선] 좌석 변경 안내 섹션 */}
                <div className="mt-3 bg-slate-800/50 border border-slate-700 p-4 rounded-xl text-sm group transition-all hover:border-indigo-500/50">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400 font-bold">🔄</div>
                    <span className="font-bold text-indigo-300 text-base">좌석 변경 방법</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed ml-11">
                    예매되지 않은 빈 좌석을 선택하여 예매를 다시 진행하면, <span className="text-white">기존 좌석은 자동으로 취소</span>되고 즉시 새로운 좌석으로 변경됩니다.
                  </p>
                </div>
              </div>
              
              <div>
                <h3 className="font-bold text-white text-lg mb-1">2. 모바일 티켓 (이메일 수신)</h3>
                <p>성공적으로 예매가 완료되면, 입력하신 인적 사항에 해당하는 <span className="text-amber-400 font-bold">학교 이메일</span>로 모바일 티켓(예매 내역)이 즉시 발송됩니다.</p>
              </div>

              <div>
                <h3 className="font-bold text-white text-lg mb-1">3. 좌석 범례 안내</h3>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="flex items-center gap-2 text-xs bg-slate-800/30 p-2 rounded-lg border border-white/5">
                    <div className="w-3 h-3 border border-white/30 rounded-full"></div>
                    <span className="text-slate-400">예매 가능</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs bg-indigo-900/40 p-2 rounded-lg border border-indigo-500/30">
                    <div className="w-3 h-3 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.6)]"></div>
                    <span className="text-indigo-300">동아리 전용</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs bg-slate-800 p-2 rounded-lg border border-slate-700">
                    <div className="w-3 h-3 bg-slate-600 rounded-full"></div>
                    <span className="text-slate-500">예매 완료</span>
                  </div>
                </div>
              </div>

              {/* 🌟 [신규 추가] 단체 예매 안내 */}
              <div>
                <h3 className="font-bold text-emerald-400 text-lg mb-1">4. 단체 예매 안내 (최대 10명)</h3>
                <p className="text-slate-300">리더는 본인을 포함해 <span className="text-white font-bold">최대 10명</span>까지 한 번에 예매할 수 있습니다.</p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-slate-400 ml-2 leading-relaxed">
                  <li>리더가 멤버들의 좌석을 지정하여 예매</li>
                  <li>멤버들에게 즉시 <span className="text-emerald-400">초대 이메일</span>이 발송됨</li>
                  <li>멤버는 <span className="text-amber-400 font-bold underline underline-offset-4">1시간 이내</span>에 수락 및 확정 필수</li>
                  <li>미확정 시 해당 좌석은 자동으로 취소됨</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-white text-lg mb-1">5. 비밀번호를 잊으셨을 경우</h3>
                <p>예매창 하단의 <span className="text-rose-400 font-bold">비밀번호 찾기</span>를 누르면 학교 이메일로 비밀번호 재설정 링크가 즉시 전송됩니다.</p>
              </div>
            </div>

            <button onClick={() => setIsManualOpen(false)} className="w-full mt-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all border border-slate-600 shadow-md">
              닫기
            </button>
          </div>
        </div>
      )}

      {isGroupMemberModal && selectedSeat && (
        <div className="fixed inset-0 bg-slate-950/95 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900/90 backdrop-blur-xl p-6 rounded-2xl w-full max-w-md border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <h2 className="text-2xl font-bold text-white mb-2">단체 멤버 추가</h2>
            <p className="text-slate-400 text-sm mb-6">좌석 <span className="text-sky-400 font-bold">{selectedSeat}</span>에 앉을 학생 정보를 입력하세요.</p>
            <div className="space-y-4 text-left">
              <div>
                <label className="block text-slate-300 mb-1 text-sm">학번</label>
                <input type="text" value={memberFormData.studentId} onChange={e => setMemberFormData(prev => ({...prev, studentId: e.target.value}))} className="w-full p-3 rounded-lg bg-slate-800/80 text-white border border-white/10 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-all" placeholder="예: 2703 (교직원은 '교직원')"/>
              </div>
              <div>
                <label className="block text-slate-300 mb-1 text-sm">이름 (본명)</label>
                <input type="text" value={memberFormData.name} onChange={e => setMemberFormData(prev => ({...prev, name: e.target.value}))} className="w-full p-3 rounded-lg bg-slate-800/80 text-white border border-white/10 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-all" placeholder="이름을 정확히 입력하세요"/>
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={() => { setIsGroupMemberModal(false); setSelectedSeat(null); }} className="py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 font-bold transition-all text-sm">취소</button>
              <button onClick={() => handleAddGroupMember(false)} className="flex-1 py-3 bg-sky-600 hover:bg-sky-500 border border-sky-500 rounded-lg text-white font-bold transition-all text-sm">계속하기</button>
              <button onClick={() => handleAddGroupMember(true)} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 rounded-lg text-white font-bold transition-all text-sm">완료하기</button>
            </div>
          </div>
        </div>
      )}

      {isGroupSummaryOpen && groupLeader && (
        <div className="fixed inset-0 bg-slate-950/95 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-emerald-500/30 p-6 md:p-8 rounded-2xl w-full max-w-lg shadow-[0_0_40px_rgba(16,185,129,0.2)] my-8">
            <h2 className="text-2xl font-bold text-emerald-400 mb-6">📋 단체 예매 최종 확인</h2>
            <div className="space-y-3 mb-6">
              <div className="bg-emerald-900/30 border border-emerald-500/30 p-4 rounded-xl flex items-center gap-3">
                <span className="text-emerald-400 font-bold text-lg">👑</span>
                <div>
                  <p className="text-emerald-300 font-bold">{groupLeader.name} <span className="text-emerald-500 text-xs">(리더)</span></p>
                  <p className="text-slate-400 text-sm">좌석: {groupLeader.seat} · {groupLeader.studentId}</p>
                </div>
              </div>
              {groupMembers.map((m, i) => (
                <div key={m.seat} className="bg-sky-900/20 border border-sky-500/20 p-4 rounded-xl flex items-center gap-3">
                  <span className="text-sky-400 font-bold text-lg">{i + 1}</span>
                  <div>
                    <p className="text-sky-300 font-bold">{m.name}</p>
                    <p className="text-slate-400 text-sm">좌석: {m.seat} · {m.studentId}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-amber-900/20 border border-amber-500/30 p-4 rounded-xl mb-6">
              <p className="text-amber-300 text-sm font-bold">⏰ 1시간 안에 초대 이메일에 응답한 사람만 예매가 확정됩니다.</p>
              <p className="text-slate-400 text-xs mt-1">미응답 시 해당 좌석은 자동으로 해제됩니다.</p>
            </div>
            <p className="text-slate-300 text-sm text-center mb-6">단체의 모든 사람에게 초대 이메일을 발송하시겠습니까?</p>
            <div className="flex gap-3">
              <button onClick={() => setIsGroupSummaryOpen(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 font-bold transition-all">돌아가기</button>
              <button onClick={handleGroupFinalize} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 rounded-lg text-white font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]">확정 및 이메일 발송</button>
            </div>
          </div>
        </div>
      )}

      {groupSendingProgress.sending && (
        <div className="fixed inset-0 bg-slate-950/95 flex items-center justify-center p-4 z-[100]">
          <div className="bg-slate-900 border border-emerald-500/30 p-8 rounded-2xl w-full max-w-md text-center shadow-2xl">
            <div className="text-4xl mb-4 animate-bounce">📧</div>
            <h3 className="text-xl font-bold text-white mb-4">초대 이메일 발송 중...</h3>
            <div className="w-full bg-slate-800 rounded-full h-4 mb-4 overflow-hidden">
              <div className="bg-emerald-500 h-4 rounded-full transition-all duration-500" style={{ width: `${(groupSendingProgress.current / groupSendingProgress.total) * 100}%` }}></div>
            </div>
            <p className="text-emerald-400 font-bold">{groupSendingProgress.current} / {groupSendingProgress.total}명 완료</p>
            <p className="text-slate-500 text-xs mt-2">창을 닫지 마세요. 이메일 발송이 완료될 때까지 기다려주세요.</p>
          </div>
        </div>
      )}

      {clickedSeatInfo && (
        <div className="fixed inset-0 bg-slate-950/95 flex items-center justify-center p-4 z-[70]">
          <div className="bg-slate-900/90 backdrop-blur-xl p-8 rounded-2xl max-w-sm w-full border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-center">
            <h2 className="text-2xl font-bold text-white mb-4">
              좌석 정보 <span className="text-indigo-400">[{clickedSeatInfo.seatId}]</span>
            </h2>
            
            <div className="mb-6 border border-emerald-500/30 bg-emerald-900/20 p-4 rounded-xl">
              <p className="text-emerald-400 font-bold">✅ 예매가 확정된 좌석입니다.</p>
            </div>

            <div className="space-y-3">
              <button onClick={() => window.location.href = `/cancel?ticketId=${clickedSeatInfo.ticketId}`} className="w-full py-3 bg-rose-600/90 hover:bg-rose-500 border border-rose-500 rounded-lg text-white font-bold transition-all shadow-lg hover:shadow-[0_0_15px_rgba(225,29,72,0.4)]">
                🚨 예매 취소하기
              </button>
              <button onClick={() => { setClickedSeatInfo(null); setIsManualOpen(true); }} className="w-full py-3 bg-indigo-600/90 hover:bg-indigo-500 border border-indigo-500 rounded-lg text-white font-bold transition-all shadow-lg hover:shadow-[0_0_15px_rgba(79,70,229,0.4)]">
                🔄 자리 변경 방법 보기
              </button>
              <button onClick={() => setClickedSeatInfo(null)} className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 font-bold transition-all">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 웹 자체 팝업 UI ===== */}
      
      {alertInfo && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-[80]">
          <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl w-full max-w-sm text-center shadow-2xl">
            <div className={`text-4xl mb-4 text-center mx-auto flex justify-center ${alertInfo.isError ? 'text-rose-500' : 'text-indigo-400'}`}>
               {alertInfo.isError ? '🚨' : '✨'}
            </div>
            <p className="text-white text-lg font-bold mb-6 whitespace-pre-line leading-relaxed">{alertInfo.message}</p>
            <button onClick={() => setAlertInfo(null)} className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-lg text-white font-bold transition-all border border-white/10">확인</button>
          </div>
        </div>
      )}

      {confirmInfo && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-[90]">
          <div className="bg-slate-900 border border-indigo-500/30 p-6 rounded-2xl w-full max-w-sm text-center shadow-[0_0_30px_rgba(79,70,229,0.2)]">
            <div className="text-4xl mb-4 text-center mx-auto flex justify-center">🤔</div>
            <p className="text-white text-lg font-bold mb-6 whitespace-pre-line leading-relaxed">{confirmInfo.message}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmInfo(null)} 
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-lg text-slate-300 font-bold transition-all border border-white/10">취소</button>
              <button 
                onClick={() => {
                  setConfirmInfo(null);
                  confirmInfo.onConfirm();
                }} 
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-bold transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] border border-indigo-500">확인</button>
            </div>
          </div>
        </div>
      )}

      {successInfo && (
        <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center p-4 z-[100] animate-in fade-in zoom-in duration-300">
          <div className="bg-slate-900 border border-emerald-500/50 p-8 rounded-2xl w-full max-w-md w-[90%] md:w-full text-center shadow-[0_0_50px_rgba(16,185,129,0.3)]">
            <div className="text-6xl mb-4 text-center mx-auto flex justify-center animate-bounce">🎉</div>
            <h3 className="text-2xl font-black text-white mb-2">{successInfo.title}</h3>
            <p className="text-slate-300 text-base mb-8 whitespace-pre-line leading-relaxed">{successInfo.message}</p>
            <div className="flex flex-col gap-3">
              <a href="https://mail.google.com/" target="_blank" rel="noopener noreferrer" 
                 onClick={() => setSuccessInfo(null)}
                 className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-black text-lg transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] border border-emerald-400 flex items-center justify-center gap-2">
                <span>💌</span> 티켓 확인하러 가기
              </a>
              <button onClick={() => setSuccessInfo(null)} className="w-full py-3 bg-transparent text-slate-400 hover:text-white font-bold transition-all mt-2">그냥 닫기</button>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-32 md:mt-40 mb-8 text-center w-full opacity-40 hover:opacity-100 transition-opacity duration-1000">
        <p className="text-[11px] md:text-xs text-slate-400 font-light tracking-wide">
          Crafted by <span className="font-semibold text-slate-300">Shin Mingyu</span> with <span className="font-semibold text-indigo-400/80 drop-shadow-[0_0_5px_rgba(99,102,241,0.5)]">Google AI Studio</span>
        </p>
        <p className="text-[9px] md:text-[10px] text-slate-500 mt-1.5 tracking-widest uppercase">
          Powered by Supabase & Vercel
        </p>
      </footer>
    </div>
  );
}
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
  popcorn: string;
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const[isModalOpen, setIsModalOpen] = useState(false);
  const[isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  
  const [seatStatuses, setSeatStatuses] = useState<Record<string, SeatData>>({});
  const [blacklistedUsers, setBlacklistedUsers] = useState<string[]>([]);
  const [userTickets, setUserTickets] = useState<Record<string, { popcorn: string }>>({});
  
  const [isClosed, setIsClosed] = useState(false);

  const[movieInfo, setMovieInfo] = useState({
    title: "로딩 중...", date_string: "로딩 중...", db_date: "", venue: "대구과학고등학교 중강당",
    poster_url: "/poster.jpg", deadline_date: "2099-12-31T23:59:00+09:00",
    mid_vip_start_row: "A", mid_vip_end_row: "C", mid_vip_start_col: 5, mid_vip_end_col: 10,
    grand_vip_start_row: "A", grand_vip_end_row: "C", grand_vip_start_col: 10, grand_vip_end_col: 18
  });
  
  const[formData, setFormData] = useState({ studentId: '', name: '', password: '' });
  
  const[popcornList, setPopcornList] = useState<string[]>(['none']);
  const[totalPrice, setTotalPrice] = useState(0);

  const [showResetButton, setShowResetButton] = useState(false);
  const[isResetting, setIsResetting] = useState(false);
  const[clickedSeatInfo, setClickedSeatInfo] = useState<{seatId: string, status: string, ticketId: string, popcorn: string} | null>(null);

  const isGrandHall = movieInfo.venue.includes('대강당');
  
  const rows = isGrandHall 
    ?['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R'] 
    :['A','B','C','D','E','F','G','H','I']; 

  const cols = isGrandHall 
    ? Array.from({ length: 27 }, (_, i) => i + 1) 
    : Array.from({ length: 14 }, (_, i) => i + 1); 

    const getSeatId = (rowIndex: number, colIndex: number) => {
    if (!isGrandHall) { 
      // 🟦 중강당 (14열 x 9행) - A구역(왼쪽 7칸), B구역(오른쪽 7칸)
      if (colIndex < 7) { 
        // A구역 (A01 ~ A63)
        const num = rowIndex * 7 + colIndex + 1;
        return `A${String(num).padStart(2, '0')}`;
      } else {
        // B구역 (B01 ~ B62)
        const num = rowIndex * 7 + (colIndex - 7) + 1;
        if (num === 63) return null; // 오른쪽 맨 뒷줄 끝자리(B63)는 없는 좌석이므로 비움
        return `B${String(num).padStart(2, '0')}`;
      }
    } else {
      // 🟥 대강당 (27열 x 18행) - A구역(9칸), B구역(9칸), C구역(9칸)
      if (colIndex < 9) {
        // A구역 (A001 ~ A162)
        const num = rowIndex * 9 + colIndex + 1;
        return `A${String(num).padStart(3, '0')}`;
      } else if (colIndex < 18) {
        // B구역 (B001 ~ B162)
        const num = rowIndex * 9 + (colIndex - 9) + 1;
        return `B${String(num).padStart(3, '0')}`;
      } else {
        // C구역 (C001 ~ C162)
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
          const seatId = getSeatId(rowIndex, colIndex); // 여기서 문제없이 사용 가능!
          if (seatId) vips.add(seatId);
        }
      });
    });
    return vips;
  }, [movieInfo, isGrandHall, rows, cols]); 

  useEffect(() => {
    fetchInitialData();
  },[]);

  useEffect(() => {
    const validPopcorns = popcornList.filter(p => p !== 'none');
    setTotalPrice(validPopcorns.length * 2500);
  }, [popcornList]);

  useEffect(() => {
    const cleanId = formData.studentId.replace(/['"]/g, '').trim();
    const userKey = `${cleanId}_${formData.name}`;
    const existingTicket = userTickets[userKey];
    
    if (existingTicket && existingTicket.popcorn !== 'none') {
      const existingArray = existingTicket.popcorn.split(',');
      setPopcornList([...existingArray, 'none']); 
    } else {
      setPopcornList(['none']);
    }
  },[formData.studentId, formData.name, userTickets]);

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
        .select('id, seat_number, payment_status, student_name, student_id, popcorn_order')
        .eq('movie_date', currentDbDate);
        
      if (resData) {
        const newStatuses: Record<string, SeatData> = {};
        const ticketsByUser: Record<string, { popcorn: string }> = {};
        
        resData.forEach((res) => {
          if (res.payment_status === 'pending' || res.payment_status === 'confirmed') {
            newStatuses[res.seat_number] = { status: res.payment_status, name: res.student_name, ticketId: res.id, popcorn: res.popcorn_order };
            ticketsByUser[`${res.student_id}_${res.student_name}`] = { popcorn: res.popcorn_order };
          }
        });
        setSeatStatuses(newStatuses);
        setUserTickets(ticketsByUser);
      }

      const { data: bgData } = await supabase.from('blacklist').select('student_id');
      if (bgData) setBlacklistedUsers(bgData.map(b => b.student_id));
    } catch (err) {
      console.error("데이터 불러오기 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePopcornChange = (index: number, value: string) => {
    let newList = [...popcornList];
    newList[index] = value;
    const filtered = newList.filter(p => p !== 'none');
    filtered.push('none');
    setPopcornList(filtered);
  };

  const handleSeatClick = (seatId: string) => {
    if (isClosed) return;
    if (seatStatuses[seatId]) {
      setClickedSeatInfo({
        seatId,
        status: seatStatuses[seatId].status,
        ticketId: seatStatuses[seatId].ticketId,
        popcorn: seatStatuses[seatId].popcorn
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
        alert("학교 이메일로 비밀번호 재설정 링크가 발송되었습니다.");
        setShowResetButton(false);
      } else { alert("발송에 실패했습니다."); }
    } finally { setIsResetting(false); }
  };

  const handleSubmit = async () => {
    if (!formData.studentId || !formData.name || !formData.password) return alert("정보를 모두 입력해주세요!");
    if (!/^[0-9]{4}$/.test(formData.password)) return alert("❌ 비밀번호는 4자리 '숫자'만 입력해주세요!");

    const cleanStudentId = formData.studentId.replace(/['"]/g, '').trim();

    if (cleanStudentId === "교직원") {
      if (!STAFF_LIST.includes(formData.name)) return alert("❌ 등록된 교직원 이름이 아닙니다.");
    } else {
      if (cleanStudentId.length !== 4) return alert("학번은 4자리 숫자로 입력해주세요.");
      if (STUDENT_LIST[cleanStudentId] !== formData.name) return alert(`❌ 학번과 이름이 일치하지 않습니다.`);
    }

    if (blacklistedUsers.includes(cleanStudentId)) return alert("🚫 블랙리스트에 등록되어 예매가 제한되었습니다.");

    if (selectedSeat && vipSeats.has(selectedSeat)) {
      if (!CLUB_MEMBERS.includes(cleanStudentId)) {
        return alert("👑 선택하신 좌석은 '영화대교' 동아리 전용석입니다.\n일반 학생은 다른 좌석을 선택해주세요.");
      }
    }

    // 🌟[수정됨] 교직원의 경우 '이름'을 고유 비밀번호 키값으로 사용합니다.
    const authKey = cleanStudentId === "교직원" ? formData.name : cleanStudentId;
    const { data: authData } = await supabase.from('student_auth').select('password').eq('student_id', authKey).single();

    if (!authData) {
      await supabase.from('student_auth').insert({ student_id: authKey, password: formData.password });
      setShowResetButton(false);
    } else {
      if (authData.password !== formData.password) {
        setShowResetButton(true);
        return alert("❌ 비밀번호가 일치하지 않습니다.");
      } else setShowResetButton(false); 
    }

    const isAgree = confirm("예매를 확정하시겠습니까?\n확정 시 입력하신 정보로 티켓이 발송됩니다.");
    if (!isAgree) return;

    const finalPopcornString = popcornList.filter(p => p !== 'none').join(',') || 'none';

    try {
      // 🌟 [수정됨] 교직원끼리 예매를 덮어쓰지 않도록 'student_name' 조건도 함께 검사합니다.
      const { data: existingTickets } = await supabase.from('reservations')
        .select('*')
        .eq('movie_date', movieInfo.db_date)
        .eq('student_id', cleanStudentId)
        .eq('student_name', formData.name);

      const baseUrl = window.location.origin;
      const userEmail = cleanStudentId === "교직원" ? USER_EMAILS[formData.name] : USER_EMAILS[cleanStudentId];

      if (existingTickets && existingTickets.length > 0) {
        const myOldTicket = existingTickets[0];
        if (myOldTicket.password !== formData.password) return alert("❌ 비밀번호가 일치하지 않습니다.");
        
        // 🌟 [수정됨] 팝콘 삭제(수량 축소) 방지 로직 완성본
        const oldPopcorns = myOldTicket.popcorn_order !== 'none' ? myOldTicket.popcorn_order.split(',') :[];
        const newPopcorns = finalPopcornString !== 'none' ? finalPopcornString.split(',') :[];

        // 1. 기존 수량보다 줄이려고(삭제) 하면 강제 차단
        if (newPopcorns.length < oldPopcorns.length) {
          return alert("🚫 결제 혼선 방지를 위해 기존에 주문한 팝콘 수량을 취소/삭제할 수 없습니다. (맛 변경 및 추가만 가능)");
        }

        // 2. 수량을 늘리거나 맛을 바꾼 경우 경고 모달 띄우기
        if (myOldTicket.popcorn_order !== finalPopcornString) {
          let msg = "팝콘 주문 내역이 변경되었습니다.";
          if (newPopcorns.length > oldPopcorns.length) {
            msg += `\n(추가된 팝콘에 대해서는 현장에서 추가 결제가 필요합니다.)`;
          }
          if (!confirm(`${msg}\n\n계속 진행하시겠습니까?`)) return;
        }

        if (!confirm(`이미 예약된 좌석(${myOldTicket.seat_number})을 새로운 좌석(${selectedSeat})으로 변경하시겠습니까?`)) return;

        // 🌟 위에서 구문이 완벽히 닫혔으므로 여기서부터 const 에러가 발생하지 않습니다!
        const { data: updatedTicket, error: updateError } = await supabase.from('reservations')
          .update({ seat_number: selectedSeat, popcorn_order: finalPopcornString })
          .eq('id', myOldTicket.id)
          .select('id')
          .single();

        if (updateError) return alert("변경 중 오류 발생 (이미 선점된 좌석일 수 있습니다).");

        await supabase.from('activity_logs').insert([{ student_id: cleanStudentId, student_name: formData.name, description: `좌석 변경 (${myOldTicket.seat_number} ➡️ ${selectedSeat})` }]);

        if (userEmail && updatedTicket) {
          fetch('/api/ticket', { method: 'POST', body: JSON.stringify({ email: userEmail, name: formData.name, seat: selectedSeat, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, statusType: 'changed', popcorn: finalPopcornString, ticketId: updatedTicket.id, baseUrl }) });
        }
        alert("✨ 좌석이 변경되었습니다! 티켓이 재발송되었습니다.");
        fetchInitialData(); setIsModalOpen(false); setSelectedSeat(null);
        return;
      }

      const finalStatus = finalPopcornString === 'none' ? 'confirmed' : 'pending';
      const { data: newTicket, error: insertError } = await supabase.from('reservations')
        .insert([{ movie_date: movieInfo.db_date, student_id: cleanStudentId, student_name: formData.name, password: formData.password, seat_number: selectedSeat, popcorn_order: finalPopcornString, payment_status: finalStatus }])
        .select('id').single();

      if (insertError) {
        alert("앗! 다른 분이 먼저 예매했습니다.");
        fetchInitialData(); return;
      }

      const logDesc = finalPopcornString === 'none' ? `무료 관람 예매 (${selectedSeat})` : `팝콘 포함 예매 대기 (${selectedSeat})`;
      await supabase.from('activity_logs').insert([{ student_id: cleanStudentId, student_name: formData.name, description: logDesc }]);

      setSeatStatuses((prev) => ({ ...prev,[selectedSeat as string]: { status: finalStatus, name: formData.name, ticketId: newTicket?.id || '', popcorn: finalPopcornString } }));
      setIsModalOpen(false); 

      if (userEmail && newTicket) {
        fetch('/api/ticket', { method: 'POST', body: JSON.stringify({ email: userEmail, name: formData.name, seat: selectedSeat, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, statusType: finalStatus, popcorn: finalPopcornString, ticketId: newTicket.id, baseUrl }) });
      }

      if (finalStatus === 'confirmed') {
        alert(`${formData.name}님, 예매 확정! 📧 티켓 발송 완료!`);
        setSelectedSeat(null);
      } else {
        alert(`📧 예매 안내 메일이 발송되었습니다! (결제 후 확정)`);
        setIsPaymentModalOpen(true);
      }
    } catch (err) {
      alert("네트워크 오류가 발생했습니다.");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center select-none overflow-hidden">
        <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=Song+Myung&display=swap');` }} />
        <div className="relative flex flex-col items-center justify-center animate-pulse">
          <div className="absolute w-48 h-48 md:w-64 md:h-64 bg-yellow-500/20 rounded-full blur-[60px] pointer-events-none"></div>
          <div style={{ fontFamily: "'Song Myung', serif" }} className="text-center flex flex-col leading-tight z-10">
            <span className="text-[60px] md:text-[80px] text-gray-100 tracking-[0.1em] drop-shadow-md">영화</span>
            <span className="text-[60px] md:text-[80px] text-gray-100 tracking-[0.1em] drop-shadow-md">대교</span>
          </div>
          <p className="mt-8 text-yellow-500/80 text-[10px] md:text-xs tracking-[0.4em] font-bold z-10 uppercase font-sans">시스템 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 flex flex-col items-center select-none overflow-x-hidden">
      <div className="w-full max-w-4xl flex justify-end gap-3 z-20 mt-2 md:mt-0">
        <Link href="/admin" className="px-4 py-2 bg-gray-800/80 hover:bg-gray-700 border border-gray-600 rounded-lg text-xs md:text-sm text-gray-300 font-bold transition-colors shadow-lg">
          ⚙️ 관리자
        </Link>
        <Link href="/print" className="px-4 py-2 bg-gray-800/80 hover:bg-gray-700 border border-gray-600 rounded-lg text-xs md:text-sm text-gray-300 font-bold transition-colors shadow-lg">
          🖨️ 발권기
        </Link>
      </div>
      
      <div className="relative flex flex-col items-center justify-center mb-10 mt-4 select-none">
        <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=Song+Myung&display=swap');` }} />
        <div className="absolute w-32 h-32 md:w-40 md:h-40 bg-yellow-500/20 rounded-full blur-[40px] pointer-events-none"></div>
        <div style={{ fontFamily: "'Song Myung', serif" }} className="text-center flex flex-col leading-tight z-10">
          <span className="text-[40px] md:text-[50px] text-gray-100 tracking-[0.1em] drop-shadow-md">영화</span>
          <span className="text-[40px] md:text-[50px] text-gray-100 tracking-[0.1em] drop-shadow-md">대교</span>
        </div>
        <p className="mt-4 text-gray-400 text-[10px] md:text-xs tracking-[0.3em] font-light z-10 uppercase font-sans">
          Cinema Bridge Ticket System
        </p>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-6 mb-12 bg-gray-800 p-6 rounded-2xl w-full max-w-4xl shadow-xl border border-gray-700">
        <img src={movieInfo.poster_url} alt="영화 포스터" className="w-32 h-48 object-cover rounded-lg shadow-lg bg-gray-700" />
        <div className="flex flex-col text-center md:text-left">
          <span className="text-blue-400 font-bold mb-1 text-sm">이달의 명작 상영작</span>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">{movieInfo.title}</h2>
          <p className="text-gray-300 mt-2 text-sm md:text-base">📍 장소: {movieInfo.venue}</p>
          <p className="text-gray-300 text-sm md:text-base">⏰ 일시: {movieInfo.date_string}</p>
          <p className="text-red-400 font-bold mt-2 text-sm border-t border-gray-600 pt-2">
            🚨 마감: {new Date(movieInfo.deadline_date).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      <div className="relative w-full overflow-x-auto pb-8">
        {isClosed && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm rounded-xl">
            <span className="text-4xl font-black text-red-500 drop-shadow-lg transform -rotate-12 border-4 border-red-500 p-4 rounded-xl">예매가 마감되었습니다</span>
          </div>
        )}

        {/* 🌟 [수정됨] items-center를 추가하여 내부의 스크린과 좌석들이 가운데(B005)를 기준으로 완벽히 정렬되게 합니다. */}
        <div className="flex flex-col items-center gap-1 md:gap-2 min-w-max px-4 pt-6 w-fit mx-auto relative">
          
          {/* 🌟 [수정됨] 스크린을 스크롤 영역 안으로 이동시켰습니다. 
              모바일에서 처음 열면 스크린이 잘려 보여서 옆으로 넘겨야 한다는 것을 직관적으로 알게 됩니다! */}
          <div className="w-[70%] h-8 md:h-10 bg-gray-300 rounded-t-3xl flex items-center justify-center mb-8 md:mb-12 shadow-[0_-5px_20px_rgba(255,255,255,0.1)]">
            <span className="text-gray-800 font-black tracking-[1em] text-xs md:text-base ml-2">SCREEN</span>
          </div>

          {/* 🌟 [추가됨] 모바일 사용자를 위한 확실한 스와이프 유도 텍스트 애니메이션 */}
          <div className="md:hidden absolute top-0 left-6 animate-bounce text-yellow-400 font-bold text-xs flex items-center gap-1 z-10 pointer-events-none">
            옆으로 밀어서 확인 <span className="text-lg">👉</span>
          </div>

          {rows.map((rowChar, rowIndex) => (
            <div key={rowIndex} className={`flex items-center gap-1 md:gap-2 ${isGrandHall && rowChar === 'H' ? 'mb-8 md:mb-12' : ''}`}>
              <span className="w-6 md:w-8 text-center font-bold text-gray-500 text-xs md:text-sm">{rowChar}</span>
              
              {/* 🌟 [수정됨] 좌석 간의 가로 간격을 최소화 (gap-0.5는 2px, gap-1은 4px) */}
              <div className="flex gap-0.5 md:gap-1">
                {cols.map((colNum, colIndex) => {
                  
                  const seatId = getSeatId(rowIndex, colIndex);
                  
                  const isAisle = isGrandHall ? (colNum === 9 || colNum === 18) : (colNum === 7);
                  // 통로 여백은 확실하게 분리되도록 유지
                  const aisleMargin = isGrandHall ? 'mr-4 md:mr-8' : 'mr-8 md:mr-12';
                  
                  // 🌟 [수정됨] 글자가 들어갈 수 있도록 가로 너비(w)를 다시 적절히 늘림
                  // 대강당: w-8~10 / 중강당: w-10~12
                  const btnSize = isGrandHall ? 'w-8 h-10 md:w-10 md:h-12' : 'w-10 h-12 md:w-12 md:h-14';

                  if (!seatId) {
                    return <div key={`empty-${colNum}`} className={`${isAisle ? aisleMargin : ''} ${btnSize}`} />;
                  }

                  const isSelected = selectedSeat === seatId;
                  const seatData = seatStatuses[seatId];
                  const isConfirmed = seatData?.status === 'confirmed';
                  const isPending = seatData?.status === 'pending';
                  const isReserved = isConfirmed || isPending;
                  
                  const isVipSeat = vipSeats.has(seatId);

                  const displayText = isReserved ? seatData.name : seatId;

                  // 🌟 [수정됨] 글자가 버튼 밖으로 나가지 않도록 폰트 크기를 버튼 너비에 맞춰 1~2px 미세 조정
                  const textSize = isReserved 
                    ? (isGrandHall ? 'text-[10px] md:text-[11px] tracking-tighter whitespace-nowrap' : 'text-[12px] md:text-[14px] tracking-tighter whitespace-nowrap') 
                    : (isGrandHall ? 'text-[11px] md:text-[12px] tracking-tighter whitespace-nowrap' : 'text-[13px] md:text-[15px] tracking-tighter whitespace-nowrap');

                  return (
                    <div key={seatId} className={`flex ${isAisle ? aisleMargin : ''}`}>
                      <button
                        onClick={() => handleSeatClick(seatId)}
                        disabled={isClosed} 
                        className={`${btnSize} ${textSize} rounded-t-xl rounded-b-md flex items-center justify-center font-bold px-0 transition-all overflow-hidden
                          ${isConfirmed ? 'bg-gray-800 text-gray-500 border border-gray-700 hover:bg-gray-700 cursor-pointer' 
                            : isPending ? 'bg-yellow-600/20 border border-yellow-600 text-yellow-500 hover:bg-yellow-600/40 cursor-pointer animate-pulse'
                            : isSelected ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)] transform -translate-y-1 z-10' 
                            : isVipSeat ? 'bg-indigo-900/40 border border-indigo-700 text-indigo-300 hover:bg-indigo-800/60'
                            : 'bg-gray-700 hover:bg-gray-500 text-gray-300'}
                        `}
                      >
                        {displayText}
                      </button>
                    </div>
                  );
                })}
              </div>
              <span className="w-6 md:w-8 text-center font-bold text-gray-500 text-xs md:text-sm ml-1 md:ml-2">{rowChar}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-6 text-sm text-gray-400">
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-700 rounded-sm"></div>예매 가능</div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 border border-indigo-700 bg-indigo-900/40 rounded-sm"></div>동아리 전용</div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 border border-yellow-600 bg-yellow-600/20 rounded-sm"></div>입금 대기</div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-800 border border-gray-700 rounded-sm"></div>예매 완료</div>
      </div>

      <div className="mt-8 p-6 bg-gray-800 rounded-2xl w-full max-w-xl text-center shadow-xl border border-gray-700">
        {isClosed ? (
           <div className="py-4 px-8 rounded-xl w-full bg-red-900/40 border border-red-800 text-red-400 font-bold text-lg cursor-not-allowed">예매가 모두 마감되었습니다</div>
        ) : selectedSeat ? (
          <>
            <p className="text-lg md:text-xl mb-6">선택된 좌석: <span className="text-blue-400 font-bold text-2xl md:text-3xl ml-2">{selectedSeat}</span></p>
            <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-8 rounded-xl w-full text-lg">예매하기</button>
          </>
        ) : <p className="text-gray-400 py-4">관람하실 좌석을 선택해주세요.</p>}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-gray-800 p-6 rounded-2xl w-full max-w-md border border-gray-600 shadow-2xl my-8">
            <h2 className="text-2xl font-bold text-white mb-6">예매 정보 입력</h2>
            <div className="space-y-4 text-left">
              <div>
                <label className="block text-gray-300 mb-1 text-sm">학번</label>
                <input type="text" name="studentId" value={formData.studentId} onChange={handleInputChange} className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 outline-none" placeholder="예: 2703 (교직원은 '교직원')"/>
              </div>
              <div>
                <label className="block text-gray-300 mb-1 text-sm">이름 (본명)</label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 outline-none" placeholder="이름을 정확히 입력하세요"/>
              </div>
              <div>
                <label className="block text-gray-300 mb-1 text-sm">예매 확인용 비밀번호 (숫자 4자리)</label>
                <input type="password" name="password" maxLength={4} value={formData.password} onChange={handleInputChange} className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 outline-none" placeholder="반드시 숫자 4자리 입력"/>
                <p className="text-red-400 text-xs mt-1 font-bold">* 좌석 변경 및 영화관 입장 확인 시 필요하므로 절대 잊어버리지 마세요!</p>
                {showResetButton && (
                  <button onClick={handleRequestReset} disabled={isResetting} className="mt-3 text-sm text-yellow-400 hover:text-yellow-300 underline underline-offset-4 font-bold block w-full text-left">
                    {isResetting ? "메일 발송 중..." : "🚨 본인인데 비밀번호를 모르겠나요? (이메일로 재설정)"}
                  </button>
                )}
              </div>
              
              <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                <label className="block text-gray-300 mb-3 text-sm font-bold">🍿 팝콘 선택 (개당 2,500원)</label>
                
                {popcornList.map((pop, idx) => (
                  <div key={idx} className="mb-3 flex items-center gap-2">
                    <span className="text-gray-500 text-xs w-12 text-center">
                      {pop === 'none' ? '추가' : `선택 ${idx + 1}`}
                    </span>
                    <select 
                      value={pop} 
                      onChange={(e) => handlePopcornChange(idx, e.target.value)} 
                      className={`flex-1 p-3 rounded-lg bg-gray-700 text-white border ${pop !== 'none' ? 'border-yellow-500' : 'border-gray-600'} outline-none`}
                    >
                      <option value="none">{pop === 'none' ? '+ 팝콘 추가하기 (무료 관람)' : '선택 취소'}</option>
                      <option value="original">오리지널 버터 팝콘 (2,500원)</option>
                      <option value="consomme">콘소메맛 팝콘 (2,500원)</option>
                      <option value="caramel">카라멜맛 팝콘 (2,500원)</option>
                    </select>
                  </div>
                ))}
                
                <p className="text-xs text-gray-400 mt-2">* 원하는 만큼 여러 개를 추가할 수 있습니다! (음료는 개별 지참)</p>
                
                {totalPrice > 0 && (
                  <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-600 rounded-lg flex justify-between items-center">
                    <span className="text-yellow-500 font-bold">총 결제 예정 금액</span>
                    <span className="text-2xl font-black text-yellow-400">{totalPrice.toLocaleString()}원</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-4 mt-8">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-bold transition-colors">취소</button>
              <button onClick={handleSubmit} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold transition-colors">확인</button>
            </div>
          </div>
        </div>
      )}

      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60]">
          <div className="bg-gray-800 p-8 rounded-2xl max-w-sm border border-yellow-600 text-center shadow-2xl">
            <h2 className="text-2xl font-bold text-yellow-500 mb-2">결제 대기 중</h2>
            <p className="text-gray-300 mb-6 text-sm">QR코드로 30분 내에 입금해주세요.</p>
            <div className="bg-white p-4 rounded-xl mb-6 inline-block"><img src="/qr.jpeg" alt="QR" className="w-48 h-48 object-contain" /></div>
            <div className="bg-gray-700 rounded-lg p-4 text-left mb-6">
              <p className="text-sm text-gray-300 mb-1">결제 금액: <span className="text-yellow-400 font-bold text-xl">{totalPrice.toLocaleString()}원</span></p>
              <p className="text-sm text-gray-300">입금자명: <span className="text-blue-400 font-bold">{formData.studentId} {formData.name}</span></p>
            </div>
            <button onClick={() => { setIsPaymentModalOpen(false); setSelectedSeat(null); }} className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold transition-colors">닫기</button>
          </div>
        </div>
      )}

      {clickedSeatInfo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-gray-800 p-8 rounded-2xl max-w-sm w-full border border-gray-600 shadow-2xl text-center">
            <h2 className="text-2xl font-bold text-white mb-4">
              좌석 정보 <span className="text-blue-400">[{clickedSeatInfo.seatId}]</span>
            </h2>
            
            {clickedSeatInfo.status === 'pending' ? (
              <div className="mb-6 border border-yellow-600 bg-yellow-900/20 p-4 rounded-xl">
                <p className="text-yellow-500 font-bold mb-4">⏳ 결제 대기 중인 좌석입니다</p>
                <div className="bg-white p-3 rounded-xl inline-block mb-3 shadow-lg">
                  <img src="/qr.jpeg" alt="송금 QR" className="w-32 h-32 object-contain" />
                </div>
                <p className="text-sm text-yellow-300 font-bold">입금 후 관리자가 확인 시<br/>예매가 최종 완료됩니다.</p>
              </div>
            ) : (
              <div className="mb-6 border border-green-600 bg-green-900/20 p-4 rounded-xl">
                <p className="text-green-400 font-bold">✅ 예매가 확정된 좌석입니다.</p>
              </div>
            )}

            <div className="space-y-3">
              {clickedSeatInfo.popcorn !== 'none' && clickedSeatInfo.status === 'confirmed' ? (
                <button disabled className="w-full py-3 bg-gray-600 rounded-lg text-red-300 font-bold shadow-lg cursor-not-allowed">
                  🚫 결제 완료된 팝콘 예매 취소 불가 (자리 변경만 가능)
                </button>
              ) : (
                <button onClick={() => window.location.href = `/cancel?ticketId=${clickedSeatInfo.ticketId}`} className="w-full py-3 bg-red-600 hover:bg-red-500 rounded-lg text-white font-bold transition-colors shadow-lg">
                  🚨 예매 취소하기
                </button>
              )}
              
              <button onClick={() => alert(`🔄 [자리 변경 안내]\n\n자리를 변경하시려면 현재 창을 닫고, 원하시는[새로운 빈 좌석]을 클릭하세요.\n기존과 동일한 학번, 이름, 비밀번호를 입력하여 예매하시면\n기존 자리가 자동으로 취소되고 새 자리로 이동됩니다!`)} className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold transition-colors shadow-lg">
                🔄 자리 변경 방법 보기
              </button>
              
              <button onClick={() => setClickedSeatInfo(null)} className="w-full py-3 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-bold transition-colors">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-32 md:mt-40 mb-8 text-center w-full opacity-30 hover:opacity-100 transition-opacity duration-500">
        <p className="text-[11px] md:text-xs text-gray-400 font-light tracking-wide">
          Crafted by <span className="font-semibold text-gray-300">Shin Mingyu</span> with <span className="font-semibold text-blue-400/80">Google AI Studio</span>
        </p>
        <p className="text-[9px] md:text-[10px] text-gray-600 mt-1.5 tracking-widest uppercase">
          Powered by Supabase & Vercel
        </p>
      </footer>
    </div>
  );
}
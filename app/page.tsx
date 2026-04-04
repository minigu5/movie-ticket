"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { USER_EMAILS } from '../lib/emails';

const STUDENT_LIST: Record<string, string> = {
  "1101": "김세준", "1102": "김시우", "1103": "김연우", "1104": "김윤재", "1105": "박시현", "1106": "배하준", "1107": "손민재", "1108": "이동건", "1109": "이주원", "1110": "이주형", "1111": "이지훈", "1112": "이하은", "1113": "전시윤", "1114": "정윤재", "1115": "차승민", "1116": "최은성",
  "1201": "김민우", "1202": "김민찬", "1203": "김시현", "1204": "김현서", "1205": "김현성", "1206": "류도헌", "1207": "배성호", "1208": "손시흔", "1209": "옥지훈", "1210": "이건우", "1211": "임해준", "1212": "장민하", "1213": "주지환", "1214": "최우진", "1215": "최윤서", "1216": "최정원", "1217": "최지요",
  "1301": "강도겸", "1302": "고민석", "1303": "김희정", "1304": "박라원", "1305": "박준영", "1306": "신강우", "1307": "신동희", "1308": "오경택", "1309": "윤정우", "1310": "이민희", "1311": "이승현", "1312": "이시안", "1313": "이희승", "1314": "임용준", "1315": "정재우", "1316": "조현찬", "1317": "천현서",
  "1401": "권예준", "1402": "김보미", "1403": "김율", "1404": "김학현", "1405": "문도윤", "1406": "박기준", "1407": "박지성", "1408": "배채준", "1409": "서현우", "1410": "윤영식", "1411": "이건우", "1412": "이민결", "1413": "전시후", "1414": "조민준", "1415": "조은준", "1416": "최미성", "1417": "하시원",
  "1501": "김나연", "1502": "김백호", "1503": "김의준", "1504": "박예준", "1505": "박준현", "1506": "방극찬", "1507": "양재우", "1508": "윤나경", "1509": "윤상현", "1510": "윤채원", "1511": "이승윤", "1512": "이준하", "1513": "장현우", "1514": "전준현", "1515": "최선", "1516": "홍재윤", "1517": "황윤찬",
  "1601": "강민겸", "1602": "강민균", "1603": "김건도", "1604": "김상현", "1605": "김주아", "1606": "김준호", "1607": "나연우", "1608": "박상원", "1609": "박윤후", "1610": "성준서", "1611": "안소이", "1612": "오주원", "1613": "이동준", "1614": "이채린", "1615": "정우진", "1616": "최준혁", "1617": "황의정",
  "2101": "고도균", "2102": "김동환", "2103": "김예슬", "2104": "김의겸", "2105": "박예찬", "2106": "박지윤", "2107": "서제나", "2108": "손명규", "2109": "안시준", "2110": "안재훈", "2111": "엄지우", "2112": "이승빈", "2113": "이지훈", "2114": "장인호", "2115": "정서범",
  "2201": "김서후", "2202": "김성윤", "2203": "김승현", "2204": "김은결", "2205": "박시후", "2206": "서준서", "2207": "성윤건", "2208": "신민규", "2209": "이소민", "2210": "이예인", "2211": "조승우", "2212": "최성준", "2213": "최아성", "2214": "최율", "2215": "최준서",
  "2301": "곽지원", "2302": "김민재", "2303": "남연우", "2304": "노유나", "2305": "박우주", "2306": "박주찬", "2307": "박지효", "2308": "이예서", "2309": "이재준", "2310": "정우성", "2311": "정원준", "2312": "천승준", "2313": "최서울", "2314": "추미강", "2315": "홍지민",
  "2401": "강승유", "2402": "구민준", "2403": "구성현", "2404": "권민재", "2405": "김민규", "2406": "김시현", "2407": "김태율", "2408": "박도윤", "2409": "박예완", "2410": "이시영", "2411": "이영휘", "2412": "장준혁", "2413": "장현준", "2414": "정원석", "2415": "정유태", "2416": "최준모",
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

// 🌟 [추가됨] 영화대교 동아리 회원 명단
const CLUB_MEMBERS =["2101", "2109", "2115", "2208", "2305", "2412", "2507", "2509", "2605", "2606"];

interface SeatData {
  status: string;
  name: string;
}

// 🌟 [주의] 파일 맨 위의 STUDENT_LIST, STAFF_LIST, CLUB_MEMBERS 는 지우지 마세요!
// 그 아래쪽 export default function Home() 부터 파일 맨 끝까지를 이 코드로 덮어쓰세요!

export default function Home() {
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const[seatStatuses, setSeatStatuses] = useState<Record<string, SeatData>>({});
  const[blacklistedUsers, setBlacklistedUsers] = useState<string[]>([]);
  const [isClosed, setIsClosed] = useState(false);

  const [movieInfo, setMovieInfo] = useState({
    title: "로딩 중...", date_string: "로딩 중...", db_date: "", venue: "대구과학고등학교 중강당",
    poster_url: "/poster.jpg", deadline_date: "2099-12-31T23:59:00+09:00",
    vip_start_row: "A", vip_end_row: "C", vip_start_col: 5, vip_end_col: 10
  });

  const [formData, setFormData] = useState({
    studentId: '', name: '', password: '', popcorn: 'none'
  });

  // 🌟 [추가됨] 장소에 따라 좌석 배열(Grid) 동적 계산
  const isGrandHall = movieInfo.venue.includes('대강당');
  
  const rows = isGrandHall 
    ?['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R'] // 대강당 18줄
    :['A','B','C','D','E','F','G','H','I']; // 중강당 9줄

  const cols = isGrandHall 
    ? Array.from({ length: 27 }, (_, i) => i + 1) // 대강당 27칸
    : Array.from({ length: 14 }, (_, i) => i + 1); // 중강당 14칸

  useEffect(() => {
    fetchInitialData();
  },[]);

  const fetchInitialData = async () => {
    try {
      const { data: settingsData } = await supabase.from('movie_settings').select('*').eq('id', 1).single();
      let currentDbDate = "2026-04-18";
      
      if (settingsData) {
        setMovieInfo(settingsData);
        currentDbDate = settingsData.db_date;
        if (new Date() > new Date(settingsData.deadline_date)) setIsClosed(true);
      }

      const { data: resData } = await supabase.from('reservations').select('seat_number, payment_status, student_name').eq('movie_date', currentDbDate);
      if (resData) {
        const newStatuses: Record<string, SeatData> = {};
        resData.forEach((res) => {
          if (res.payment_status === 'pending' || res.payment_status === 'confirmed') {
            newStatuses[res.seat_number] = { status: res.payment_status, name: res.student_name };
          }
        });
        setSeatStatuses(newStatuses);
      }

      const { data: bgData } = await supabase.from('blacklist').select('student_id');
      if (bgData) setBlacklistedUsers(bgData.map(b => b.student_id));
    } catch (err) {
      console.error("데이터 불러오기 오류:", err);
    }
  };

  const handleSeatClick = (seatId: string) => {
    if (isClosed || seatStatuses[seatId]) return;
    setSelectedSeat(seatId);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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

    if (blacklistedUsers.includes(cleanStudentId)) {
      alert("🚫 귀하는 블랙리스트에 등록되어 예매가 제한되었습니다.\n관리자에게 문의해주세요.");
      return;
    }

    const rowChar = selectedSeat!.charAt(0);
    const colNum = parseInt(selectedSeat!.slice(1));
    const isVipSeat = rowChar.charCodeAt(0) >= movieInfo.vip_start_row.charCodeAt(0) && rowChar.charCodeAt(0) <= movieInfo.vip_end_row.charCodeAt(0) && colNum >= movieInfo.vip_start_col && colNum <= movieInfo.vip_end_col;

    if (isVipSeat && !CLUB_MEMBERS.includes(cleanStudentId)) {
      alert("👑 선택하신 좌석은 '영화대교' 동아리 전용 좌석입니다. 다른 좌석을 선택해주세요!");
      return;
    }

    const isAgree = confirm("예매를 확정하시겠습니까?\n확정 시 입력하신 정보로 티켓이 발송됩니다.");
    if (!isAgree) return;

    try {
      const { data: existingTickets } = await supabase.from('reservations').select('id, password, payment_status, seat_number').eq('movie_date', movieInfo.db_date).eq('student_id', cleanStudentId);
      const baseUrl = window.location.origin;
      const userEmail = cleanStudentId === "교직원" ? USER_EMAILS[formData.name] : USER_EMAILS[cleanStudentId];

      if (existingTickets && existingTickets.length > 0) {
        const myOldTicket = existingTickets[0];
        if (myOldTicket.password !== formData.password) return alert("❌ 비밀번호가 일치하지 않습니다.");
        if (!confirm(`이미 예약된 좌석(${myOldTicket.seat_number})을 새로운 좌석(${selectedSeat})으로 변경하시겠습니까?`)) return;

        const { data: updatedTicket, error: updateError } = await supabase.from('reservations').update({ seat_number: selectedSeat, popcorn_order: formData.popcorn }).eq('id', myOldTicket.id).select('id').single();
        if (updateError) return alert("변경 중 오류 발생 (이미 선점된 좌석일 수 있습니다).");

        if (userEmail && updatedTicket) {
          fetch('/api/ticket', { method: 'POST', body: JSON.stringify({ email: userEmail, name: formData.name, seat: selectedSeat, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, statusType: 'changed', popcorn: formData.popcorn, ticketId: updatedTicket.id, baseUrl }) });
        }
        alert("✨ 좌석이 변경되었습니다! 티켓이 재발송되었습니다.");
        fetchInitialData(); setIsModalOpen(false); setSelectedSeat(null); setFormData({ studentId: '', name: '', password: '', popcorn: 'none' });
        return;
      }

      const finalStatus = formData.popcorn === 'none' ? 'confirmed' : 'pending';
      const { data: newTicket, error: insertError } = await supabase.from('reservations').insert([{ movie_date: movieInfo.db_date, student_id: cleanStudentId, student_name: formData.name, password: formData.password, seat_number: selectedSeat, popcorn_order: formData.popcorn, payment_status: finalStatus }]).select('id').single();

      if (insertError) {
        alert("앗! 다른 분이 먼저 예매했습니다.");
        fetchInitialData(); return;
      }

      setSeatStatuses((prev) => ({ ...prev,[selectedSeat as string]: { status: finalStatus, name: formData.name } }));
      setIsModalOpen(false); 

      if (userEmail && newTicket) {
        fetch('/api/ticket', { method: 'POST', body: JSON.stringify({ email: userEmail, name: formData.name, seat: selectedSeat, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, statusType: finalStatus, popcorn: formData.popcorn, ticketId: newTicket.id, baseUrl }) });
      }

      if (finalStatus === 'confirmed') {
        alert(`${formData.name}님, 예매 확정! 📧 티켓 발송 완료!`);
        setSelectedSeat(null); setFormData({ studentId: '', name: '', password: '', popcorn: 'none' });
      } else {
        alert(`📧 예매 안내 메일이 발송되었습니다! (결제 후 확정)`);
        setIsPaymentModalOpen(true);
      }
    } catch (err) {
      alert("네트워크 오류가 발생했습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 flex flex-col items-center select-none overflow-x-hidden">
      <h1 className="text-2xl md:text-3xl font-bold mb-6 text-blue-400">영화대교 예매 시스템</h1>

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

      <div className="w-full max-w-4xl h-10 bg-gray-300 rounded-t-3xl flex items-center justify-center mb-8 md:mb-16">
        <span className="text-gray-800 font-bold tracking-[0.5em] text-sm md:text-base">SCREEN</span>
      </div>

      <div className="relative w-full overflow-x-auto pb-8">
        {isClosed && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm rounded-xl">
            <span className="text-4xl font-black text-red-500 drop-shadow-lg transform -rotate-12 border-4 border-red-500 p-4 rounded-xl">예매가 마감되었습니다</span>
          </div>
        )}

        <div className="flex flex-col gap-1 md:gap-2 min-w-max px-4 w-fit mx-auto">
          {rows.map((row) => (
            <div key={row} className={`flex items-center gap-1 md:gap-2 ${isGrandHall && row === 'H' ? 'mb-8 md:mb-12' : ''}`}>
              <span className="w-4 md:w-6 text-center font-bold text-gray-500 text-[10px] md:text-xs">{row}</span>
              
              <div className="flex gap-1 md:gap-2">
                {cols.map((col) => {
                  const seatId = `${row}${col}`;
                  const isSelected = selectedSeat === seatId;
                  
                  // 🌟 [추가됨] 장소에 따른 복도 위치 동적 계산
                  const isAisle = isGrandHall ? (col === 9 || col === 18) : (col === 7);
                  const aisleMargin = isGrandHall ? 'mr-4 md:mr-8' : 'mr-8 md:mr-12';
                  
                  // 🌟 [추가됨] 대강당일 때 버튼 사이즈 줄이기
                  const btnSize = isGrandHall ? 'w-7 h-7 md:w-8 md:h-8' : 'w-9 h-9 md:w-11 md:h-11';

                  const seatData = seatStatuses[seatId];
                  const isConfirmed = seatData?.status === 'confirmed';
                  const isPending = seatData?.status === 'pending';
                  const isReserved = isConfirmed || isPending;

                  const isVipSeat = row.charCodeAt(0) >= movieInfo.vip_start_row.charCodeAt(0) && row.charCodeAt(0) <= movieInfo.vip_end_row.charCodeAt(0) && col >= movieInfo.vip_start_col && col <= movieInfo.vip_end_col;

                  // 이름이 길면 모바일에서 깨지므로 2글자로 자름
                  const displayText = isReserved ? seatData.name.substring(0, 2) : seatId;
                  const textSize = isReserved 
                    ? (isGrandHall ? 'text-[8px] tracking-tighter' : 'text-[10px] md:text-xs tracking-tighter') 
                    : (isGrandHall ? 'text-[9px] md:text-[10px]' : 'text-xs md:text-sm');

                  return (
                    <div key={seatId} className={`flex ${isAisle ? aisleMargin : ''}`}>
                      <button
                        onClick={() => handleSeatClick(seatId)}
                        disabled={isReserved || isClosed} 
                        className={`${btnSize} ${textSize} rounded-t-xl rounded-b-md flex items-center justify-center font-bold transition-all
                          ${isConfirmed ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700' 
                            : isPending ? 'bg-yellow-600/20 border border-yellow-600 text-yellow-500 cursor-not-allowed animate-pulse'
                            : isSelected ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)] transform -translate-y-1' 
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
              <span className="w-4 md:w-6 text-center font-bold text-gray-500 text-[10px] md:text-xs ml-1 md:ml-2">{row}</span>
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
           <div className="py-4 px-8 rounded-xl w-full bg-red-900/40 border border-red-800 text-red-400 font-bold text-lg cursor-not-allowed">
             예매가 모두 마감되었습니다
           </div>
        ) : selectedSeat ? (
          <>
            <p className="text-lg md:text-xl mb-6">선택된 좌석: <span className="text-blue-400 font-bold text-2xl md:text-3xl ml-2">{selectedSeat}</span></p>
            <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-8 rounded-xl w-full text-lg">예매하기</button>
          </>
        ) : <p className="text-gray-400 py-4">관람하실 좌석을 선택해주세요.</p>}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 p-6 rounded-2xl w-full max-w-md border border-gray-600 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6">예매 정보 입력</h2>
            <div className="space-y-4 text-left">
              <div><label className="block text-gray-300 mb-1 text-sm">학번</label><input type="text" name="studentId" value={formData.studentId} onChange={handleInputChange} className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 outline-none" placeholder="예: 2208 (교직원은 '교직원')"/></div>
              <div><label className="block text-gray-300 mb-1 text-sm">이름 (본명)</label><input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 outline-none" placeholder="이름을 정확히 입력하세요"/></div>
              <div><label className="block text-gray-300 mb-1 text-sm">예매 확인용 비밀번호 (숫자 4자리)</label><input type="password" name="password" maxLength={4} value={formData.password} onChange={handleInputChange} className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 outline-none" placeholder="반드시 숫자 4자리 입력"/><p className="text-red-400 text-xs mt-1 font-bold">* 좌석 변경 시 필요하므로 절대 잊어버리지 마세요!</p></div>
              <div>
                <label className="block text-gray-300 mb-1 text-sm">팝콘 선택 (모두 2,500원)</label>
                <select name="popcorn" value={formData.popcorn} onChange={handleInputChange} className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 outline-none">
                  <option value="none">선택 안함 (무료 관람)</option><option value="original">오리지널 버터 팝콘 (2,500원)</option><option value="consomme">콘소메맛 팝콘 (2,500원)</option><option value="caramel">카라멜맛 팝콘 (2,500원)</option>
                </select>
                <p className="text-xs text-gray-400 mt-2">* 음료는 개별 지참 부탁드립니다!</p>
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-gray-600 rounded-lg text-white font-bold">취소</button>
              <button onClick={handleSubmit} className="flex-1 py-3 bg-blue-600 rounded-lg text-white font-bold">확인</button>
            </div>
          </div>
        </div>
      )}

      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60]">
          <div className="bg-gray-800 p-8 rounded-2xl max-w-sm border border-yellow-600 text-center">
            <h2 className="text-2xl font-bold text-yellow-500 mb-2">결제 대기 중</h2>
            <p className="text-gray-300 mb-6 text-sm">QR코드로 30분 내에 입금해주세요.</p>
            <div className="bg-white p-4 rounded-xl mb-6"><img src="/qr.jpeg" alt="QR" className="w-48 h-48 object-contain" /></div>
            <div className="bg-gray-700 rounded-lg p-4 text-left mb-6">
              <p className="text-sm text-gray-300">결제 금액: <span className="text-white font-bold text-lg">2,500원</span></p>
              <p className="text-sm text-gray-300">입금자명: <span className="text-blue-400 font-bold">{formData.studentId} {formData.name}</span></p>
            </div>
            <button onClick={() => { setIsPaymentModalOpen(false); setSelectedSeat(null); setFormData({ studentId: '', name: '', password: '', popcorn: 'none' }); }} className="w-full py-3 bg-blue-600 rounded-lg text-white font-bold">닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { USER_EMAILS } from '@/lib/emails';
import Link from 'next/link';

// (STUDENT_LIST, STAFF_LIST 명단은 기존 그대로 유지)

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

const STAFF_LIST = [
  "강윤석", "권순정", "김가은", "김동우", "김미정", "김민정", "김상용", "김선옥", "김성진", "김수정", "김승철", "김윤주", "김정석", "김제훈", "김종수", "김종하", "김현심", "도동현", "류상욱", "마예리", "문우현", "박나연", "박소영", "박순덕", "박영희", "박정수", "박준홍", "박진환", "박현숙", "박홍", "배태윤", "백은희", "서미경", "서승은", "손영호", "손중록", "송미희", "송석준", "전리해", "엄경애", "옥창규", "우태성", "우희정", "윤소영", "윤수진", "윤정호", "이계화", "이민아", "이상규", "이승재", "이용호", "이윤아", "이재용", "이재욱", "이재웅", "이주열", "이준구", "이준열", "이지영", "이태현", "이형준", "전경희", "정재환", "정진실", "정휘정", "조우주", "조유경", "주혜령", "채대철", "최유리", "최재선", "추재석", "추철우", "허완규", "홍현주", "황영순"
];


export default function KioskPrintPage() {
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');

  const [formData, setFormData] = useState({ studentId: '', name: '', password: '' });
  const [movieInfo, setMovieInfo] = useState<any>(null);

  const [ticketData, setTicketData] = useState<any>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const [showResetButton, setShowResetButton] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('skip_auth') === 'true') {
      setIsAdminAuth(true);
    }
  }, []);

  useEffect(() => {
    const fetchMovie = async () => {
      // 🌟 [수정됨] DB에서 age_rating(관람가)도 함께 불러옵니다.
      const { data } = await supabase.from('movie_settings').select('title, date_string, db_date, venue, age_rating').eq('id', 1).single();
      if (data) setMovieInfo(data);
    };
    fetchMovie();
  }, []);

  useEffect(() => {
    if (ticketData) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [ticketData]);

  useEffect(() => {
    const handleAfterPrint = () => {
      setTicketData(null);
      setFormData({ studentId: '', name: '', password: '' });
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAdminLogin = () => {
    if (adminPasswordInput === "영화대교최고") {
      setIsAdminAuth(true);
    } else {
      alert("관리자 비밀번호가 틀렸습니다.");
      setAdminPasswordInput('');
    }
  };

  const handleRequestReset = async () => {
    const cleanId = formData.studentId.replace(/['"]/g, '').trim();
    setIsResetting(true);
    try {
      const res = await fetch('/api/auth/request-reset', {
        method: 'POST',
        body: JSON.stringify({ studentId: cleanId, studentName: formData.name, baseUrl: window.location.origin, returnUrl: '/print' })
      });
      if (res.ok) {
        alert("학교 이메일로 비밀번호 재설정 링크가 발송되었습니다. 폰에서 확인해주세요!");
        setShowResetButton(false);
      } else {
        alert("이메일 발송에 실패했습니다.");
      }
    } finally {
      setIsResetting(false);
    }
  };

  const handlePrintSubmit = async () => {
    if (!formData.studentId || !formData.name || !formData.password) return alert("정보를 모두 입력해주세요.");
    const cleanId = formData.studentId.replace(/['"]/g, '').trim();

    if (cleanId === "교직원") {
      if (!STAFF_LIST.includes(formData.name)) return alert("등록된 교직원 이름이 아닙니다.");
    } else {
      if (cleanId.length !== 4) return alert("학번은 4자리 숫자로 입력해주세요.");
      if (STUDENT_LIST[cleanId] !== formData.name) return alert("학번과 이름이 일치하지 않습니다.");
    }

    if (isPrinting) return;
    setIsPrinting(true);

    try {
      const authKey = cleanId === "교직원" ? formData.name : cleanId;
      const { data: authData } = await supabase.from('student_auth').select('password').eq('student_id', authKey).single();

      if (!authData || authData.password !== formData.password) {
        setShowResetButton(true);
        return alert("❌ 비밀번호가 일치하지 않습니다.");
      } else {
        setShowResetButton(false);
      }

      const { data: ticket } = await supabase.from('reservations')
        .select('*')
        .eq('student_id', cleanId)
        .eq('student_name', formData.name)
        .eq('movie_date', movieInfo.db_date)
        .single();

      if (!ticket) return alert("예매 내역이 존재하지 않습니다.");

      if (ticket.is_printed) {
        return alert("⚠️ 이미 현장에서 발권이 완료된 티켓입니다! (1인 1매 원칙)\n오류인 경우 관리자에게 문의하세요.");
      }

      await supabase.from('reservations').update({ is_printed: true }).eq('id', ticket.id);
      await supabase.from('activity_logs').insert([{ student_id: cleanId, student_name: formData.name, description: `현장 KIOSK 티켓 발권 완료 (${ticket.seat_number})` }]);

      setTicketData(ticket);

    } catch (err) {
      alert("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsPrinting(false);
    }
  };

  if (!isAdminAuth) {
    // ... (기존 로그인 UI 화면 동일하므로 생략하지 않고 그대로 포함합니다.)
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
        <div className="bg-gray-800 p-8 rounded-xl max-w-sm w-full text-center border border-yellow-600 shadow-2xl">
          <h1 className="text-2xl font-bold text-yellow-500 mb-6">🖨️ KIOSK 발권기 접속</h1>
          <p className="text-gray-400 text-sm mb-6">원활한 현장 발권 준비를 위해<br />관리자 비밀번호를 입력해주세요.</p>
          <input
            type="password"
            value={adminPasswordInput}
            onChange={(e) => setAdminPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
            className="w-full p-4 rounded-lg bg-gray-700 text-white border border-gray-600 mb-6 text-center outline-none focus:border-yellow-500"
            placeholder="비밀번호 입력"
          />
          <button
            onClick={handleAdminLogin}
            className="w-full py-4 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-black font-bold text-lg"
          >
            발권기 열기
          </button>
          <button
            onClick={() => setIsAdminAuth(true)}
            className="w-full py-4 mt-3 bg-gray-700 hover:bg-gray-600 border border-yellow-800 rounded-lg text-yellow-500 font-bold text-lg transition-colors"
          >
            👀 예외 접속 (누구나 - 베타 한정)
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          @page { margin: 5mm; size: auto; }
          body { background-color: #fff !important; color: #000 !important; }
        }
      `}} />

      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 print:bg-white print:text-black print:min-h-0 print:p-0 print:block select-none">

        {!ticketData ? (
          <>
            <div className="w-full max-w-md bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-600 print:hidden">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-yellow-500 tracking-wider mb-2">현장 발권기</h1>
                <p className="text-gray-400 text-sm">현장에서 예매 티켓을 스티커/영수증으로 출력합니다.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 mb-1 text-sm font-bold">학번</label>
                  <input type="text" name="studentId" value={formData.studentId} onChange={handleInputChange} className="w-full p-4 rounded-xl bg-gray-700 text-white border border-gray-600 outline-none focus:border-yellow-500 text-lg" placeholder="예: 2703" />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1 text-sm font-bold">이름</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full p-4 rounded-xl bg-gray-700 text-white border border-gray-600 outline-none focus:border-yellow-500 text-lg" placeholder="본명 입력" />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1 text-sm font-bold">예매 비밀번호 (숫자 4자리)</label>
                  <input type="password" name="password" maxLength={4} value={formData.password} onChange={handleInputChange} className="w-full p-4 rounded-xl bg-gray-700 text-white border border-gray-600 outline-none focus:border-yellow-500 text-center text-2xl tracking-widest" placeholder="****" />
                  {showResetButton && (
                    <button onClick={handleRequestReset} disabled={isResetting} className="mt-3 text-sm text-red-400 hover:text-red-300 underline font-bold block w-full text-left">
                      {isResetting ? "메일 발송 중..." : "🚨 비밀번호를 잊으셨나요? (폰으로 재설정 링크 받기)"}
                    </button>
                  )}
                </div>
              </div>

              <button onClick={handlePrintSubmit} disabled={isPrinting} className="w-full mt-8 py-4 bg-yellow-600 hover:bg-yellow-500 text-black font-black text-xl rounded-xl shadow-[0_0_20px_rgba(202,138,4,0.4)] transition-all">
                {isPrinting ? '티켓 정보 확인 중...' : '🖨️ 영수증 티켓 출력하기'}
              </button>
            </div>
          </>
        ) : (
          <div className="w-[80mm] mx-auto bg-white text-black font-mono print:w-full print:m-0 print:px-4">

            <div className="text-center text-2xl font-black mb-1 tracking-widest pt-2">영화대교 입장권</div>
            <div className="text-[11px] text-center text-gray-700 mb-2">{new Date().toLocaleString()} (현장_KIOSK_1)</div>

            <div className="border-b-2 border-dashed border-black my-2"></div>

            {/* 🌟 [수정됨] DB에 저장된 관람가(age_rating)를 동적으로 반영합니다. 기본값은 전체관람가 */}
            <div className="text-[13px] font-bold">2D, {movieInfo?.age_rating || '전체관람가'}</div>
            <div className="text-3xl font-black leading-tight tracking-tighter my-1">{movieInfo?.title}</div>

            {/* 🌟 [수정됨] 배경 반전을 지우고 검은색 두꺼운 테두리와 굵은 글씨로 흐려짐(연하게 찍힘) 문제 해결 */}
            <div className="text-[15px] font-extrabold border-[3px] border-black inline-block px-2 py-1 mb-2 mt-1">상영일시: {movieInfo?.date_string} (시험 다음날 토요일 2차 자습)</div>

            <div className="flex justify-between items-end mt-4 mb-4">
              <div>
                <div className="text-sm font-bold">{movieInfo?.venue}</div>
                <div className="text-sm font-bold mt-1">예매자: {ticketData.student_name} ({ticketData.student_id})</div>
              </div>
              <div className="text-right">
                <div className="text-[12px] font-bold">관람석</div>
                <div className="text-4xl font-black">{ticketData.seat_number}</div>
              </div>
            </div>

            <div className="border-b-2 border-dashed border-black my-3"></div>

            <div className="text-center font-bold text-sm mb-2 mt-4">대구과학고등학교 영화대교</div>
            <div className="text-[11px] leading-relaxed mb-6 text-left font-bold">
              * 본 티켓은 1인 1매 한정으로 1회만 출력됩니다.<br />
              * 티켓 분실 시 재발권 및 입장이 불가합니다.<br />
              * 원활한 관람을 위해 시작 전 입장 바랍니다.
            </div>

            {/* 🌟 [수정됨] 외부 API 접속 차단(CORS/Adblock) 환경을 대비해 순수 React CSS 바코드 렌더러로 완전 대체 */}
            {(() => {
              const CODE39_MAP: Record<string, string> = {
                '0': 'bwbWBwBwb', '1': 'BwbWbwbwB', '2': 'bwBWbwbwB', '3': 'BwBWbwbwb',
                '4': 'bwbWBwbwB', '5': 'BwbWBwbwb', '6': 'bwBWBwbwb', '7': 'bwbWbwBwB',
                '8': 'BwbWbwBwb', '9': 'bwBWbwBwb', 'A': 'BwbwbWbwB', 'B': 'bwBwbWbwB',
                'C': 'BwBwbWbwb', 'D': 'bwbwBWbwB', 'E': 'BwbwBWbwb', 'F': 'bwBwBWbwb',
                'G': 'bwbwbWBwB', 'H': 'BwbwbWBwb', 'I': 'bwBwbWBwb', 'J': 'bwbwBWBwb',
                'K': 'BwbwbwbWB', 'L': 'bwBwbwbWB', 'M': 'BwBwbwbWb', 'N': 'bwbwBwbWB',
                'O': 'BwbwBwbWb', 'P': 'bwBwBwbWb', 'Q': 'bwbwbwBWB', 'R': 'BwbwbwBWb',
                'S': 'bwBwbwBWb', 'T': 'bwbwBwBWb', 'U': 'BWbwbwbwB', 'V': 'bWBwbwbwB',
                'W': 'BWBwbwbwb', 'X': 'bWbwBwbwB', 'Y': 'BWbwBwbwb', 'Z': 'bWBwBwbwb',
                '-': 'bWbwbwBwB', '.': 'BWbwbwBwb', ' ': 'bWBwbwBwb', '*': 'bWbwBwBwb'
              };
              const cleanId = ticketData.id.toString().replace(/-/g, '').toUpperCase();
              const displayId = cleanId.length > 16 ? cleanId.substring(0, 16) : cleanId.padStart(16, '0');
              const formattedId = displayId.match(/.{1,4}/g)?.join(' ') || displayId;
              
              const upper = `*${displayId}*`;
              const bars: string[] = [];
              for (let i = 0; i < upper.length; i++) {
                const char = upper[i];
                const pattern = CODE39_MAP[char] || CODE39_MAP['-'];
                for (let p=0; p<pattern.length; p++) bars.push(pattern[p]);
                if (i < upper.length - 1) bars.push('w');
              }
              
              let currentX = 0;
              const svgElements = bars.map((v, i) => {
                const isBlack = v.toLowerCase() === 'b';
                const isWide = v === 'B' || v === 'W';
                const width = isWide ? 3.5 : 1.5;
                
                const rect = isBlack ? (
                  <rect key={i} x={currentX} y="0" width={width} height="50" fill="#000" />
                ) : null;
                
                currentX += width;
                return rect;
              });

              return (
                <div className="flex flex-col items-center mt-2 mb-4 w-full">
                  <div className="flex justify-center h-[50px] w-full overflow-hidden">
                    <svg width={currentX} height="50" viewBox={`0 0 ${currentX} 50`} style={{ maxWidth: '100%' }}>
                      {svgElements}
                    </svg>
                  </div>
                  <div className="text-center font-mono text-[13px] font-bold tracking-[0.2em] mt-1 text-gray-800">
                    {formattedId}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

      </div>
    </>
  );
}
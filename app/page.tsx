"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// 🌟 [추가됨] 학생 명렬표 (1, 2학년) 데이터 사전
const STUDENT_LIST: Record<string, string> = {
  "1101": "김세준", "1102": "김시우", "1103": "김연우", "1104": "김윤재", "1105": "박시현",
  "1106": "배하준", "1107": "손민재", "1108": "이동건", "1109": "이주원", "1110": "이주형",
  "1111": "이지훈", "1112": "이하은", "1113": "전시윤", "1114": "정윤재", "1115": "차승민", "1116": "최은성",
  "1201": "김민우", "1202": "김민찬", "1203": "김시현", "1204": "김현서", "1205": "김현성",
  "1206": "류도헌", "1207": "배성호", "1208": "손시흔", "1209": "옥지훈", "1210": "이건우",
  "1211": "임해준", "1212": "장민하", "1213": "주지환", "1214": "최우진", "1215": "최윤서",
  "1216": "최정원", "1217": "최지요", "1301": "강도겸", "1302": "고민석", "1303": "김희정",
  "1304": "박라원", "1305": "박준영", "1306": "신강우", "1307": "신동희", "1308": "오경택",
  "1309": "윤정우", "1310": "이민희", "1311": "이승현", "1312": "이시안", "1313": "이희승",
  "1314": "임용준", "1315": "정재우", "1316": "조현찬", "1317": "천현서", "1401": "권예준",
  "1402": "김보미", "1403": "김율", "1404": "김학현", "1405": "문도윤", "1406": "박기준",
  "1407": "박지성", "1408": "배채준", "1409": "서현우", "1410": "윤영식", "1411": "이건우",
  "1412": "이민결", "1413": "전시후", "1414": "조민준", "1415": "조은준", "1416": "최미성",
  "1417": "하시원", "1501": "김나연", "1502": "김백호", "1503": "김의준", "1504": "박예준",
  "1505": "박준현", "1506": "방극찬", "1507": "양재우", "1508": "윤나경", "1509": "윤상현",
  "1510": "윤채원", "1511": "이승윤", "1512": "이준하", "1513": "장현우", "1514": "전준현",
  "1515": "최선", "1516": "홍재윤", "1517": "황윤찬", "1601": "강민겸", "1602": "강민균",
  "1603": "김건도", "1604": "김상현", "1605": "김주아", "1606": "김준호", "1608": "박상원",
  "1607": "나연우", "1609": "박윤후", "1610": "성준서", "1611": "안소이", "1612": "오주원",
  "1613": "이동준", "1614": "이채린", "1615": "정우진", "1616": "최준혁", "1617": "황의정",
  "2101": "고도균", "2102": "김동환", "2103": "김예슬", "2104": "김의겸", "2105": "박예찬",
  "2106": "박지윤", "2107": "서제나", "2108": "손명규", "2109": "안시준", "2110": "안재훈",
  "2111": "엄지우", "2112": "이승빈", "2113": "이지훈", "2114": "장인호", "2115": "정서범",
  "2201": "김서후", "2202": "김성윤", "2203": "김승현", "2204": "김은결", "2205": "박시후",
  "2206": "서준서", "2207": "성윤건", "2208": "신민규", "2209": "이소민", "2210": "이예인",
  "2211": "조승우", "2212": "최성준", "2213": "최아성", "2214": "최율", "2215": "최준서",
  "2301": "곽지원", "2302": "김민재", "2303": "남연우", "2304": "노유나", "2305": "박우주",
  "2306": "박주찬", "2307": "박지효", "2308": "이예서", "2309": "이재준", "2310": "정우성",
  "2311": "정원준", "2312": "천승준", "2313": "최서울", "2314": "추미강", "2315": "홍지민",
  "2401": "강승유", "2402": "구민준", "2403": "구성현", "2404": "권민재", "2405": "김민규",
  "2406": "김시현", "2407": "김태율", "2408": "박도윤", "2409": "박예완", "2410": "이시영",
  "2411": "이영휘", "2412": "장준혁", "2413": "장현준", "2414": "정원석", "2415": "정유태",
  "2416": "최준모", "2501": "강민석", "2502": "권미진", "2503": "김민율", "2504": "김민준",
  "2505": "김준", "2506": "김희찬", "2507": "문서욱", "2508": "안시후", "2509": "이현준",
  "2510": "임채원", "2511": "장민서", "2512": "장서율", "2513": "최여준", "2514": "허가은",
  "2515": "황유나", "2601": "김건우", "2602": "김도경", "2603": "김도현", "2604": "김동현",
  "2605": "김연호", "2606": "도현호", "2607": "류나현", "2608": "박건우", "2609": "박선율",
  "2610": "오세현", "2611": "우가희", "2612": "이민섭", "2613": "이선민", "2614": "주동준",
  "2615": "하승진"
};

export default function Home() {
  const rows =['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
  const cols = Array.from({ length: 14 }, (_, i) => i + 1);

  const[selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const[isModalOpen, setIsModalOpen] = useState(false);
  const [seatStatuses, setSeatStatuses] = useState<Record<string, string>>({});
  
  const movieDate = "2026-04-18";

  const[formData, setFormData] = useState({
    studentId: '',
    name: '',
    password: '',
    popcorn: 'none'
  });

  useEffect(() => {
    fetchReservedSeats();
  },[]);

  const fetchReservedSeats = async () => {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('seat_number, payment_status')
        .eq('movie_date', movieDate);

      if (error) {
        console.error("좌석 불러오기 오류:", error);
        return;
      }

      if (data) {
        const newStatuses: Record<string, string> = {};
        data.forEach((res) => {
          if (res.payment_status === 'pending' || res.payment_status === 'confirmed') {
            newStatuses[res.seat_number] = res.payment_status;
          }
        });
        setSeatStatuses(newStatuses);
      }
    } catch (err) {
      console.error("네트워크 오류:", err);
    }
  };

  const handleSeatClick = (seatId: string) => {
    if (seatStatuses[seatId]) return;
    setSelectedSeat(seatId);
  };

  const handleNextStep = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev,[name]: value }));
  };

  const handleSubmit = async () => {
    // 1. 기본 빈칸 및 글자 수 검사
    if (!formData.studentId || !formData.name || !formData.password) {
      alert("학번, 이름, 비밀번호를 모두 입력해주세요!");
      return;
    }
    if (formData.studentId.length !== 4) {
      alert("학번은 4자리 숫자로 입력해주세요. (예: 2208)");
      return;
    }

    // 🌟 2. 명렬표 일치 검사 (3학년 제외)
    const isThirdGrade = formData.studentId.startsWith('3');
    if (!isThirdGrade) {
      // 명렬표에 학번이 없거나, 이름이 다를 경우
      if (STUDENT_LIST[formData.studentId] !== formData.name) {
        alert(`❌ 학번(${formData.studentId})과 이름(${formData.name})이 일치하지 않거나 없는 학번입니다. 다시 확인해주세요!`);
        return; // 여기서 예매를 강제 중단시킵니다.
      }
    }

    try {
      // 🌟 3. 중복 예매 방지 (1인 1매 검사)
      const { data: existingTickets, error: fetchError } = await supabase
        .from('reservations')
        .select('id')
        .eq('movie_date', movieDate)
        .eq('student_id', formData.studentId);

      if (fetchError) throw fetchError;

      // 만약 조회된 데이터가 1개라도 있다면 이미 예매한 학생입니다.
      if (existingTickets && existingTickets.length > 0) {
        alert("🚨 이미 예매를 완료하셨습니다! 티켓은 1인당 1매만 예매 가능합니다.");
        return; // 중복 예매 강제 중단
      }

      // 4. 예매 정보 전송 (모든 검사를 통과했을 때만 실행)
      const finalStatus = formData.popcorn === 'none' ? 'confirmed' : 'pending';

      const { error: insertError } = await supabase
        .from('reservations')
        .insert([
          {
            movie_date: movieDate,
            student_id: formData.studentId,
            student_name: formData.name,
            password: formData.password,
            seat_number: selectedSeat,
            popcorn_order: formData.popcorn,
            payment_status: finalStatus
          }
        ]);

      if (insertError) {
        if (insertError.code === '23505') { 
          alert("앗! 0.1초 차이로 다른 친구가 먼저 예매한 좌석입니다. 다른 좌석을 선택해주세요!");
          fetchReservedSeats(); 
        } else {
          alert("예약 중 오류가 발생했습니다: " + insertError.message);
        }
        return;
      }

      // 5. 성공 시 마무리
      if (finalStatus === 'confirmed') {
        alert(`${formData.name}님, ${selectedSeat} 좌석 예매가 확정되었습니다! (무료 관람)`);
      } else {
        alert(`${formData.name}님, ${selectedSeat} 좌석 가예약이 완료되었습니다!\n\n30분 내로 토스/카카오페이 입금을 완료해주시면 관리자 승인 후 예매가 확정됩니다.`);
      }
      
      setSeatStatuses((prev) => ({ ...prev,[selectedSeat as string]: finalStatus }));

      setIsModalOpen(false); 
      setSelectedSeat(null); 
      setFormData({ studentId: '', name: '', password: '', popcorn: 'none' });
      
    } catch (err) {
      alert("네트워크 오류가 발생했습니다. 와이파이 연결을 확인해주세요.");
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 flex flex-col items-center select-none overflow-x-hidden">
      <h1 className="text-2xl md:text-3xl font-bold mb-8 text-blue-400">영화대교 예매 시스템</h1>

      <div className="w-full max-w-4xl h-10 bg-gray-300 rounded-t-3xl shadow-[0_0_25px_rgba(255,255,255,0.2)] flex items-center justify-center mb-8 md:mb-16">
        <span className="text-gray-800 font-bold tracking-[0.5em] text-sm md:text-base">SCREEN</span>
      </div>

      <div className="w-full overflow-x-auto pb-8">
        <div className="flex flex-col gap-3 min-w-max px-4 w-fit mx-auto">
          {rows.map((row) => (
            <div key={row} className="flex items-center gap-2">
              <span className="w-6 text-center font-bold text-gray-500">{row}</span>
              
              <div className="flex gap-2">
                {cols.map((col) => {
                  const seatId = `${row}${col}`;
                  const isSelected = selectedSeat === seatId;
                  const isAisle = col === 7;

                  const seatStatus = seatStatuses[seatId];
                  const isConfirmed = seatStatus === 'confirmed';
                  const isPending = seatStatus === 'pending';
                  const isReserved = isConfirmed || isPending;

                  return (
                    <div key={seatId} className={`flex ${isAisle ? 'mr-8 md:mr-12' : ''}`}>
                      <button
                        onClick={() => handleSeatClick(seatId)}
                        disabled={isReserved} 
                        className={`w-8 h-8 md:w-10 md:h-10 rounded-t-xl rounded-b-md flex items-center justify-center text-xs md:text-sm font-bold transition-all
                          ${isConfirmed 
                            ? 'bg-gray-800 text-gray-600 cursor-not-allowed opacity-50' 
                            : isPending
                              ? 'bg-yellow-600 text-yellow-900 cursor-not-allowed animate-pulse'
                              : isSelected 
                                ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)] transform -translate-y-1' 
                                : 'bg-gray-700 hover:bg-gray-500 text-gray-300'
                          }
                        `}
                      >
                        {isConfirmed ? 'X' : isPending ? '대기' : col} 
                      </button>
                    </div>
                  );
                })}
              </div>
              
              <span className="w-6 text-center font-bold text-gray-500 ml-2">{row}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-6 text-sm text-gray-400">
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-700 rounded-sm"></div>예매 가능</div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-yellow-600 rounded-sm"></div>입금 대기중</div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-800 rounded-sm"></div>예매 완료</div>
      </div>

      <div className="mt-8 p-6 bg-gray-800 rounded-2xl w-full max-w-xl text-center shadow-xl border border-gray-700">
        {selectedSeat ? (
          <>
            <p className="text-lg md:text-xl mb-6">
              선택된 좌석: <span className="text-blue-400 font-bold text-2xl md:text-3xl ml-2">{selectedSeat}</span>
            </p>
            <button 
              onClick={handleNextStep}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-8 rounded-xl w-full transition-colors text-lg"
            >
              다음 단계로 (예매 정보 입력)
            </button>
          </>
        ) : (
          <p className="text-gray-400 text-base md:text-lg py-4">관람하실 좌석을 선택해주세요.</p>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 p-6 md:p-8 rounded-2xl w-full max-w-md border border-gray-600 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6">예매 정보 입력</h2>
            
            <div className="space-y-4 text-left">
              <div>
                <label className="block text-gray-300 mb-1 text-sm">학번 4자리</label>
                <input 
                  type="text" name="studentId" maxLength={4} value={formData.studentId} onChange={handleInputChange}
                  className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="예: 2208"
                />
              </div>
              
              <div>
                <label className="block text-gray-300 mb-1 text-sm">이름 (본명)</label>
                <input 
                  type="text" name="name" value={formData.name} onChange={handleInputChange}
                  className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="이름을 정확히 입력하세요"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1 text-sm">예매 확인용 비밀번호 (숫자 4자리)</label>
                <input 
                  type="password" name="password" maxLength={4} value={formData.password} onChange={handleInputChange}
                  className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="****"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1 text-sm">팝콘 선택 (모두 2,500원)</label>
                <select 
                  name="popcorn" value={formData.popcorn} onChange={handleInputChange}
                  className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="none">선택 안함 (무료 관람)</option>
                  <option value="original">오리지널 버터 팝콘</option>
                  <option value="consomme">콘소메맛 팝콘</option>
                  <option value="caramel">카라멜맛 팝콘</option>
                </select>
                <p className="text-xs text-gray-400 mt-2">
                  * 음료는 개별 지참 부탁드립니다!
                </p>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button 
                onClick={closeModal}
                className="flex-1 py-3 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-bold transition-colors"
              >
                취소
              </button>
              <button 
                onClick={handleSubmit}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold transition-colors"
              >
                예매하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
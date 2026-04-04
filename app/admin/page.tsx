"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { USER_EMAILS } from '../../lib/emails';

const STUDENT_LIST: Record<string, string> = {
  "1101": "김세준", "1102": "김시우", "1103": "김연우", "1104": "김윤재", "1105": "박시현", "1106": "배하준", "1107": "손민재", "1108": "이동건", "1109": "이주원", "1110": "이주형", "1111": "이지훈", "1112": "이하은", "1113": "전시윤", "1114": "정윤재", "1115": "차승민", "1116": "최은성", "1201": "김민우", "1202": "김민찬", "1203": "김시현", "1204": "김현서", "1205": "김현성", "1206": "류도헌", "1207": "배성호", "1208": "손시흔", "1209": "옥지훈", "1210": "이건우", "1211": "임해준", "1212": "장민하", "1213": "주지환", "1214": "최우진", "1215": "최윤서", "1216": "최정원", "1217": "최지요", "1301": "강도겸", "1302": "고민석", "1303": "김희정", "1304": "박라원", "1305": "박준영", "1306": "신강우", "1307": "신동희", "1308": "오경택", "1309": "윤정우", "1310": "이민희", "1311": "이승현", "1312": "이시안", "1313": "이희승", "1314": "임용준", "1315": "정재우", "1316": "조현찬", "1317": "천현서", "1401": "권예준", "1402": "김보미", "1403": "김율", "1404": "김학현", "1405": "문도윤", "1406": "박기준", "1407": "박지성", "1408": "배채준", "1409": "서현우", "1410": "윤영식", "1411": "이건우", "1412": "이민결", "1413": "전시후", "1414": "조민준", "1415": "조은준", "1416": "최미성", "1417": "하시원", "1501": "김나연", "1502": "김백호", "1503": "김의준", "1504": "박예준", "1505": "박준현", "1506": "방극찬", "1507": "양재우", "1508": "윤나경", "1509": "윤상현", "1510": "윤채원", "1511": "이승윤", "1512": "이준하", "1513": "장현우", "1514": "전준현", "1515": "최선", "1516": "홍재윤", "1517": "황윤찬", "1601": "강민겸", "1602": "강민균", "1603": "김건도", "1604": "김상현", "1605": "김주아", "1606": "김준호", "1607": "나연우", "1608": "박상원", "1609": "박윤후", "1610": "성준서", "1611": "안소이", "1612": "오주원", "1613": "이동준", "1614": "이채린", "1615": "정우진", "1616": "최준혁", "1617": "황의정", "2101": "고도균", "2102": "김동환", "2103": "김예슬", "2104": "김의겸", "2105": "박예찬", "2106": "박지윤", "2107": "서제나", "2108": "손명규", "2109": "안시준", "2110": "안재훈", "2111": "엄지우", "2112": "이승빈", "2113": "이지훈", "2114": "장인호", "2115": "정서범", "2201": "김서후", "2202": "김성윤", "2203": "김승현", "2204": "김은결", "2205": "박시후", "2206": "서준서", "2207": "성윤건", "2208": "신민규", "2209": "이소민", "2210": "이예인", "2211": "조승우", "2212": "최성준", "2213": "최아성", "2214": "최율", "2215": "최준서", "2301": "곽지원", "2302": "김민재", "2303": "남연우", "2304": "노유나", "2305": "박우주", "2306": "박주찬", "2307": "박지효", "2308": "이예서", "2309": "이재준", "2310": "정우성", "2311": "정원준", "2312": "천승준", "2313": "최서울", "2314": "추미강", "2315": "홍지민", "2401": "강승유", "2402": "구민준", "2403": "구성현", "2404": "권민재", "2405": "김민규", "2406": "김시현", "2407": "김태율", "2408": "박도윤", "2409": "박예완", "2410": "이시영", "2411": "이영휘", "2412": "장준혁", "2413": "장현준", "2414": "정원석", "2415": "정유태", "2416": "최준모", "2501": "강민석", "2502": "권미진", "2503": "김민율", "2504": "김민준", "2505": "김준", "2506": "김희찬", "2507": "문서욱", "2508": "안시후", "2509": "이현준", "2510": "임채원", "2511": "장민서", "2512": "장서율", "2513": "최여준", "2514": "허가은", "2515": "황유나", "2601": "김건우", "2602": "김도경", "2603": "김도현", "2604": "김동현", "2605": "김연호", "2606": "도현호", "2607": "류나현", "2608": "박건우", "2609": "박선율", "2610": "오세현", "2611": "우가희", "2612": "이민섭", "2613": "이선민", "2614": "주동준", "2615": "하승진", "3101": "김건희", "3102": "김태경", "3103": "박준우", "3104": "송우주", "3105": "신윤빈", "3106": "안성민", "3107": "이민재", "3108": "이솔민", "3109": "이지헌", "3110": "임태규", "3111": "정재현", "3112": "조용민", "3113": "지승후", "3114": "최승호", "3115": "홍채민", "3201": "강지환", "3202": "김민건", "3203": "김시찬", "3204": "김재윤", "3205": "김준형", "3206": "문시현", "3207": "박주원", "3208": "이우찬", "3209": "이재언", "3210": "장현준", "3211": "정유찬", "3212": "정주영", "3213": "최우진", "3214": "최휘성", "3215": "허진우", "3301": "김대훈", "3302": "김동현", "3303": "김아린", "3304": "김한교", "3305": "노연우", "3306": "로벨즈노아", "3307": "손자훈", "3308": "엄정우", "3309": "왕지환", "3310": "이시현", "3311": "이준현", "3312": "임지웅", "3313": "전지원", "3314": "조현수", "3315": "호준혁", "3401": "김민주", "3402": "김영주", "3403": "김우현", "3404": "김은서", "3405": "김재겸", "3406": "김형빈", "3407": "민동재", "3408": "손현우", "3409": "양동민", "3410": "온주승", "3411": "이도윤", "3412": "이원찬", "3413": "전대원", "3414": "조원준", "3415": "주현섭", "3416": "최원우", "3501": "공리영", "3502": "길은수", "3503": "김대현", "3504": "김동욱", "3505": "김지원", "3506": "류태현", "3507": "류한경", "3508": "박성호", "3509": "손지형", "3510": "염예승", "3511": "이윤승", "3512": "이은성", "3513": "이준우", "3514": "이진수", "3515": "전시현", "3516": "하대엽", "3601": "권윤재", "3602": "김시준", "3603": "김율", "3604": "김태우", "3605": "박성준", "3606": "박시원", "3607": "안혜우", "3608": "양다희", "3609": "유지원", "3610": "이상민", "3611": "이수연", "3612": "이지헌", "3613": "장유승", "3614": "전재형", "3615": "조준서", "3616": "채재현"
};

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [reservations, setReservations] = useState<any[]>([]);
  const [movieInfo, setMovieInfo] = useState<any>(null);
  
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const[editForm, setEditForm] = useState<any>({});

  // 🌟 블랙리스트 상태
  const [blacklist, setBlacklist] = useState<any[]>([]);
  const [newBlackId, setNewBlackId] = useState('');

  // 👇 이 사전을 새로 추가하세요!
  const POPCORN_NAMES: Record<string, string> = {
    original: '오리지널 버터',
    consomme: '콘소메맛',
    caramel: '카라멜맛',
    none: 'X'
  };
  
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const ADMIN_PASSWORD = "영화대교최고"; 

  useEffect(() => {
    if (isAuthenticated) fetchAdminData();
  }, [isAuthenticated]);

  const fetchAdminData = async () => {
    // 영화 및 예매 내역 로드
    const { data: movieData } = await supabase.from('movie_settings').select('*').eq('id', 1).single();
    if (movieData) {
      setMovieInfo(movieData);
      setEditForm(movieData);
      const { data: resData } = await supabase.from('reservations').select('*').eq('movie_date', movieData.db_date).order('created_at', { ascending: false });
      if (resData) setReservations(resData);
    }

    // 블랙리스트 로드
    const { data: blData } = await supabase.from('blacklist').select('*').order('created_at', { ascending: false });
    if (blData) setBlacklist(blData);
  };

  const handleSaveSettings = async () => {
    if(!confirm("영화 설정을 정말 변경하시겠습니까?")) return;
    const { error } = await supabase.from('movie_settings').update({ ...editForm }).eq('id', 1);
    if (error) alert("설정 저장 실패: " + error.message);
    else { alert("✅ 설정이 성공적으로 저장되었습니다!"); setIsEditingSettings(false); fetchAdminData(); }
  };

  const handleApprove = async (ticket: any) => {
    if (!confirm(`${ticket.student_name}님의 예매를 확정하시겠습니까?`)) return;
    await supabase.from('reservations').update({ payment_status: 'confirmed' }).eq('id', ticket.id);
    const userEmail = ticket.student_id === "교직원" ? USER_EMAILS[ticket.student_name] : USER_EMAILS[ticket.student_id];
    if (userEmail) {
      await fetch('/api/ticket', { method: 'POST', body: JSON.stringify({ email: userEmail, name: ticket.student_name, seat: ticket.seat_number, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, statusType: 'confirmed', popcorn: ticket.popcorn_order, ticketId: ticket.id, baseUrl }) });
    }
    alert("승인 완료 및 확정 이메일이 발송되었습니다!");
    fetchAdminData();
  };

  const handleCancel = async (ticket: any) => {
    if (!confirm(`정말 ${ticket.student_name}님의 예매를 취소하시겠습니까?`)) return;
    await supabase.from('reservations').delete().eq('id', ticket.id);
    const userEmail = ticket.student_id === "교직원" ? USER_EMAILS[ticket.student_name] : USER_EMAILS[ticket.student_id];
    if (userEmail) {
      await fetch('/api/ticket', { method: 'POST', body: JSON.stringify({ email: userEmail, name: ticket.student_name, seat: ticket.seat_number, movieTitle: movieInfo.title, movieDate: movieInfo.date_string, statusType: 'canceled', popcorn: ticket.popcorn_order, ticketId: ticket.id, baseUrl }) });
    }
    alert("취소 완료 및 안내 이메일이 발송되었습니다!");
    fetchAdminData();
  };

  // 🌟 블랙리스트 추가
  const handleAddBlacklist = async () => {
    if(newBlackId.length !== 4) return alert("학번 4자리를 정확히 입력해주세요.");
    const studentName = STUDENT_LIST[newBlackId];
    if(!studentName) return alert("존재하지 않는 학번입니다.");
    
    if(!confirm(`${studentName}(${newBlackId}) 학생을 블랙리스트에 추가하시겠습니까?`)) return;

    const { error } = await supabase.from('blacklist').insert([{ student_id: newBlackId, student_name: studentName }]);
    if (error) return alert("추가 실패 (이미 등록된 학생일 수 있습니다.)");

    // 안내 메일 발송
    const userEmail = USER_EMAILS[newBlackId];
    if (userEmail) {
      await fetch('/api/blacklist', { method: 'POST', body: JSON.stringify({ email: userEmail, name: studentName, action: 'added' }) });
    }
    
    alert("추가 완료 및 안내 메일 발송!");
    setNewBlackId('');
    fetchAdminData();
  };

  // 🌟 블랙리스트 해제
  const handleRemoveBlacklist = async (studentId: string, studentName: string) => {
    if(!confirm(`${studentName}(${studentId}) 학생의 블랙리스트를 해제하시겠습니까?`)) return;

    await supabase.from('blacklist').delete().eq('student_id', studentId);

    const userEmail = USER_EMAILS[studentId];
    if (userEmail) {
      await fetch('/api/blacklist', { method: 'POST', body: JSON.stringify({ email: userEmail, name: studentName, action: 'removed' }) });
    }
    
    alert("해제 완료 및 안내 메일 발송!");
    fetchAdminData();
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-sm w-full text-center border border-gray-700">
          <h1 className="text-2xl font-bold text-white mb-6">🔒 관리자 로그인</h1>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && password === ADMIN_PASSWORD && setIsAuthenticated(true)}
            className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 mb-4 text-center" placeholder="비밀번호 입력" />
          <button onClick={() => password === ADMIN_PASSWORD ? setIsAuthenticated(true) : alert('비밀번호가 틀렸습니다.')}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold">접속하기</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-blue-400">👑 영화대교 관리자 대시보드</h1>
        <button onClick={() => setIsEditingSettings(!isEditingSettings)} className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg font-bold transition-colors w-full md:w-auto">
          {isEditingSettings ? '설정 닫기' : '⚙️ 영화 설정 변경'}
        </button>
      </div>

      {isEditingSettings && movieInfo && (
        <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-purple-600 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="block text-sm text-gray-400 mb-1">영화 제목</label><input type="text" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none"/></div>
          <div><label className="block text-sm text-gray-400 mb-1">상영 일시 (화면 표시용)</label><input type="text" value={editForm.date_string} onChange={e => setEditForm({...editForm, date_string: e.target.value})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none"/></div>
          <div><label className="block text-sm text-gray-400 mb-1">DB 기준 날짜 (YYYY-MM-DD)</label><input type="text" value={editForm.db_date} onChange={e => setEditForm({...editForm, db_date: e.target.value})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none"/></div>
          <div><label className="block text-sm text-gray-400 mb-1">상영 장소</label><input type="text" value={editForm.venue} onChange={e => setEditForm({...editForm, venue: e.target.value})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none"/></div>
          <div className="md:col-span-2"><label className="block text-sm text-gray-400 mb-1">포스터 주소</label><input type="text" value={editForm.poster_url} onChange={e => setEditForm({...editForm, poster_url: e.target.value})} className="w-full p-2 bg-gray-700 rounded border border-gray-600 outline-none"/></div>
          <div className="md:col-span-2"><label className="block text-sm text-red-400 font-bold mb-1">예매 마감 일시 (ISO 형식)</label><input type="text" value={editForm.deadline_date} onChange={e => setEditForm({...editForm, deadline_date: e.target.value})} className="w-full p-2 bg-gray-700 rounded border border-red-800 outline-none"/></div>
          <div className="md:col-span-2 mt-4 text-right"><button onClick={handleSaveSettings} className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg">💾 변경사항 저장</button></div>
        </div>
      )}

      {/* 🌟 블랙리스트 관리 패널 추가 */}
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
      
      {/* 예매 내역 테이블 (기존 동일) */}
      <div className="bg-gray-800 rounded-xl overflow-x-auto shadow-2xl border border-gray-700">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-gray-700 text-gray-300">
            <tr>
              <th className="p-4">상태</th>
              <th className="p-4">좌석</th>
              <th className="p-4">학번/이름</th>
              <th className="p-4">팝콘</th>
              <th className="p-4 text-right">관리 작업</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((ticket) => (
              <tr key={ticket.id} className="border-b border-gray-700 hover:bg-gray-750">
                <td className="p-4">
                  {ticket.payment_status === 'pending' ? <span className="bg-yellow-600/20 text-yellow-500 px-2 py-1 rounded border border-yellow-600">대기</span> : <span className="bg-green-600/20 text-green-500 px-2 py-1 rounded border border-green-600">확정</span>}
                </td>
                <td className="p-4 font-bold text-lg">{ticket.seat_number}</td>
                <td className="p-4">{ticket.student_id} <span className="text-blue-300">{ticket.student_name}</span></td>
                <td className="p-4 text-xs">
                {ticket.popcorn_order !== 'none' ? `🍿 ${POPCORN_NAMES[ticket.popcorn_order]}` : 'X'}
                </td>
                <td className="p-4 text-right flex justify-end gap-2">
                  {ticket.payment_status === 'pending' && <button onClick={() => handleApprove(ticket)} className="bg-green-600 px-3 py-1 rounded font-bold">✅ 승인</button>}
                  <button onClick={() => handleCancel(ticket)} className="bg-red-600 px-3 py-1 rounded font-bold">❌ 취소</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
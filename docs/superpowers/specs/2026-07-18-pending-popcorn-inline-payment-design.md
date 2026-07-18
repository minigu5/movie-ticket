# 결제 대기 중 팝콘 추가 + QR/계좌번호 상시 노출

날짜: 2026-07-18

## 배경

팝콘을 주문한 예매는 `payment_status = 'pending'`으로 시작해 관리자가 입금 확인 후 `confirmed`로 바꿔줌. 지금은 QR코드+계좌번호가 예매 직후 뜨는 1회성 결제 모달(`isPaymentModalOpen`)에만 있어서, 닫으면 다시 볼 방법이 없음. 또한 pending 상태에서 팝콘을 더 추가하고 싶어도 UI가 없어서(자리 이동 흐름에만 팝콘 변경 로직이 얹혀 있음) 불가능함.

## 범위

`app/page.tsx` 단일 파일 변경. 백엔드/DB 스키마 변경 없음.

1. 하단 `myReservation` 패널(pending 상태)에 QR코드 + 계좌번호(`AccountInfo`) + 결제 금액/입금자명을 인라인으로 상시 노출
2. 같은 패널에 "🍿 팝콘 추가" 버튼 신설 → 기존 "예매 정보 입력" 모달을 팝콘 추가 전용 모드로 재사용
3. 팝콘 추가 전용 제출 함수 신설, 좌석/상태는 그대로 두고 `popcorn_order`만 갱신

## 아키텍처 / 데이터 흐름

### 1. 인라인 QR/계좌 (패널, `myReservation.status === 'pending'` 분기 내부)
기존 배지/좌석/팝콘 개수 표시(808~814줄) 아래에 블록 추가:
- `<img src="/qr.jpeg" />` (결제 모달과 동일 크기감, `w-40 h-40` 정도로 패널에 맞게 축소)
- `<AccountInfo />` (기존 컴포넌트 그대로 재사용)
- 결제 금액: `myReservation.popcorn`을 콤마 분리한 개수 × 2500원
- 입금자명: `profile.student_id ?? ''} {profile.name}` (결제 모달과 동일 포맷)

`isPaymentModalOpen` 모달(895~909줄)은 손대지 않음 — 예매 직후 1회성 축하 팝업 역할 유지, 인라인 블록이 이후 지속 노출 역할 담당. `confirmed`로 바뀌면 `myReservation.status`가 바뀌면서 이 블록은 자동으로 사라짐(기존 realtime/polling으로 `myReservation` 갱신되는 로직 그대로 재사용, 별도 처리 불필요).

### 2. 팝콘 추가 모드
새 state: `const [isAddPopcornMode, setIsAddPopcornMode] = useState(false);`

패널에 버튼 추가:
```
<button onClick={() => {
  const existing = myReservation.popcorn && myReservation.popcorn !== 'none' ? myReservation.popcorn.split(',') : [];
  setPopcornList([...existing, 'none']);
  setIsAddPopcornMode(true);
  setIsModalOpen(true);
}}>🍿 팝콘 추가</button>
```

모달(843~894줄) 조건 변경:
- 제목: `{isAddPopcornMode ? '🍿 팝콘 추가' : '예매 정보 입력'}`
- 예매자 정보 카드(848~852줄)는 `isAddPopcornMode`일 때 숨김(좌석 정보 아니므로 불필요, 팝콘 선택 카드만 표시)
- 하단 버튼(887~891줄): `isAddPopcornMode`면 "취소"(모달 닫고 `setIsAddPopcornMode(false)`) + "추가하기"(`handleAddPopcornSubmit`) 2개만. 아니면 기존 "예매 확정하기"/"단체 예매하기" 그대로.
- 기존 취소 버튼(888줄)도 `isAddPopcornMode` 리셋하도록 `onClick`에 `setIsAddPopcornMode(false)` 추가.

### 3. `handleAddPopcornSubmit` (신규 함수)
```
const handleAddPopcornSubmit = async () => {
  if (!profile || !myReservation) return;
  const finalPopcornString = popcornList.filter(p => p !== 'none').join(',') || 'none';
  const oldPopcorns = myReservation.popcorn && myReservation.popcorn !== 'none' ? myReservation.popcorn.split(',') : [];
  const newPopcorns = finalPopcornString !== 'none' ? finalPopcornString.split(',') : [];

  if (finalPopcornString === (myReservation.popcorn || 'none')) {
    return showAlert("변경된 내용이 없습니다.");
  }
  if (newPopcorns.length < oldPopcorns.length) {
    return showAlert("🚫 결제 혼선 방지를 위해 기존에 주문한 팝콘 수량을 취소/삭제할 수 없습니다. (맛 변경 및 추가만 가능)");
  }

  const addedCount = newPopcorns.length - oldPopcorns.length;
  const confirmMsg = addedCount > 0
    ? `팝콘 ${addedCount}개를 추가하시겠습니까?\n(추가 결제 금액: ${(addedCount * 2500).toLocaleString()}원)`
    : `팝콘 주문 내용을 변경하시겠습니까?\n(맛 변경 사항이 저장됩니다)`;

  showConfirm(confirmMsg, async () => {
    const { error } = await supabase.from('reservations')
      .update({ popcorn_order: finalPopcornString })
      .eq('id', myReservation.id);
    if (error) return showAlert("팝콘 추가 중 오류가 발생했습니다.");

    await supabase.from('activity_logs').insert([{ student_id: profile.student_id, student_name: profile.name, description: `팝콘 추가 주문 (${myReservation.seat})` }]);

    setMyReservation(prev => prev ? { ...prev, popcorn: finalPopcornString } : prev);
    setSeatStatuses(prev => ({ ...prev, [myReservation.seat]: { ...prev[myReservation.seat], popcorn: finalPopcornString } }));
    setIsModalOpen(false);
    setIsAddPopcornMode(false);

    const baseUrl = window.location.origin;
    fetch('/api/ticket', { method: 'POST', body: JSON.stringify({
      email: profile.email, name: profile.name, seat: myReservation.seat,
      movieTitle: movieInfo.title, movieDate: movieInfo.date_string,
      statusType: 'pending', popcorn: finalPopcornString, ticketId: myReservation.id, baseUrl
    }) });

    showSuccess("🍿 팝콘 주문이 갱신되었습니다!", "QR코드로 갱신된 금액을 입금해주세요.");
  });
};
```

`statusType: 'pending'`을 그대로 재사용 — `app/api/ticket/route.ts`는 이미 이 타입에서 QR/계좌/총액을 이메일에 포함하므로 백엔드 수정 불필요.

## 에러 처리
- DB update 실패: alert 후 중단, 로컬 state 변경 없음
- 변경 사항 없음: alert("변경된 내용이 없습니다.") 후 중단
- 기존 팝콘 수량보다 줄이려는 시도: 기존 프로젝트 규칙(320~321줄)과 동일한 문구로 차단
- 이메일 발송 실패: 무시(기존 패턴과 동일, 예매 자체는 이미 성공 처리됨)

## 테스트/검증
- `npm run build` 통과 확인
- 로컬/배포 환경에서 실제로 팝콘 있는 pending 예매 만들고, 패널에서 QR/계좌 상시 노출 확인 + 팝콘 추가 버튼으로 수량 늘려서 이메일 재발송 확인(가능한 범위에서)

## 스코프 제외
- 팝콘 수량 축소/삭제 UI는 추가하지 않음(기존 프로젝트 규칙 유지)
- confirmed 상태에서는 QR/계좌/팝콘 추가 버튼 모두 노출 안 함(결제 끝난 건이므로)
- 관리자 페이지, 결제 확인 로직 등은 이번 변경과 무관

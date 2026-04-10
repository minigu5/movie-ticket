import nodemailer from 'nodemailer';

/**
 * [제로 코스트 이메일 로드 밸런싱]
 * Gmail SMTP의 500개/일 제한을 우회하기 위해 여러 계정을 랜덤하게 선택합니다.
 * 환경 변수: GMAIL_USER_1, GMAIL_APP_PASSWORD_1, GMAIL_USER_2... 순으로 로드합니다.
 */
export function getTransporter() {
  const accounts: { user: string; pass: string }[] = [];
  let i = 1;
  
  // GMAIL_USER_1 부터 시작하여 번호가 매겨진 모든 계정 수집
  while (process.env[`GMAIL_USER_${i}`]) {
    accounts.push({
      user: process.env[`GMAIL_USER_${i}`]!,
      pass: process.env[`GMAIL_APP_PASSWORD_${i}`]!,
    });
    i++;
  }

  // 만약 번호가 매겨진 계정이 없으면 기존 GMAIL_USER 환경 변수 확인 (하위 호환성)
  if (accounts.length === 0 && process.env.GMAIL_USER) {
    accounts.push({
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD!,
    });
  }

  if (accounts.length === 0) {
    console.error("❌ 이메일 계정이 설정되지 않았습니다. (GMAIL_USER_1 등)");
    throw new Error("No Gmail accounts configured for mailing.");
  }

  // 가용 계정 중 하나를 랜덤하게 선택
  const randomIndex = Math.floor(Math.random() * accounts.length);
  const selected = accounts[randomIndex];

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: selected.user,
      pass: selected.pass,
    },
  });

  return { transporter, user: selected.user };
}

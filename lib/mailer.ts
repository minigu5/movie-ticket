type SendMailParams = {
  to: string;
  subject: string;
  html: string;
};

const DEFAULT_FROM = '영화대교 예매시스템 <onboarding@resend.dev>';
const MAX_ATTEMPTS = 4;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendMail({ to, subject, html }: SendMailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('❌ RESEND_API_KEY가 설정되지 않았습니다.');
    throw new Error('No Resend API key configured.');
  }

  const from = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (res.ok) return;

    // Resend 무료 플랜은 초당 2건으로 제한됨. 429는 재시도하면 대부분 해결됨.
    const isRateLimited = res.status === 429;
    const isLastAttempt = attempt === MAX_ATTEMPTS;
    if (!isRateLimited || isLastAttempt) {
      const errorText = await res.text();
      throw new Error(`Resend API error (${res.status}): ${errorText}`);
    }

    const retryAfterHeader = Number(res.headers.get('retry-after'));
    const waitMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
      ? retryAfterHeader * 1000
      : 300 * attempt;
    await sleep(waitMs);
  }
}

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침 - 영화대교 예매 시스템",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6 md:p-12">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="inline-block mb-8 text-sm font-semibold text-orange-400 hover:text-orange-300 transition-colors">
          ← 메인으로 돌아가기
        </Link>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8">
          <h1 className="text-2xl font-black mb-1">개인정보처리방침</h1>
          <p className="text-sm text-neutral-500 mb-8">시행일: 2026년 8월 20일 · 최종 개정일: 2026년 8월 28일</p>

          <section className="mb-8">
            <h2 className="text-base font-bold text-orange-400 border-b border-neutral-800 pb-2 mb-4">1. 수집하는 개인정보</h2>
            <p className="text-sm text-neutral-300 leading-relaxed">
              구글 로그인(학교 이메일 @ts.hs.kr 계정), 영화 예매, 보관 영화 후기 작성 과정에서 다음 정보를 수집합니다.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-neutral-400 list-disc list-inside">
              <li>구글 계정 이메일 및 이름 (로그인 및 본인 확인 목적)</li>
              <li>학번 및 성명 (구글 계정 이름에서 자동 추출, 예매자 확인 목적)</li>
              <li>선택 좌석 및 팝콘 옵션</li>
              <li>이메일 주소 (티켓 발송 목적, 구글 로그인 계정과 동일)</li>
              <li>후기 작성 시: 이름, 평점, 후기 내용 (동아리원 인증 후 작성, 작성 즉시 비로그인 방문자를 포함한 모든 이용자에게 공개됩니다)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-base font-bold text-orange-400 border-b border-neutral-800 pb-2 mb-4">2. 수집 목적 및 보유 기간</h2>
            <p className="text-sm text-neutral-300 leading-relaxed">
              계정 정보(이메일, 학번, 성명)는 로그인 및 예매 확인을 위해 보관되며,
              이용자가 삭제를 요청하기 전까지 유지됩니다.
              좌석 및 팝콘 옵션 등 예매 상세 정보는 영화 상영일 기준 예매 확인 및 좌석 배정
              목적으로만 사용됩니다.
              후기·평점 정보는 다른 이용자에게 관람 참고 정보를 제공할 목적으로 작성되며,
              작성자 본인이 삭제하거나 삭제를 요청하기 전까지 공개된 상태로 보관됩니다.
              보유 기간이 끝나거나 삭제가 요청된 개인정보의 파기 절차 및 방법은 별도로 정하여 시행합니다.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-base font-bold text-orange-400 border-b border-neutral-800 pb-2 mb-4">3. 제3자 제공 및 국외 이전</h2>
            <p className="text-sm text-neutral-300 leading-relaxed">
              수집된 정보는 외부에 판매하거나 목적 외로 제공하지 않습니다.
              다만 서비스 운영을 위해 아래와 같이 정보를 국외에 저장·처리하고 있습니다.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-neutral-400 list-disc list-inside">
              <li>이전받는 자: Supabase, Inc.</li>
              <li>이전되는 항목: 계정 정보(이메일·학번·성명), 예매 정보(좌석·팝콘 옵션), 후기·평점 정보</li>
              <li>이전 국가: 미국</li>
              <li>이전 일시 및 방법: 회원가입·예매·후기 작성 등 서비스 이용 시점마다 네트워크를 통해 즉시 전송</li>
              <li>이전받는 자의 보유·이용 기간: 본 방침 제2항의 보유 기간과 동일</li>
              <li>로그인 인증은 Google OAuth를 통해 처리되며, 인증 과정에서 Google에도 정보가 전달됩니다.</li>
            </ul>
            <p className="mt-3 text-sm text-neutral-300 leading-relaxed">
              서비스 특성상 위 국외 이전 없이는 로그인·예매·후기 기능 제공이 불가능하며,
              이전을 원하지 않으실 경우 서비스 이용(회원가입) 자체를 하지 않으실 수 있습니다.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-base font-bold text-orange-400 border-b border-neutral-800 pb-2 mb-4">4. 정보주체의 권리와 행사 방법</h2>
            <p className="text-sm text-neutral-300 leading-relaxed">
              이용자는 언제든지 본인의 개인정보에 대해 다음 권리를 행사할 수 있습니다.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-neutral-400 list-disc list-inside">
              <li>개인정보 열람 요구</li>
              <li>오류가 있는 경우 정정 요구</li>
              <li>삭제 요구 (단, 다른 법령에서 별도로 보존하도록 규정한 경우는 제외)</li>
              <li>처리 정지 요구</li>
              <li>개인정보 처리에 대한 동의 철회</li>
            </ul>
            <p className="mt-3 text-sm text-neutral-300 leading-relaxed">
              권리 행사는 아래 문의처로 이메일을 통해 요청하실 수 있으며, 요청인이 본인임을
              확인한 후 지체 없이 조치합니다. 후기·평점처럼 다른 이용자에게 공개된 정보의 삭제 요구도
              동일한 방법으로 접수합니다.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-base font-bold text-orange-400 border-b border-neutral-800 pb-2 mb-4">5. 개인정보의 안전성 확보 조치</h2>
            <ul className="mt-1 space-y-1.5 text-sm text-neutral-400 list-disc list-inside">
              <li>관리적 조치: 개인정보 접근 권한을 운영에 필요한 최소 인원(관리자 계정)으로 제한</li>
              <li>기술적 조치: Supabase 행 단위 보안(RLS)으로 인가되지 않은 접근 차단, 전 구간 HTTPS 통신 암호화</li>
              <li>비밀번호는 별도로 수집·저장하지 않으며, 로그인 인증은 Google OAuth에 위탁하여 처리</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-orange-400 border-b border-neutral-800 pb-2 mb-4">6. 개인정보 보호책임자</h2>
            <p className="text-sm text-neutral-300 leading-relaxed">
              개인정보 처리에 관한 문의, 불만 처리, 권리 행사 접수는 아래 개인정보 보호책임자에게
              연락 주십시오.
            </p>
            <p className="mt-2 text-sm text-neutral-400">
              <span className="font-semibold text-neutral-300 mr-1.5">성명</span>신민규
            </p>
            <p className="mt-1.5 text-sm text-neutral-400">
              <span className="font-semibold text-neutral-300 mr-1.5">직책</span>개발자 (개인정보 보호책임자 겸임)
            </p>
            <p className="mt-1.5 text-sm text-neutral-400">
              <span className="font-semibold text-neutral-300 mr-1.5">Email</span>
              <a href="mailto:seong381400@gmail.com" className="text-orange-400 hover:text-orange-300 transition-colors">
                seong381400@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

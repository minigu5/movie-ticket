import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침 - 영화대교 예매 시스템",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="inline-block mb-8 text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
          ← 메인으로 돌아가기
        </Link>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <h1 className="text-2xl font-black mb-1">개인정보처리방침</h1>
          <p className="text-sm text-slate-500 mb-8">시행일: 2026년 8월 20일</p>

          <section className="mb-8">
            <h2 className="text-base font-bold text-indigo-400 border-b border-slate-800 pb-2 mb-4">1. 수집하는 개인정보</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              구글 로그인(학교 이메일 @ts.hs.kr 계정) 및 영화 예매 과정에서 다음 정보를 수집합니다.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-400 list-disc list-inside">
              <li>구글 계정 이메일 및 이름 (로그인 및 본인 확인 목적)</li>
              <li>학번 및 성명 (구글 계정 이름에서 자동 추출, 예매자 확인 목적)</li>
              <li>선택 좌석 및 팝콘 옵션</li>
              <li>이메일 주소 (티켓 발송 목적, 구글 로그인 계정과 동일)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-base font-bold text-indigo-400 border-b border-slate-800 pb-2 mb-4">2. 수집 목적 및 보유 기간</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              계정 정보(이메일, 학번, 성명)는 로그인 및 예매 확인을 위해 보관되며,
              이용자가 삭제를 요청하기 전까지 유지됩니다.
              좌석 및 팝콘 옵션 등 예매 상세 정보는 영화 상영일 기준 예매 확인 및 좌석 배정
              목적으로만 사용됩니다.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-base font-bold text-indigo-400 border-b border-slate-800 pb-2 mb-4">3. 제3자 제공 및 처리 위탁</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              수집된 정보는 외부에 판매하지 않습니다.
              로그인 인증은 Google OAuth를 통해 처리되며, 데이터베이스 및 인증 정보는
              Supabase(미국)에 저장됩니다.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-indigo-400 border-b border-slate-800 pb-2 mb-4">4. 문의</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              개인정보 관련 문의는 아래로 연락 주십시오.
            </p>
            <p className="mt-2 text-sm text-slate-400">
              <span className="font-semibold text-slate-300 mr-1.5">개발자</span>신민규
            </p>
            <p className="mt-1.5 text-sm text-slate-400">
              <span className="font-semibold text-slate-300 mr-1.5">Email</span>
              <a href="mailto:seong381400@gmail.com" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                seong381400@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

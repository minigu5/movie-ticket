"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { CinemaIcon, MailIcon, PinIcon, PopcornIcon, PeopleIcon, LockIcon } from "@/components/icons";
import type { ReactNode } from "react";

function GuideRow({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="flex items-start gap-3 py-4 border-t border-[var(--color-border-subtle)] first:border-t-0">
      <div className="mt-0.5 w-9 h-9 rounded-[var(--radius-sm)] bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)] flex items-center justify-center text-[var(--color-accent-soft)] flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">{title}</h3>
        <div className="mt-1.5 text-[13px] text-[var(--color-text-secondary)] leading-relaxed">{children}</div>
      </div>
    </section>
  );
}

export function UsageGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="예매 가이드"
      description="영화대교 정기 상영회 예매 흐름을 안내합니다."
      size="lg"
      footer={<Button onClick={onClose} fullWidth>닫기</Button>}
    >
      <div>
        <GuideRow icon={<CinemaIcon className="w-5 h-5" />} title="좌석 선택 및 예매">
          배치도에서 빈 좌석을 선택한 뒤 <strong className="text-[var(--color-text-primary)]">예매하기</strong>를 누르고
          학번·이름·4자리 비밀번호를 입력하면 예약이 확정됩니다. 빈 좌석을 다시 선택해 예매를 진행하면
          기존 좌석은 자동으로 해제되고 새 좌석으로 변경됩니다.
        </GuideRow>
        <GuideRow icon={<LockIcon className="w-5 h-5" />} title="4자리 비밀번호">
          비밀번호는 한 번 설정하면 영구적으로 유지되며, 좌석 변경·티켓 출력·취소 시 모두 동일한 번호로 인증합니다.
          잊으셨다면 예매 화면 하단의 <strong className="text-[var(--color-accent-soft)]">비밀번호 찾기</strong>로
          학교 이메일을 통해 즉시 재설정할 수 있습니다.
        </GuideRow>
        <GuideRow icon={<MailIcon className="w-5 h-5" />} title="모바일 티켓">
          예매가 완료되면 학교 이메일로 모바일 티켓이 즉시 발송됩니다. 입장 시 화면을 보여주거나 현장 키오스크에서
          영수증으로 출력할 수 있습니다.
        </GuideRow>
        <GuideRow icon={<PopcornIcon className="w-5 h-5" />} title="팝콘 (현장 결제)">
          오리지널 버터·콘소메·카라멜 중 원하는 만큼 선택할 수 있습니다 (개당 2,500원).
          팝콘이 포함되면 좌석은 결제 대기로 표시되고, 입금 확인 후 운영진이 예매를 확정합니다.
        </GuideRow>
        <GuideRow icon={<PeopleIcon className="w-5 h-5" />} title="단체 예매 (최대 10명)">
          리더는 본인을 포함한 최대 10명까지 한 번에 예매를 시작할 수 있습니다. 멤버에게 즉시 초대 메일이 발송되며,
          1시간 이내에 응답하지 않으면 해당 좌석은 자동으로 해제됩니다.
        </GuideRow>
        <GuideRow icon={<PinIcon className="w-5 h-5" />} title="좌석 범례">
          동아리 전용석은 <strong className="text-[var(--color-accent-soft)]">영화대교 부원</strong>만 선택할 수 있습니다.
          예매 완료된 좌석은 비활성, 결제 대기 좌석은 노란색 펄스로 표시됩니다.
        </GuideRow>
      </div>
    </Modal>
  );
}

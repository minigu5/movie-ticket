"use client";

import type { ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  AlertIcon,
  CinemaIcon,
  ClockIcon,
  CrownIcon,
  LockIcon,
  MailIcon,
  PeopleIcon,
  PopcornIcon,
  SparkleIcon,
  TicketIcon,
} from "@/components/icons";

type Tone = "amber" | "emerald" | "sky" | "violet" | "rose";

const toneStyle: Record<Tone, { ring: string; iconBg: string; iconText: string; chip: string }> = {
  amber: {
    ring: "border-[var(--color-accent)]/35",
    iconBg: "bg-[var(--color-accent)]/12",
    iconText: "text-[var(--color-accent-soft)]",
    chip: "text-[var(--color-accent-soft)]",
  },
  emerald: {
    ring: "border-[var(--color-success)]/35",
    iconBg: "bg-[var(--color-success)]/12",
    iconText: "text-[var(--color-success-soft)]",
    chip: "text-[var(--color-success-soft)]",
  },
  sky: {
    ring: "border-[var(--color-info)]/35",
    iconBg: "bg-[var(--color-info)]/12",
    iconText: "text-[var(--color-info-soft)]",
    chip: "text-[var(--color-info-soft)]",
  },
  violet: {
    ring: "border-[var(--color-vip)]/40",
    iconBg: "bg-[var(--color-vip)]/15",
    iconText: "text-[var(--color-vip-soft)]",
    chip: "text-[var(--color-vip-soft)]",
  },
  rose: {
    ring: "border-[var(--color-danger)]/35",
    iconBg: "bg-[var(--color-danger)]/12",
    iconText: "text-[var(--color-danger-soft)]",
    chip: "text-[var(--color-danger-soft)]",
  },
};

function SectionHeader({ label, tone }: { label: string; tone: Tone }) {
  const t = toneStyle[tone];
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className={`h-px flex-1 bg-gradient-to-r from-transparent to-current opacity-40 ${t.chip}`} />
      <span className={`text-[10px] tracking-[0.3em] uppercase font-semibold ${t.chip}`}>{label}</span>
      <div className={`h-px flex-1 bg-gradient-to-l from-transparent to-current opacity-40 ${t.chip}`} />
    </div>
  );
}

function StepCard({
  step,
  icon,
  title,
  tone,
  children,
}: {
  step?: number;
  icon: ReactNode;
  title: string;
  tone: Tone;
  children: ReactNode;
}) {
  const t = toneStyle[tone];
  return (
    <div className={`relative rounded-[var(--radius)] border ${t.ring} bg-[var(--color-bg-base)] p-4`}>
      <div className="flex items-center gap-3 mb-2.5">
        <div className={`relative w-10 h-10 rounded-[var(--radius-sm)] flex items-center justify-center ${t.iconBg} ${t.iconText} flex-shrink-0`}>
          {icon}
          {step !== undefined && (
            <span className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-[var(--color-bg-elevated)] border ${t.ring} flex items-center justify-center text-[10px] font-mono font-bold ${t.chip}`}>
              {step}
            </span>
          )}
        </div>
        <h3 className="text-[14.5px] font-semibold tracking-tight text-[var(--color-text-primary)]">{title}</h3>
      </div>
      <div className="text-[13px] text-[var(--color-text-secondary)] leading-[1.7]">{children}</div>
    </div>
  );
}

function Highlight({ children, tone = "amber" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`font-semibold ${toneStyle[tone].chip}`}>{children}</span>;
}

function Note({ tone, icon, children }: { tone: Tone; icon: ReactNode; children: ReactNode }) {
  const t = toneStyle[tone];
  return (
    <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-[var(--radius-sm)] border ${t.ring} bg-[var(--color-bg-elevated)]/50 text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]`}>
      <span className={`flex-shrink-0 mt-0.5 ${t.chip}`}>{icon}</span>
      <span>{children}</span>
    </div>
  );
}

export function UsageGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <CinemaIcon className="w-5 h-5 text-[var(--color-accent-soft)]" />
          예매 가이드
        </span>
      }
      description="처음 이용하는 분도 5분 안에 따라할 수 있도록 정리했습니다."
      size="lg"
      footer={
        <Button onClick={onClose} fullWidth>
          가이드 닫기
        </Button>
      }
    >
      <div className="space-y-6">
        {/* SECTION A — 기본 예매 흐름 */}
        <section>
          <SectionHeader label="기본 예매 흐름" tone="amber" />
          <div className="space-y-3">
            <StepCard step={1} tone="amber" icon={<TicketIcon className="w-5 h-5" />} title="좌석 선택">
              배치도에서 빈 좌석을 누르면 <Highlight>선택 좌석</Highlight>으로 표시됩니다. 다른 좌석을 누르면 선택이 옮겨갑니다.
            </StepCard>
            <StepCard step={2} tone="amber" icon={<LockIcon className="w-5 h-5" />} title="본인 인증">
              <div className="space-y-2">
                <p>학번, 이름, 4자리 비밀번호를 입력합니다. <Highlight>비밀번호는 영구적으로 유지</Highlight>됩니다 — 좌석 변경·티켓 출력·취소 시 동일하게 사용합니다.</p>
                <Note tone="amber" icon={<AlertIcon className="w-3.5 h-3.5" />}>
                  교직원은 학번 칸에 <Badge tone="muted" className="!text-[10px] !py-0">교직원</Badge>이라 적고 본명을 입력합니다.
                </Note>
              </div>
            </StepCard>
            <StepCard step={3} tone="amber" icon={<MailIcon className="w-5 h-5" />} title="모바일 티켓 수신">
              예매 확정 즉시 <Highlight>학교 이메일(@ts.hs.kr)</Highlight>로 모바일 티켓이 발송됩니다. 입장 시 메일 화면을 보여주거나 현장 키오스크에서 영수증으로 출력하세요.
            </StepCard>
          </div>
        </section>

        {/* SECTION B — 결제·팝콘 */}
        <section>
          <SectionHeader label="팝콘 · 현장 결제" tone="emerald" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <StepCard tone="emerald" icon={<PopcornIcon className="w-5 h-5" />} title="팝콘 옵션">
              <ul className="space-y-1">
                <li>· 오리지널 버터</li>
                <li>· 콘소메</li>
                <li>· 카라멜</li>
              </ul>
              <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">개당 <Highlight tone="emerald">2,500원</Highlight> · 음료 미배부</p>
            </StepCard>
            <StepCard tone="emerald" icon={<ClockIcon className="w-5 h-5" />} title="결제 흐름">
              팝콘이 포함되면 좌석은 <Highlight tone="amber">결제 대기(노란색)</Highlight>로 표시됩니다. 송금 QR로 입금 후 운영진이 확인하면 자동으로 <Highlight tone="emerald">예매 확정</Highlight>으로 전환됩니다.
            </StepCard>
          </div>
          <Note tone="rose" icon={<AlertIcon className="w-4 h-4" />}>
            <span className="block mt-0.5">결제 혼선 방지를 위해 한 번 추가한 <strong>팝콘 수량은 줄일 수 없습니다</strong>. (맛 변경·추가는 가능)</span>
          </Note>
        </section>

        {/* SECTION C — 단체 예매 */}
        <section>
          <SectionHeader label="단체 예매" tone="sky" />
          <StepCard tone="sky" icon={<PeopleIcon className="w-5 h-5" />} title="리더가 시작 → 멤버는 메일로 확정">
            <ol className="space-y-1.5 list-decimal list-inside marker:text-[var(--color-info-soft)] marker:font-mono marker:text-[12px]">
              <li>리더가 본인 좌석 + 멤버 좌석을 한 번에 지정합니다 (최대 10명).</li>
              <li>리더는 <Highlight tone="emerald">즉시 확정</Highlight>되고, 멤버에겐 초대 메일이 발송됩니다.</li>
              <li>멤버는 <Highlight tone="amber">1시간 이내</Highlight>에 메일 링크를 통해 비밀번호로 확정해야 합니다.</li>
              <li>미응답 시 해당 좌석은 자동 해제됩니다.</li>
            </ol>
          </StepCard>
        </section>

        {/* SECTION D — 좌석 범례 */}
        <section>
          <SectionHeader label="좌석 색상" tone="violet" />
          <div className="grid grid-cols-2 gap-2.5">
            <LegendItem
              swatch="bg-[var(--color-seat)] border-[var(--color-seat-border)]"
              label="예매 가능"
              hint="누구나 선택"
            />
            <LegendItem
              swatch="bg-[var(--color-vip)]/15 border-[var(--color-vip)]/40"
              label="동아리 전용"
              hint="영화대교 부원만"
              icon={<CrownIcon className="w-3 h-3 text-[var(--color-vip-soft)]" />}
            />
            <LegendItem
              swatch="bg-[var(--color-bg-base)] border-[var(--color-border-subtle)]"
              label="예매 완료"
              hint="선택 불가"
            />
            <LegendItem
              swatch="bg-[var(--color-warning)]/15 border-[var(--color-warning)]"
              label="결제 대기"
              hint="송금 대기 중"
              pulse
            />
            <LegendItem
              swatch="bg-[var(--color-accent)] border-[var(--color-accent)]"
              label="선택한 좌석"
              hint="예매 직전"
            />
            <LegendItem
              swatch="bg-[var(--color-success)] border-[var(--color-success)]"
              label="단체 리더 / 멤버"
              hint="단체 모드 한정"
            />
          </div>
        </section>

        {/* SECTION E — 트러블슈팅 */}
        <section>
          <SectionHeader label="문제 해결" tone="rose" />
          <div className="space-y-2.5">
            <Note tone="rose" icon={<LockIcon className="w-4 h-4" />}>
              <strong className="text-[var(--color-text-primary)]">비밀번호를 잊었다면</strong> — 예매 폼 하단의{" "}
              <Highlight tone="amber">비밀번호 찾기</Highlight>를 누르세요. 학교 이메일로 30분 유효한 재설정 링크가 즉시 발송됩니다.
            </Note>
            <Note tone="rose" icon={<TicketIcon className="w-4 h-4" />}>
              <strong className="text-[var(--color-text-primary)]">좌석을 바꾸고 싶다면</strong> — 비어 있는 다른 좌석을 선택해 다시 예매하면 기존 좌석은 자동 해제됩니다.
            </Note>
            <Note tone="rose" icon={<SparkleIcon className="w-4 h-4" />}>
              <strong className="text-[var(--color-text-primary)]">예매를 취소하려면</strong> — 본인 좌석을 클릭 후 <Highlight tone="rose">예매 취소하기</Highlight>를 누르세요. 단, 결제가 완료된 팝콘이 있다면 환불은 상영 당일 현장에서 수령합니다.
            </Note>
          </div>
        </section>
      </div>
    </Modal>
  );
}

function LegendItem({
  swatch,
  label,
  hint,
  pulse,
  icon,
}: {
  swatch: string;
  label: string;
  hint: string;
  pulse?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]/60">
      <div
        className={[
          "w-5 h-6 rounded-t-[6px] rounded-b-[2px] border flex-shrink-0 flex items-center justify-center",
          swatch,
          pulse ? "animate-[pulse-slow_2.4s_ease-in-out_infinite]" : "",
        ].join(" ")}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-medium text-[var(--color-text-primary)]">{label}</div>
        <div className="text-[11px] text-[var(--color-text-muted)] leading-tight">{hint}</div>
      </div>
    </div>
  );
}

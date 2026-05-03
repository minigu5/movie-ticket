"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PaymentQR } from "./PaymentQR";
import { popcornTotal } from "@/lib/format";
import type { SeatSummary } from "@/lib/db-types";

interface Props {
  open: boolean;
  onClose: () => void;
  seatId: string;
  data: SeatSummary;
  onCancel: () => void;
  onShowGuide: () => void;
}

export function SeatInfoModal({ open, onClose, seatId, data, onCancel, onShowGuide }: Props) {
  const isPending = data.status === "pending";
  const total = popcornTotal(data.popcorn);
  const hasPaidPopcorn = data.status === "confirmed" && total > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={
        <span>
          좌석 정보 <span className="text-[var(--color-accent-soft)] font-mono">{seatId}</span>
        </span>
      }
    >
      {isPending ? (
        <div className="text-center">
          <PaymentQR amount={total} depositorLabel={data.name} />
          <p className="mt-4 text-[12px] text-[var(--color-text-muted)] leading-relaxed">
            입금을 확인하면 운영진이 예매를 최종 확정합니다.
          </p>
        </div>
      ) : (
        <div className="text-center">
          <Badge tone="emerald">예매 확정</Badge>
          <p className="mt-3 text-[14px] text-[var(--color-text-secondary)]">
            <span className="text-[var(--color-text-primary)] font-semibold">{data.name}</span> 님의 좌석입니다.
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2">
        {hasPaidPopcorn ? (
          <Button variant="outline" disabled fullWidth>
            결제 완료된 팝콘 — 취소 불가 (자리 변경만 가능)
          </Button>
        ) : (
          <Button
            variant="danger"
            fullWidth
            onClick={() => {
              onClose();
              onCancel();
            }}
          >
            예매 취소하기
          </Button>
        )}
        <Button
          variant="outline"
          fullWidth
          onClick={() => {
            onClose();
            onShowGuide();
          }}
        >
          자리 변경 방법 보기
        </Button>
        <Button variant="ghost" fullWidth onClick={onClose}>
          닫기
        </Button>
      </div>
    </Modal>
  );
}

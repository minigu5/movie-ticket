"use client";

import Image from "next/image";
import { formatKRW } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";

export function PaymentQR({
  amount,
  depositorLabel,
}: {
  amount: number;
  depositorLabel: string;
}) {
  return (
    <div className="text-center">
      <Badge tone="amber">결제 대기</Badge>
      <p className="mt-3 text-[13px] text-[var(--color-text-secondary)]">
        QR로 30분 내 입금을 완료해주세요.
      </p>
      <div className="mt-4 inline-block bg-white p-3 rounded-[var(--radius)]">
        <Image
          src="/qr.jpeg"
          alt="송금 QR"
          width={192}
          height={192}
          unoptimized
          className="w-44 h-44 md:w-48 md:h-48 object-contain"
        />
      </div>
      <div className="mt-5 rounded-[var(--radius)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-4 py-3 text-left">
        <div className="flex justify-between items-center text-[13px]">
          <span className="text-[var(--color-text-muted)]">결제 금액</span>
          <span className="font-mono text-[var(--color-accent-soft)] font-bold">{formatKRW(amount)}</span>
        </div>
        <div className="flex justify-between items-center text-[13px] mt-1.5">
          <span className="text-[var(--color-text-muted)]">입금자명</span>
          <span className="text-[var(--color-text-primary)] font-medium">{depositorLabel}</span>
        </div>
      </div>
    </div>
  );
}

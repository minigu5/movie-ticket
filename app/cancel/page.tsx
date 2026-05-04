"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { USER_EMAILS } from "@/lib/emails";
import type { MovieSettings, Reservation } from "@/lib/db-types";
import { popcornTotal } from "@/lib/format";
import { useToast } from "@/hooks/useToast";

import { Wordmark } from "@/components/domain/Wordmark";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { AlertIcon, HomeIcon } from "@/components/icons";

export default function CancelPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <Spinner size={24} />
        </main>
      }
    >
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const ticketId = params.get("ticketId");

  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<Reservation | null>(null);
  const [password, setPassword] = useState("");
  const [showResetButton, setShowResetButton] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (!ticketId) {
      setLoading(false);
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from("reservations")
        .select("*")
        .eq("id", ticketId)
        .single<Reservation>();
      setTicket(data ?? null);
      setLoading(false);
    })();
  }, [ticketId]);

  async function requestReset() {
    if (!ticket) return;
    setIsResetting(true);
    try {
      const res = await fetch("/api/auth/request-reset", {
        method: "POST",
        body: JSON.stringify({
          studentId: ticket.student_id,
          studentName: ticket.student_name,
          baseUrl: window.location.origin,
          returnUrl: window.location.pathname + window.location.search,
        }),
      });
      if (res.ok) {
        toast.notify("학교 이메일로 비밀번호 재설정 링크가 발송되었습니다.", "success");
        setShowResetButton(false);
      } else {
        toast.error("발송에 실패했습니다.");
      }
    } finally {
      setIsResetting(false);
    }
  }

  async function performCancel() {
    if (!ticket) return;
    if (!/^[0-9]{4}$/.test(password)) {
      toast.error("비밀번호는 4자리 숫자만 입력해주세요.");
      return;
    }
    const ok = await toast.confirm("정말 예매를 취소하시겠습니까?", { tone: "danger" });
    if (!ok) return;

    const { data: result, error } = await supabase.rpc("cancel_reservation_secure", {
      p_reservation_id: ticket.id,
      p_password: password,
    });
    if (error || !result) {
      setShowResetButton(true);
      toast.error("비밀번호가 일치하지 않거나 취소 중 오류가 발생했습니다.");
      return;
    }

    await supabase.from("activity_logs").insert([
      { student_id: ticket.student_id, student_name: ticket.student_name, description: `본인 예매 취소 (${ticket.seat_number})` },
    ]);

    const { data: movie } = await supabase
      .from("movie_settings")
      .select("title, date_string")
      .eq("id", 1)
      .single<Pick<MovieSettings, "title" | "date_string">>();

    const userEmail = ticket.student_id === "교직원" ? USER_EMAILS[ticket.student_name] : USER_EMAILS[ticket.student_id];
    const isRefundNeeded = ticket.popcorn_order !== "none" && ticket.payment_status === "confirmed";
    if (userEmail) {
      void fetch("/api/ticket", {
        method: "POST",
        body: JSON.stringify({
          email: userEmail,
          name: ticket.student_name,
          seat: ticket.seat_number,
          movieTitle: movie?.title ?? "",
          movieDate: movie?.date_string ?? "",
          statusType: "canceled",
          popcorn: ticket.popcorn_order,
          ticketId: ticket.id,
          baseUrl: window.location.origin,
          isRefundNeeded,
        }),
      });
    }

    await toast.success("예매 취소 완료", "예매가 정상적으로 취소되었습니다.");
    router.push("/");
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Spinner size={24} />
      </main>
    );
  }
  if (!ticket) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <Card padding="lg" className="max-w-sm text-center">
          <p className="text-[14px] text-[var(--color-text-secondary)]">존재하지 않거나 이미 취소된 예매입니다.</p>
          <Button className="mt-5" onClick={() => router.push("/")} fullWidth leading={<HomeIcon className="w-4 h-4" />}>
            메인으로
          </Button>
        </Card>
      </main>
    );
  }

  const hasPaidPopcorn = popcornTotal(ticket.popcorn_order) > 0 && ticket.payment_status === "confirmed";

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      <Wordmark size="sm" />
      <div className="w-full max-w-sm mt-8 space-y-4">
        <Card padding="lg">
          <Badge tone="rose">예매 취소</Badge>
          <h1 className="mt-3 text-[20px] font-semibold tracking-tight">예매를 취소하시겠어요?</h1>

          <div className="mt-4 px-3 py-3 rounded-[var(--radius)] bg-[var(--color-bg-base)] border border-[var(--color-border-subtle)]">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[var(--color-text-muted)]">좌석</span>
              <span className="font-mono font-bold text-[var(--color-accent-soft)]">{ticket.seat_number}</span>
            </div>
            <div className="flex items-center justify-between text-[13px] mt-1.5">
              <span className="text-[var(--color-text-muted)]">예매자</span>
              <span>{ticket.student_name} <span className="text-[var(--color-text-muted)] font-mono">({ticket.student_id})</span></span>
            </div>
          </div>

          {hasPaidPopcorn && (
            <div className="mt-4 px-3 py-3 rounded-[var(--radius)] border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/8 text-[12.5px] text-[var(--color-warning)] flex gap-2">
              <AlertIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                팝콘 결제가 완료된 예매입니다. 취소해도 환불은 <strong>상영 당일 현장에서</strong> 직접 수령해야 합니다.
              </span>
            </div>
          )}

          <div className="mt-4">
            <Input
              label="예매 비밀번호 (숫자 4자리)"
              type="password"
              maxLength={4}
              align="center"
              value={password}
              onChange={(e) => setPassword(e.target.value.replace(/[^0-9]/g, ""))}
            />
            {showResetButton && (
              <button
                type="button"
                onClick={requestReset}
                disabled={isResetting}
                className="mt-3 text-[13px] text-[var(--color-accent-soft)] hover:text-[var(--color-accent)] underline underline-offset-4 font-medium block"
              >
                {isResetting ? "메일 발송 중..." : "비밀번호를 잊으셨나요? 이메일로 재설정"}
              </button>
            )}
          </div>

          <Button className="mt-5" fullWidth variant="danger" onClick={performCancel}>
            예매 취소하기
          </Button>
        </Card>

        <Button variant="ghost" fullWidth onClick={() => router.push("/")} leading={<HomeIcon className="w-4 h-4" />}>
          메인 페이지로
        </Button>
      </div>
    </main>
  );
}

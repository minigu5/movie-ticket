"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { USER_EMAILS } from "@/lib/emails";
import type { MovieSettings, Reservation, VerifyPasswordResult } from "@/lib/db-types";
import { POPCORN_PRICE } from "@/lib/db-types";
import { validatePin } from "@/lib/validation";
import { useToast } from "@/hooks/useToast";

import { Wordmark } from "@/components/domain/Wordmark";
import { PopcornSelector } from "@/components/domain/PopcornSelector";
import { PaymentQR } from "@/components/domain/PaymentQR";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { CheckIcon, ClockIcon, CrownIcon, HomeIcon } from "@/components/icons";

export default function GroupConfirmPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <Inner />
    </Suspense>
  );
}

function LoadingShell() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <Spinner size={24} />
    </main>
  );
}

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const groupId = params.get("groupId");
  const memberId = params.get("memberId");

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Reservation | null>(null);
  const [members, setMembers] = useState<Reservation[]>([]);
  const [leader, setLeader] = useState<Reservation | null>(null);
  const [movie, setMovie] = useState<MovieSettings | null>(null);
  const [password, setPassword] = useState("");
  const [showResetButton, setShowResetButton] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [step, setStep] = useState<"auth" | "popcorn" | "payment">("auth");
  const [popcornList, setPopcornList] = useState<string[]>(["none"]);

  const isExpired = useMemo(
    () => !!me?.group_expires_at && new Date(me.group_expires_at) < new Date(),
    [me]
  );
  const isAlreadyConfirmed = me?.payment_status === "confirmed" || me?.payment_status === "pending";

  const popcornCount = popcornList.filter((p) => p !== "none").length;
  const popcornAmount = popcornCount * POPCORN_PRICE;

  useEffect(() => {
    if (!groupId || !memberId) {
      setLoading(false);
      return;
    }
    void (async () => {
      const { data: my } = await supabase
        .from("reservations")
        .select("*")
        .eq("id", memberId)
        .single<Reservation>();
      setMe(my ?? null);
      const { data: all } = await supabase
        .from("reservations")
        .select("*")
        .eq("group_id", groupId)
        .order("is_group_leader", { ascending: false });
      const arr = (all ?? []) as Reservation[];
      setLeader(arr.find((r) => r.is_group_leader) ?? null);
      setMembers(arr.filter((r) => !r.is_group_leader));
      const { data: m } = await supabase.from("movie_settings").select("*").eq("id", 1).single<MovieSettings>();
      setMovie(m ?? null);
      setLoading(false);
    })();
  }, [groupId, memberId]);

  async function requestReset() {
    if (!me) return;
    setIsResetting(true);
    try {
      const res = await fetch("/api/auth/request-reset", {
        method: "POST",
        body: JSON.stringify({
          studentId: me.student_id,
          studentName: me.student_name,
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

  async function authenticate() {
    if (!me) return;
    if (!validatePin(password)) {
      toast.error("비밀번호는 4자리 숫자만 입력해주세요.");
      return;
    }
    const authKey = me.student_id === "교직원" ? me.student_name : me.student_id;
    const { data, error } = await supabase.rpc("verify_student_password", {
      p_student_id: authKey,
      p_password: password,
    });
    if (error) {
      toast.error("네트워크 오류가 발생했습니다.");
      return;
    }
    const result = data as VerifyPasswordResult;
    if (!result.exists) {
      await supabase.from("student_auth").insert({ student_id: authKey, password });
      setShowResetButton(false);
    } else if (!result.success) {
      setShowResetButton(true);
      toast.error("비밀번호가 일치하지 않습니다.");
      return;
    } else {
      setShowResetButton(false);
    }
    setStep("popcorn");
  }

  async function finalize(includePopcorn: boolean) {
    if (!me || !movie) return;
    const popcornStr = includePopcorn ? popcornList.filter((p) => p !== "none").join(",") || "none" : "none";
    const showQR = popcornStr !== "none";

    const { data: ok, error } = await supabase.rpc("confirm_group_reservation", {
      p_reservation_id: me.id,
      p_password: password,
    });
    if (error || !ok) {
      toast.error("확정 중 오류가 발생했습니다.");
      return;
    }

    if (showQR) {
      await fetch("/api/kiosk", {
        method: "POST",
        body: JSON.stringify({
          action: "UPDATE_GROUP_POPCORN",
          payload: { reservationId: me.id, popcornOrder: popcornStr, paymentStatus: "pending" },
        }),
      });
    }

    await supabase.from("activity_logs").insert([
      {
        student_id: me.student_id,
        student_name: me.student_name,
        description: showQR
          ? `단체 예매 확정 + 팝콘 결제 대기 (${me.seat_number})`
          : `단체 예매 확정 (${me.seat_number})`,
      },
    ]);

    const userEmail = me.student_id === "교직원" ? USER_EMAILS[me.student_name] : USER_EMAILS[me.student_id];
    if (userEmail) {
      void fetch("/api/ticket", {
        method: "POST",
        body: JSON.stringify({
          email: userEmail,
          name: me.student_name,
          seat: me.seat_number,
          movieTitle: movie.title,
          movieDate: movie.date_string,
          statusType: showQR ? "pending" : "confirmed",
          popcorn: popcornStr,
          ticketId: me.id,
          baseUrl: window.location.origin,
        }),
      });
    }

    if (showQR) {
      setStep("payment");
    } else {
      await toast.success("예매 확정 완료", "단체 관람 예매가 확정되었습니다.\n학교 이메일을 확인해주세요.");
      router.push("/");
    }
  }

  async function leave() {
    if (!me) return;
    const ok = await toast.confirm("정말 단체 예매에서 나가시겠습니까?\n좌석이 즉시 해제됩니다.", { tone: "danger" });
    if (!ok) return;
    await supabase.from("reservations").delete().eq("id", me.id);
    await supabase.from("activity_logs").insert([
      { student_id: me.student_id, student_name: me.student_name, description: `단체 예매 거절 (${me.seat_number})` },
    ]);
    toast.notify("단체 예매에서 나갔습니다.", "info");
    router.push("/");
  }

  if (loading) return <LoadingShell />;
  if (!me) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <Card padding="lg" className="max-w-sm text-center">
          <p className="text-[14px] text-[var(--color-text-secondary)]">존재하지 않거나 이미 처리된 초대입니다.</p>
          <Button className="mt-5" onClick={() => router.push("/")} fullWidth leading={<HomeIcon className="w-4 h-4" />}>
            메인으로
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      <Wordmark size="sm" subtitle="group invitation" />

      <div className="w-full max-w-md mt-8 space-y-4">
        {/* status banner */}
        {isExpired ? (
          <Card tone="danger" padding="md" className="text-center">
            <Badge tone="rose">시간 초과</Badge>
            <p className="mt-3 text-[14px] text-[var(--color-text-secondary)]">초대 시간이 만료되어 더 이상 확정할 수 없습니다.</p>
          </Card>
        ) : isAlreadyConfirmed ? (
          <Card tone="success" padding="md" className="text-center">
            <Badge tone="emerald">확정 완료</Badge>
            <p className="mt-3 text-[14px] text-[var(--color-text-secondary)]">이미 예매가 확정된 상태입니다.</p>
          </Card>
        ) : null}

        {/* group status */}
        <Card padding="md">
          <div className="text-[11px] tracking-[0.25em] uppercase text-[var(--color-text-muted)] mb-3">단체 현황</div>
          {leader && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-[var(--radius)] bg-[var(--color-success)]/8 border border-[var(--color-success)]/30 mb-2">
              <CrownIcon className="w-4 h-4 text-[var(--color-success-soft)]" />
              <div className="flex-1">
                <div className="text-[13px] font-semibold">{leader.student_name} <span className="text-[10px] text-[var(--color-success-soft)] ml-1">리더</span></div>
                <div className="text-[11px] text-[var(--color-text-muted)] font-mono">{leader.seat_number}</div>
              </div>
              <Badge tone="emerald" leading={<CheckIcon className="w-3 h-3" />}>확정</Badge>
            </div>
          )}
          {members.map((m) => {
            const isMe = m.id === memberId;
            const confirmed = m.payment_status === "confirmed" || m.payment_status === "pending";
            return (
              <div
                key={m.id}
                className={[
                  "flex items-center gap-3 px-3 py-2 rounded-[var(--radius)] border mb-2 last:mb-0",
                  isMe
                    ? "bg-[var(--color-info)]/10 border-[var(--color-info)]/30"
                    : "bg-[var(--color-bg-base)] border-[var(--color-border-subtle)]",
                ].join(" ")}
              >
                <div className="flex-1">
                  <div className="text-[13px] font-medium">
                    {m.student_name}
                    {isMe && <span className="ml-1.5 text-[10px] text-[var(--color-info-soft)]">(나)</span>}
                  </div>
                  <div className="text-[11px] text-[var(--color-text-muted)] font-mono">{m.seat_number}</div>
                </div>
                {confirmed ? (
                  <Badge tone="emerald" leading={<CheckIcon className="w-3 h-3" />}>확정</Badge>
                ) : (
                  <Badge tone="yellow" leading={<ClockIcon className="w-3 h-3" />}>대기</Badge>
                )}
              </div>
            );
          })}
        </Card>

        {/* steps */}
        {!isExpired && !isAlreadyConfirmed && step === "auth" && (
          <Card padding="md">
            <div className="text-[11px] tracking-[0.25em] uppercase text-[var(--color-text-muted)] mb-3">내 예매 정보</div>
            <div className="grid grid-cols-3 gap-3 text-center mb-4">
              <Field label="학번" value={me.student_id} />
              <Field label="이름" value={me.student_name} />
              <Field label="좌석" value={me.seat_number} highlight />
            </div>
            <Input
              label="비밀번호 (숫자 4자리)"
              type="password"
              maxLength={4}
              align="center"
              value={password}
              onChange={(e) => setPassword(e.target.value.replace(/[^0-9]/g, ""))}
              helper="처음 사용하시면 새 비밀번호가 설정됩니다."
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
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={leave}>단체에서 나가기</Button>
              <Button variant="success" onClick={authenticate}>다음</Button>
            </div>
          </Card>
        )}

        {step === "popcorn" && (
          <Card padding="md">
            <div className="text-[11px] tracking-[0.25em] uppercase text-[var(--color-text-muted)] mb-1">팝콘 선택</div>
            <p className="text-[13px] text-[var(--color-text-secondary)] mb-3">
              <span className="text-[var(--color-text-primary)] font-semibold">{me.student_name}</span> · {me.seat_number}
            </p>
            <PopcornSelector list={popcornList} onChange={setPopcornList} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => void finalize(false)}>팝콘 없이 확정</Button>
              <Button variant="success" onClick={() => void finalize(true)}>
                {popcornCount > 0 ? `팝콘 포함 확정 (${popcornAmount.toLocaleString("ko-KR")}원)` : "팝콘 없이 확정"}
              </Button>
            </div>
          </Card>
        )}

        {step === "payment" && (
          <Card padding="md">
            <PaymentQR amount={popcornAmount} depositorLabel={`${me.student_id} ${me.student_name}`} />
            <Button className="mt-4" fullWidth onClick={() => router.push("/")} leading={<HomeIcon className="w-4 h-4" />}>
              메인으로
            </Button>
          </Card>
        )}

        <Button variant="ghost" fullWidth onClick={() => router.push("/")} leading={<HomeIcon className="w-4 h-4" />}>
          메인 페이지로
        </Button>
      </div>
    </main>
  );
}

function Field({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-2 py-2">
      <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--color-text-muted)]">{label}</div>
      <div className={`mt-1 text-[15px] font-bold font-mono ${highlight ? "text-[var(--color-accent-soft)]" : "text-[var(--color-text-primary)]"}`}>
        {value}
      </div>
    </div>
  );
}

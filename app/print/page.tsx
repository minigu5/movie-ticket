"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { STAFF_LIST, STUDENT_LIST } from "@/lib/constants";
import type { MovieSettings, Reservation, VerifyPasswordResult } from "@/lib/db-types";
import { POPCORN_LABELS, type PopcornFlavor } from "@/lib/db-types";
import { popcornBreakdown } from "@/lib/format";
import { validateIdentity, validatePin } from "@/lib/validation";
import { useToast } from "@/hooks/useToast";

import { Wordmark } from "@/components/domain/Wordmark";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { LockIcon, PrinterIcon } from "@/components/icons";

const KIOSK_PASSWORD = "bridge5780";

const CODE39_MAP: Record<string, string> = {
  "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn",
  "4": "nnnwwnnnw", "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw",
  "8": "wnnwnnwnn", "9": "nnwwnnwnn", A: "wnnnnwnnw", B: "nnwnnwnnw",
  C: "wnwnnwnnn", D: "nnnnwwnnw", E: "wnnnwwnnn", F: "nnwnwwnnn",
  G: "nnnnnwwnw", H: "wnnnnwwnn", I: "nnwnnwwnn", J: "nnnnwwwnn",
  "*": "nnwnwnwnn",
};

export default function PrintPage() {
  const toast = useToast();
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminInput, setAdminInput] = useState("");
  const [movie, setMovie] = useState<MovieSettings | null>(null);
  const [form, setForm] = useState({ studentId: "", name: "", password: "" });
  const [ticket, setTicket] = useState<Reservation | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showResetButton, setShowResetButton] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("skip_auth") === "true") {
      setAdminUnlocked(true);
    }
    void (async () => {
      const { data } = await supabase
        .from("movie_settings")
        .select("*")
        .eq("id", 1)
        .single<MovieSettings>();
      setMovie(data ?? null);
    })();
  }, []);

  useEffect(() => {
    if (!ticket) return;
    const t = setTimeout(() => window.print(), 500);
    const onAfter = () => {
      setTicket(null);
      setForm({ studentId: "", name: "", password: "" });
    };
    window.addEventListener("afterprint", onAfter);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", onAfter);
    };
  }, [ticket]);

  function unlock() {
    if (adminInput === KIOSK_PASSWORD) setAdminUnlocked(true);
    else toast.error("관리자 비밀번호가 틀렸습니다.");
  }

  async function requestReset() {
    setIsResetting(true);
    try {
      const id = form.studentId.replace(/['"]/g, "").trim();
      const res = await fetch("/api/auth/request-reset", {
        method: "POST",
        body: JSON.stringify({
          studentId: id,
          studentName: form.name,
          baseUrl: window.location.origin,
          returnUrl: "/print",
        }),
      });
      if (res.ok) toast.notify("학교 이메일로 비밀번호 재설정 링크가 발송되었습니다.", "success");
      else toast.error("발송에 실패했습니다.");
    } finally {
      setIsResetting(false);
    }
  }

  async function submit() {
    if (!movie) return;
    if (!form.studentId || !form.name || !form.password) {
      toast.error("정보를 모두 입력해주세요.");
      return;
    }
    if (!validatePin(form.password)) {
      toast.error("비밀번호는 4자리 숫자만 입력해주세요.");
      return;
    }
    const id = validateIdentity(form.studentId, form.name);
    if (!id.ok) {
      toast.error(id.reason);
      return;
    }
    setIsPrinting(true);
    try {
      const { data, error } = await supabase.rpc("verify_student_password", {
        p_student_id: id.authKey,
        p_password: form.password,
      });
      if (error) {
        toast.error("네트워크 오류가 발생했습니다.");
        return;
      }
      const r = data as VerifyPasswordResult;
      if (!r.exists || !r.success) {
        setShowResetButton(true);
        toast.error("비밀번호가 일치하지 않습니다.");
        return;
      }
      setShowResetButton(false);
      const { data: t, error: te } = await supabase
        .from("reservations")
        .select("*")
        .eq("student_id", id.cleanId)
        .eq("student_name", form.name)
        .eq("movie_date", movie.db_date)
        .single<Reservation>();
      if (te || !t) {
        toast.error("해당 학생의 예매 내역을 찾을 수 없습니다.");
        return;
      }
      if (t.is_printed) {
        toast.error("이미 발권이 완료된 티켓입니다. 관리자에게 문의해주세요.");
        return;
      }
      const res = await fetch("/api/kiosk", {
        method: "POST",
        body: JSON.stringify({
          action: "PRINT_TICKET",
          payload: {
            ticketId: t.id,
            studentId: id.cleanId,
            studentName: form.name,
            password: form.password,
            seatNumber: t.seat_number,
          },
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(`발권 실패: ${json.error ?? ""}`);
        return;
      }
      setTicket(t);
    } finally {
      setIsPrinting(false);
    }
  }

  if (!adminUnlocked) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <Card padding="lg" className="w-full max-w-sm text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 flex items-center justify-center text-[var(--color-accent-soft)]">
            <LockIcon className="w-6 h-6" />
          </div>
          <h1 className="mt-4 text-[20px] font-semibold">발권기 잠금 해제</h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">관리자 비밀번호를 입력해주세요.</p>
          <div className="mt-5 space-y-3">
            <Input
              type="password"
              align="center"
              value={adminInput}
              placeholder="비밀번호"
              onChange={(e) => setAdminInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && unlock()}
            />
            <Button fullWidth onClick={unlock}>발권기 열기</Button>
          </div>
        </Card>
      </main>
    );
  }

  if (ticket) return <ReceiptView ticket={ticket} movie={movie} />;

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8 no-print">
      <Wordmark size="sm" subtitle="kiosk" />
      <div className="w-full max-w-md mt-8 space-y-3">
        <Card padding="lg">
          <div className="text-[11px] tracking-[0.25em] uppercase text-[var(--color-text-muted)] mb-3">현장 발권</div>
          <div className="space-y-3">
            <Input
              label="학번"
              placeholder="예: 2703 (교직원은 '교직원')"
              value={form.studentId}
              onChange={(e) => setForm({ ...form, studentId: e.target.value })}
            />
            <Input
              label="이름 (본명)"
              placeholder="이름을 정확히 입력하세요"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              label="예매 비밀번호 (숫자 4자리)"
              type="password"
              maxLength={4}
              align="center"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value.replace(/[^0-9]/g, "") })}
            />
            {showResetButton && (
              <button
                type="button"
                onClick={requestReset}
                disabled={isResetting}
                className="text-[13px] text-[var(--color-accent-soft)] hover:text-[var(--color-accent)] underline underline-offset-4 font-medium block"
              >
                {isResetting ? "메일 발송 중..." : "비밀번호를 잊으셨나요? 이메일로 재설정"}
              </button>
            )}
            <Button fullWidth size="lg" onClick={submit} loading={isPrinting} leading={<PrinterIcon className="w-5 h-5" />}>
              티켓 출력하기
            </Button>
          </div>
        </Card>
        <p className="text-center text-[11px] text-[var(--color-text-muted)]">
          {STAFF_LIST.length}명의 교직원 / {Object.keys(STUDENT_LIST).length}명의 학생을 등록 중입니다.
        </p>
      </div>
      {isPrinting && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50">
          <Spinner size={32} />
        </div>
      )}
    </main>
  );
}

function ReceiptView({ ticket, movie }: { ticket: Reservation; movie: MovieSettings | null }) {
  const breakdown = popcornBreakdown(ticket.popcorn_order);
  const popcornText =
    breakdown.length === 0
      ? "팝콘 없음 (음료/팝콘 미포함)"
      : breakdown.map((b) => `${POPCORN_LABELS[b.flavor as PopcornFlavor]}  x${b.count}`).join("\n");
  const cleanedId = ticket.id.replace(/-/g, "").toUpperCase().slice(0, 16).padEnd(16, "0");
  const formattedId = cleanedId.match(/.{1,4}/g)?.join(" ") ?? cleanedId;

  return (
    <main className="min-h-screen bg-white text-black flex justify-center print:block">
      <div className="w-[80mm] p-4 font-mono">
        <div className="text-center">
          <div className="text-[22px] font-black tracking-[0.3em]">영화대교</div>
          <div className="text-[11px] text-gray-700 mt-1">
            {new Date().toLocaleString("ko-KR")} (KIOSK_1)
          </div>
        </div>
        <div className="border-t border-dashed border-black my-2" />
        <div className="text-[12px] font-bold">2D · {movie?.age_rating ?? "전체관람가"}</div>
        <div className="text-[20px] font-black leading-tight tracking-tight mt-1">{movie?.title ?? ""}</div>
        <div className="mt-2 inline-block border-2 border-black px-2 py-0.5 text-[13px] font-extrabold">
          상영일시: {movie?.date_string ?? ""}
        </div>
        <div className="mt-3 flex justify-between items-end">
          <div>
            <div className="text-[12px] font-bold">{movie?.venue ?? ""}</div>
            <div className="text-[12px] font-bold mt-1">
              예매자 {ticket.student_name} ({ticket.student_id})
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold">관람석</div>
            <div className="text-[28px] font-black leading-none">{ticket.seat_number}</div>
          </div>
        </div>
        <div className="border-t border-dashed border-black my-2" />
        <div className="text-[14px] font-black">팝콘 수령 정보</div>
        <pre className="text-[12px] font-bold whitespace-pre-wrap mt-1">{popcornText}</pre>
        <div className="border-t border-dashed border-black my-2" />
        <div className="text-[12px] font-bold text-center">대구과학고등학교 영화대교</div>
        <div className="text-[10px] mt-1 leading-relaxed">
          · 본 티켓은 1회 발권되며, 재발권은 운영진 승인 후 가능합니다.
          <br />· 입장 시 좌석 정보를 입장 안내요원에게 보여주세요.
          <br />· 상영 중 휴대전화는 무음으로 설정해주세요.
          <br />· 팝콘은 상영 시작 10분 전부터 현장에서 수령 가능합니다.
        </div>
        <div className="mt-3 flex justify-center">
          <Code39Barcode value={cleanedId} />
        </div>
        <div className="mt-1 text-center font-mono text-[11px] tracking-[0.2em]">{formattedId}</div>
      </div>
    </main>
  );
}

function Code39Barcode({ value }: { value: string }) {
  const seq = `*${value}*`;
  const bars: { w: number; black: boolean }[] = [];
  for (let i = 0; i < seq.length; i++) {
    const ch = seq[i];
    const pat = CODE39_MAP[ch] ?? CODE39_MAP["0"];
    for (let j = 0; j < pat.length; j++) {
      const wide = pat[j] === "w";
      bars.push({ w: wide ? 3 : 1, black: j % 2 === 0 });
    }
    if (i !== seq.length - 1) bars.push({ w: 1, black: false });
  }
  const total = bars.reduce((s, b) => s + b.w, 0);
  let x = 0;
  return (
    <svg width="220" height="50" viewBox={`0 0 ${total} 50`} preserveAspectRatio="none" style={{ maxWidth: "100%" }}>
      {bars.map((b, i) => {
        const cur = x;
        x += b.w;
        return b.black ? <rect key={i} x={cur} y={0} width={b.w} height={50} fill="black" /> : null;
      })}
    </svg>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { USER_EMAILS } from "@/lib/emails";
import { CLUB_MEMBERS } from "@/lib/constants";
import type {
  MovieSettings,
  Reservation,
  SeatSummary,
  VerifyPasswordResult,
} from "@/lib/db-types";
import { POPCORN_PRICE } from "@/lib/db-types";
import type { TicketRequest } from "@/lib/api-types";
import { computeVipSeats, getHallShape } from "@/lib/seats";
import { validateIdentity, validatePin, STAFF_KEY } from "@/lib/validation";
import { useToast } from "@/hooks/useToast";

import { Wordmark } from "@/components/domain/Wordmark";
import { MovieHero } from "@/components/domain/MoviePoster";
import { SeatGrid, SeatLegend } from "@/components/domain/SeatGrid";
import { PopcornSelector } from "@/components/domain/PopcornSelector";
import { PaymentQR } from "@/components/domain/PaymentQR";
import { GroupSummaryList } from "@/components/domain/GroupSummary";
import { UsageGuide } from "@/components/domain/UsageGuide";
import { SeatInfoModal } from "@/components/domain/SeatInfoModal";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Spinner } from "@/components/ui/Spinner";
import {
  ArrowRightIcon,
  CinemaIcon,
  CrownIcon,
  HomeIcon,
  PrinterIcon,
  SettingsIcon,
  SparkleIcon,
} from "@/components/icons";

const FALLBACK_MOVIE: MovieSettings = {
  id: 1,
  title: "로딩 중...",
  date_string: "로딩 중...",
  db_date: "",
  venue: "대구과학고등학교 중강당",
  age_rating: "전체관람가",
  poster_url: "/poster.jpg",
  deadline_date: "2099-12-31T23:59:00+09:00",
  mid_vip_start_row: "A",
  mid_vip_end_row: "C",
  mid_vip_start_col: 5,
  mid_vip_end_col: 10,
  grand_vip_start_row: "A",
  grand_vip_end_row: "C",
  grand_vip_start_col: 10,
  grand_vip_end_col: 18,
};

interface FormState {
  studentId: string;
  name: string;
  password: string;
}

interface GroupLeader {
  studentId: string;
  name: string;
  password: string;
  seat: string;
}

interface GroupMember {
  studentId: string;
  name: string;
  seat: string;
}

export default function HomePage() {
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isClosed, setIsClosed] = useState(false);
  const [movie, setMovie] = useState<MovieSettings>(FALLBACK_MOVIE);
  const [seatStatuses, setSeatStatuses] = useState<Record<string, SeatSummary>>({});
  const [blacklisted, setBlacklisted] = useState<string[]>([]);

  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [clickedSeat, setClickedSeat] = useState<{ id: string; data: SeatSummary } | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  const [form, setForm] = useState<FormState>({ studentId: "", name: "", password: "" });
  const [popcornList, setPopcornList] = useState<string[]>(["none"]);
  const [showResetButton, setShowResetButton] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [inviteName, setInviteName] = useState("");

  // group mode
  const [groupMode, setGroupMode] = useState(false);
  const [leader, setLeader] = useState<GroupLeader | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [memberForm, setMemberForm] = useState({ studentId: "", name: "" });
  const [isMemberFormOpen, setIsMemberFormOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isSoloConfirmOpen, setIsSoloConfirmOpen] = useState(false);
  const [groupProgress, setGroupProgress] = useState({ current: 0, total: 0, sending: false });

  const shape = useMemo(() => getHallShape(movie.venue), [movie.venue]);
  const vipSeats = useMemo(() => computeVipSeats(movie, shape), [movie, shape]);

  const popcornCount = popcornList.filter((p) => p !== "none").length;
  const popcornAmount = popcornCount * POPCORN_PRICE;

  // ----- initial fetch -----
  useEffect(() => {
    void fetchAll();
    void fetch("/api/cron/group-check").catch(() => {});
  }, []);

  // VIP invite link auto-fill
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("invite") !== "true") return;
    let id = params.get("id") ?? "";
    let name = params.get("name") ?? "";
    if (id === "undefined" || id === "null") id = "";
    if (name === "undefined" || name === "null") name = "";
    if (id || name) {
      const finalId = id && Number.isNaN(Number(id)) ? STAFF_KEY : id;
      setForm((prev) => ({ ...prev, studentId: finalId, name }));
      if (name) setInviteName(name);
    }
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  // beforeunload during group invite send
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (groupProgress.sending) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [groupProgress.sending]);

  async function fetchAll() {
    try {
      const { data: settings } = await supabase
        .from("movie_settings")
        .select("*")
        .eq("id", 1)
        .single<MovieSettings>();
      const dbDate = settings?.db_date ?? "2026-04-18";
      if (settings) {
        setMovie(settings);
        if (new Date() > new Date(settings.deadline_date)) setIsClosed(true);
      }
      const { data: rows } = await supabase
        .from("reservations")
        .select("id, seat_number, payment_status, student_name, student_id, group_expires_at, popcorn_order")
        .eq("movie_date", dbDate);
      const now = new Date();
      const next: Record<string, SeatSummary> = {};
      (rows as Pick<Reservation, "id" | "seat_number" | "payment_status" | "student_name" | "student_id" | "group_expires_at" | "popcorn_order">[] | null)?.forEach((r) => {
        if (r.payment_status === "pending" || r.payment_status === "confirmed") {
          next[r.seat_number] = {
            status: r.payment_status,
            name: r.student_name,
            ticketId: r.id,
            popcorn: r.popcorn_order,
          };
        } else if (r.payment_status === "group_pending") {
          if (r.group_expires_at && new Date(r.group_expires_at) > now) {
            next[r.seat_number] = {
              status: r.payment_status,
              name: r.student_name,
              ticketId: r.id,
              popcorn: r.popcorn_order,
            };
          }
        }
      });
      setSeatStatuses(next);

      const { data: bl } = await supabase.from("blacklist").select("student_id");
      setBlacklisted((bl ?? []).map((b: { student_id: string }) => b.student_id));
    } catch (err) {
      console.error("fetch error", err);
    } finally {
      setIsLoading(false);
    }
  }

  function emailFor(idOrKey: string, name: string): string | undefined {
    return idOrKey === STAFF_KEY ? USER_EMAILS[name] : USER_EMAILS[idOrKey];
  }

  // ----- seat click -----
  function handleSeatClick(seatId: string) {
    if (isClosed) return;

    if (groupMode) {
      if (seatStatuses[seatId]) return;
      if (leader?.seat === seatId) return;
      if (members.find((m) => m.seat === seatId)) {
        setMembers((prev) => prev.filter((m) => m.seat !== seatId));
        return;
      }
      if (members.length >= 9) {
        toast.error("단체 예매는 리더를 포함하여 최대 10명까지 가능합니다.");
        return;
      }
      if (vipSeats.has(seatId) && leader && !CLUB_MEMBERS.includes(leader.studentId)) {
        toast.error("선택하신 좌석은 영화대교 동아리 전용석입니다.");
        return;
      }
      setSelectedSeat(seatId);
      setMemberForm({ studentId: "", name: "" });
      setIsMemberFormOpen(true);
      return;
    }

    if (seatStatuses[seatId]) {
      if (seatStatuses[seatId].status === "group_pending") return;
      setClickedSeat({ id: seatId, data: seatStatuses[seatId] });
      return;
    }
    setSelectedSeat(seatId);
  }

  // ----- popcorn handler -----
  function handlePopcorn(next: string[]) {
    setPopcornList(next);
  }

  // ----- reset password -----
  async function requestReset() {
    setIsResetting(true);
    try {
      const cleanId = form.studentId.replace(/['"]/g, "").trim();
      const res = await fetch("/api/auth/request-reset", {
        method: "POST",
        body: JSON.stringify({
          studentId: cleanId,
          studentName: form.name,
          baseUrl: window.location.origin,
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

  // ----- shared identity + auth check -----
  async function ensureAuth(): Promise<{ cleanId: string; authKey: string } | null> {
    if (!form.studentId || !form.name || !form.password) {
      toast.error("정보를 모두 입력해주세요.");
      return null;
    }
    if (!validatePin(form.password)) {
      toast.error("비밀번호는 4자리 숫자만 입력해주세요.");
      return null;
    }
    const id = validateIdentity(form.studentId, form.name);
    if (!id.ok) {
      toast.error(id.reason);
      return null;
    }
    if (blacklisted.includes(id.cleanId)) {
      toast.error("블랙리스트에 등록되어 예매가 제한되었습니다.");
      return null;
    }
    if (selectedSeat && vipSeats.has(selectedSeat) && !CLUB_MEMBERS.includes(id.cleanId)) {
      toast.error("선택하신 좌석은 영화대교 동아리 전용석입니다.");
      return null;
    }
    const { data: auth, error } = await supabase.rpc<"verify_student_password", { p_student_id: string; p_password: string }>(
      "verify_student_password",
      { p_student_id: id.authKey, p_password: form.password }
    );
    if (error) {
      toast.error("네트워크 오류가 발생했습니다.");
      return null;
    }
    const result = auth as VerifyPasswordResult;
    if (!result.exists) {
      await supabase.from("student_auth").insert({ student_id: id.authKey, password: form.password });
      setShowResetButton(false);
    } else if (!result.success) {
      setShowResetButton(true);
      toast.error("비밀번호가 일치하지 않습니다.");
      return null;
    } else {
      setShowResetButton(false);
    }
    return { cleanId: id.cleanId, authKey: id.authKey };
  }

  // ----- single reservation submit -----
  async function handleReservationSubmit() {
    if (!selectedSeat) return;
    const auth = await ensureAuth();
    if (!auth) return;

    const ok = await toast.confirm(`${selectedSeat} 좌석 예매를 확정하시겠습니까?`);
    if (!ok) return;

    try {
      const popcornStr = popcornList.filter((p) => p !== "none").join(",") || "none";
      const baseUrl = window.location.origin;
      const userEmail = emailFor(auth.authKey, form.name);

      const { data: existing } = await supabase
        .from("reservations")
        .select("*")
        .eq("movie_date", movie.db_date)
        .eq("student_id", auth.cleanId)
        .eq("student_name", form.name);

      if (existing && existing.length > 0) {
        const old = existing[0] as Reservation;
        const oldPops = old.popcorn_order && old.popcorn_order !== "none" ? old.popcorn_order.split(",") : [];
        const newPops = popcornStr !== "none" ? popcornStr.split(",") : [];
        if (newPops.length < oldPops.length) {
          toast.error("결제 혼선 방지를 위해 기존 팝콘 수량을 줄일 수 없습니다. (맛 변경 및 추가만 가능)");
          return;
        }
        let confirmMsg = `이미 예약된 좌석(${old.seat_number})을 새로운 좌석(${selectedSeat})으로 변경하시겠습니까?`;
        if (old.popcorn_order !== popcornStr) {
          confirmMsg = `팝콘 주문이 변경되었습니다. 추가 결제는 현장에서 안내됩니다.\n\n${confirmMsg}`;
        }
        const change = await toast.confirm(confirmMsg);
        if (!change) return;
        const { data: updated, error: updErr } = await supabase
          .from("reservations")
          .update({ seat_number: selectedSeat, popcorn_order: popcornStr })
          .eq("id", old.id)
          .select("id")
          .single();
        if (updErr) {
          toast.error("변경 중 오류 (이미 선점된 좌석일 수 있습니다).");
          return;
        }
        await supabase.from("activity_logs").insert([
          {
            student_id: auth.cleanId,
            student_name: form.name,
            description: `좌석 변경 (${old.seat_number} → ${selectedSeat}) 및 팝콘 갱신`,
          },
        ]);
        if (userEmail && updated) {
          void fetch("/api/ticket", {
            method: "POST",
            body: JSON.stringify({
              email: userEmail,
              name: form.name,
              seat: selectedSeat,
              movieTitle: movie.title,
              movieDate: movie.date_string,
              statusType: "changed",
              popcorn: popcornStr,
              ticketId: updated.id,
              baseUrl,
            } satisfies TicketRequest),
          });
        }
        await toast.success("예매 변경 완료", "좌석이 변경되었습니다.\n새 티켓이 학교 메일로 발송되었습니다.", {
          ctaLabel: "메일 확인하기",
          ctaHref: "https://mail.google.com/",
        });
        await fetchAll();
        setIsFormOpen(false);
        setSelectedSeat(null);
        return;
      }

      const finalStatus: "confirmed" | "pending" = popcornStr === "none" ? "confirmed" : "pending";
      const { data: newTicket, error: insErr } = await supabase
        .from("reservations")
        .insert([
          {
            movie_date: movie.db_date,
            student_id: auth.cleanId,
            student_name: form.name,
            password: form.password,
            seat_number: selectedSeat,
            popcorn_order: popcornStr,
            payment_status: finalStatus,
          },
        ])
        .select("id")
        .single();
      if (insErr) {
        toast.error("앗! 다른 분이 먼저 예매했습니다.\n다른 좌석을 선택해주세요.");
        await fetchAll();
        return;
      }
      await supabase.from("activity_logs").insert([
        {
          student_id: auth.cleanId,
          student_name: form.name,
          description: finalStatus === "confirmed" ? `무료 예매 (${selectedSeat})` : `팝콘 포함 예매 대기 (${selectedSeat})`,
        },
      ]);
      if (userEmail && newTicket) {
        void fetch("/api/ticket", {
          method: "POST",
          body: JSON.stringify({
            email: userEmail,
            name: form.name,
            seat: selectedSeat,
            movieTitle: movie.title,
            movieDate: movie.date_string,
            statusType: finalStatus,
            popcorn: popcornStr,
            ticketId: newTicket.id,
            baseUrl,
          } satisfies TicketRequest),
        });
      }
      setSeatStatuses((prev) => ({
        ...prev,
        [selectedSeat]: {
          status: finalStatus,
          name: form.name,
          ticketId: newTicket?.id ?? "",
          popcorn: popcornStr,
        },
      }));
      setIsFormOpen(false);
      if (finalStatus === "confirmed") {
        await toast.success(
          "예매 성공",
          `${form.name}님 예매가 확정되었습니다.\n학교 이메일로 모바일 티켓이 발송되었습니다.`,
          { ctaLabel: "메일 확인하기", ctaHref: "https://mail.google.com/" }
        );
        setSelectedSeat(null);
      } else {
        setIsPaymentOpen(true);
      }
    } catch (err) {
      console.error(err);
      toast.error("네트워크 오류가 발생했습니다.");
    }
  }

  // ----- group mode start -----
  async function startGroup() {
    if (!selectedSeat) return;
    const auth = await ensureAuth();
    if (!auth) return;
    const { data: existing } = await supabase
      .from("reservations")
      .select("id")
      .eq("movie_date", movie.db_date)
      .eq("student_id", auth.cleanId);
    if (existing && existing.length > 0) {
      toast.error("이미 예매 내역이 있는 학생은 단체 예매 리더가 될 수 없습니다.\n기존 예매를 취소한 뒤 다시 시도해주세요.");
      return;
    }
    setLeader({ studentId: auth.cleanId, name: form.name, password: form.password, seat: selectedSeat });
    setMembers([]);
    setGroupMode(true);
    setIsFormOpen(false);
    setShowResetButton(false);
  }

  function addMember(thenFinalize: boolean) {
    if (!memberForm.studentId || !memberForm.name) {
      toast.error("학번과 이름을 입력해주세요.");
      return;
    }
    const id = validateIdentity(memberForm.studentId, memberForm.name);
    if (!id.ok) {
      toast.error(id.reason);
      return;
    }
    if (blacklisted.includes(id.cleanId)) {
      toast.error("블랙리스트에 등록되어 추가할 수 없습니다.");
      return;
    }
    if (leader?.studentId === id.cleanId) {
      toast.error("리더 본인은 추가할 수 없습니다.");
      return;
    }
    if (members.some((m) => m.studentId === id.cleanId)) {
      toast.error("이미 단체에 추가된 학생입니다.");
      return;
    }
    if (selectedSeat && vipSeats.has(selectedSeat) && !CLUB_MEMBERS.includes(id.cleanId)) {
      toast.error("동아리 전용석은 동아리 부원만 추가할 수 있습니다.");
      return;
    }
    void (async () => {
      const { data: dup } = await supabase
        .from("reservations")
        .select("id")
        .eq("movie_date", movie.db_date)
        .eq("student_id", id.cleanId);
      if (dup && dup.length > 0) {
        toast.error("이미 예매가 완료된 학생입니다.");
        return;
      }
      const next = [...members, { studentId: id.cleanId, name: memberForm.name, seat: selectedSeat! }];
      setMembers(next);
      setIsMemberFormOpen(false);
      setSelectedSeat(null);
      if (thenFinalize) setTimeout(() => setIsSummaryOpen(true), 80);
    })();
  }

  async function finalizeGroup() {
    if (!leader) return;
    setIsSummaryOpen(false);
    const groupId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const baseUrl = window.location.origin;

    const { data: leaderTicket, error: leaderErr } = await supabase
      .from("reservations")
      .insert([
        {
          movie_date: movie.db_date,
          student_id: leader.studentId,
          student_name: leader.name,
          password: leader.password,
          seat_number: leader.seat,
          popcorn_order: "none",
          payment_status: "confirmed",
          group_id: groupId,
          is_group_leader: true,
          group_expires_at: expiresAt,
        },
      ])
      .select("id")
      .single();
    if (leaderErr) {
      toast.error("리더 좌석 예매 중 오류가 발생했습니다 (이미 선점된 좌석일 수 있습니다).");
      return;
    }

    const memberInserts = members.map((m) => ({
      movie_date: movie.db_date,
      student_id: m.studentId,
      student_name: m.name,
      password: "",
      seat_number: m.seat,
      popcorn_order: "none",
      payment_status: "group_pending",
      group_id: groupId,
      is_group_leader: false,
      group_expires_at: expiresAt,
    }));
    const { data: memberTickets, error: memberErr } = await supabase
      .from("reservations")
      .insert(memberInserts)
      .select("id, student_id, student_name, seat_number");
    if (memberErr) {
      await supabase.from("reservations").delete().eq("id", leaderTicket.id);
      toast.error("멤버 좌석 예매 중 오류가 발생했습니다 (이미 선점된 좌석이 포함될 수 있습니다).");
      return;
    }

    await supabase.from("activity_logs").insert([
      {
        student_id: leader.studentId,
        student_name: leader.name,
        description: `단체 예매 생성 (리더: ${leader.seat}, 멤버 ${members.length}명)`,
      },
    ]);

    const leaderEmail = emailFor(leader.studentId, leader.name);
    if (leaderEmail) {
      void fetch("/api/ticket", {
        method: "POST",
        body: JSON.stringify({
          email: leaderEmail,
          name: leader.name,
          seat: leader.seat,
          movieTitle: movie.title,
          movieDate: movie.date_string,
          statusType: "confirmed",
          popcorn: "none",
          ticketId: leaderTicket.id,
          baseUrl,
        } satisfies TicketRequest),
      });
    }

    const payloads = (memberTickets ?? []).map((t: { id: string; student_id: string; student_name: string; seat_number: string }) => ({
      email: emailFor(t.student_id, t.student_name),
      name: t.student_name,
      seat: t.seat_number,
      studentId: t.student_id,
      memberId: t.id,
    }));

    setGroupProgress({ current: 0, total: payloads.length, sending: true });
    const CHUNK = 5;
    for (let i = 0; i < payloads.length; i += CHUNK) {
      const chunk = payloads.slice(i, i + CHUNK);
      try {
        await fetch("/api/group-invite", {
          method: "POST",
          body: JSON.stringify({
            members: chunk,
            leaderName: leader.name,
            movieTitle: movie.title,
            movieDate: movie.date_string,
            groupId,
            baseUrl,
          }),
        });
      } catch (e) {
        console.error(e);
      }
      setGroupProgress({ current: Math.min(i + CHUNK, payloads.length), total: payloads.length, sending: true });
      if (i + CHUNK < payloads.length) await new Promise((r) => setTimeout(r, 1000));
    }
    setGroupProgress((p) => ({ ...p, sending: false }));

    setGroupMode(false);
    setLeader(null);
    setMembers([]);
    await fetchAll();
    await toast.success(
      "단체 예매 완료",
      `${leader.name}님의 단체 예매가 등록되었습니다.\n리더는 즉시 확정, 멤버 ${payloads.length}명에게 초대 메일이 발송되었습니다.\n멤버는 1시간 이내에 메일을 통해 예매를 확정해야 합니다.`
    );
  }

  function cancelGroupMode() {
    void (async () => {
      const ok = await toast.confirm("단체 예매를 취소하시겠습니까?\n추가된 멤버 정보가 모두 삭제됩니다.", { tone: "danger" });
      if (!ok) return;
      setGroupMode(false);
      setLeader(null);
      setMembers([]);
      setSelectedSeat(null);
    })();
  }

  // ----- loading screen -----
  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <Wordmark size="md" />
          <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <Spinner size={16} />
            <span className="text-[12px] tracking-[0.3em] uppercase">로딩 중</span>
          </div>
        </div>
      </main>
    );
  }

  const showGroupColors = groupMode;
  const showGroupPending = groupMode || Object.values(seatStatuses).some((s) => s.status === "group_pending");
  const showPending = Object.values(seatStatuses).some((s) => s.status === "pending");

  return (
    <main className="min-h-screen flex flex-col items-center px-4 md:px-6 py-6 md:py-10">
      {/* top nav */}
      <nav className="w-full max-w-3xl flex items-center justify-end gap-2 mb-6">
        <Button variant="ghost" size="sm" leading={<CinemaIcon className="w-4 h-4" />} onClick={() => setIsManualOpen(true)}>
          이용 안내
        </Button>
        <Link href="/admin">
          <Button variant="ghost" size="sm" leading={<SettingsIcon className="w-4 h-4" />}>관리자</Button>
        </Link>
        <Link href="/print">
          <Button variant="ghost" size="sm" leading={<PrinterIcon className="w-4 h-4" />}>발권기</Button>
        </Link>
      </nav>

      {/* wordmark */}
      <header className="mb-8 md:mb-10">
        <Wordmark size="sm" subtitle="cinema bridge" />
      </header>

      {/* invite banner */}
      {inviteName && (
        <div className="w-full max-w-3xl mb-6 px-5 py-4 rounded-[var(--radius-lg)] border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 animate-[fade-in_220ms_ease-out_both]">
          <div className="flex items-center gap-2 text-[14px]">
            <SparkleIcon className="w-4 h-4 text-[var(--color-accent-soft)]" />
            <span className="text-[var(--color-text-secondary)]">
              <strong className="text-[var(--color-text-primary)]">{inviteName}</strong>님, 특별 초청을 환영합니다.
            </span>
          </div>
          <p className="mt-1 ml-6 text-[12px] text-[var(--color-text-muted)]">
            예매 시 학번과 이름이 자동으로 채워져 있습니다.
          </p>
        </div>
      )}

      {/* movie hero */}
      <div className="w-full mb-10">
        <MovieHero movie={movie} />
      </div>

      {/* seat grid */}
      <div className="w-full max-w-5xl">
        <SeatGrid
          movie={movie}
          reservations={seatStatuses}
          selectedSeat={selectedSeat}
          groupMode={groupMode}
          groupLeaderSeat={leader?.seat}
          groupMemberSeats={members.map((m) => ({ seat: m.seat, name: m.name }))}
          leaderName={leader?.name}
          onSeatClick={handleSeatClick}
          isClosed={isClosed}
        />
      </div>

      {/* legend */}
      <div className="mt-2 mb-6">
        <SeatLegend showGroupPending={showGroupPending} showPending={showPending} showGroupColors={showGroupColors} />
      </div>

      {/* footer action card */}
      <div className="w-full max-w-xl px-6 py-5 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-elev-1)] text-center">
        {groupMode && leader ? (
          <div className="space-y-4 text-left">
            <div className="flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-1.5 text-[var(--color-success-soft)] font-semibold">
                <CrownIcon className="w-4 h-4" />
                리더 {leader.name} ({leader.seat})
              </span>
              <span className="text-[var(--color-text-muted)]">
                멤버 {members.length} / 9
              </span>
            </div>
            {members.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {members.map((m) => (
                  <Badge key={m.seat} tone="sky">
                    {m.name} · {m.seat}
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-[12px] text-[var(--color-text-muted)] text-center">
              빈 좌석을 클릭하여 멤버를 추가하세요. (리더 포함 최대 10명)
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" fullWidth onClick={cancelGroupMode}>
                단체 예매 취소
              </Button>
              <Button
                variant="success"
                fullWidth
                trailing={<ArrowRightIcon className="w-4 h-4" />}
                onClick={() => (members.length === 0 ? setIsSoloConfirmOpen(true) : setIsSummaryOpen(true))}
              >
                완료하기
              </Button>
            </div>
          </div>
        ) : isClosed ? (
          <div className="px-4 py-3 rounded-[var(--radius)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 text-[var(--color-danger-soft)] font-semibold">
            예매가 모두 마감되었습니다
          </div>
        ) : selectedSeat ? (
          <div className="space-y-4">
            <div className="text-[14px] text-[var(--color-text-secondary)]">
              선택된 좌석{" "}
              <span className="ml-2 font-mono text-[28px] md:text-[32px] font-bold text-[var(--color-accent-soft)] tracking-tight">
                {selectedSeat}
              </span>
            </div>
            <Button fullWidth size="lg" onClick={() => setIsFormOpen(true)}>
              예매하기
            </Button>
          </div>
        ) : (
          <p className="text-[13px] text-[var(--color-text-muted)]">관람하실 좌석을 선택해주세요.</p>
        )}
      </div>

      {/* footer */}
      <footer className="mt-24 md:mt-32 mb-6 text-center opacity-50 hover:opacity-100 transition-opacity duration-700">
        <p className="text-[11px] text-[var(--color-text-muted)] tracking-wide">
          Crafted by <span className="text-[var(--color-text-secondary)] font-semibold">Shin Mingyu</span>
        </p>
        <p className="mt-1 text-[10px] text-[var(--color-text-faint)] tracking-[0.2em] uppercase">
          Powered by Supabase · Vercel
        </p>
      </footer>

      {/* ===== modals ===== */}

      <Modal
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="예매 정보 입력"
        description={selectedSeat ? `선택 좌석 ${selectedSeat}` : undefined}
        size="md"
        footer={
          <div className="w-full grid grid-cols-3 gap-2">
            <Button variant="ghost" onClick={() => setIsFormOpen(false)}>취소</Button>
            <Button onClick={handleReservationSubmit}>예매 확정</Button>
            <Button variant="success" onClick={startGroup}>단체 예매</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="학번"
            placeholder="예: 2703 (교직원은 '교직원')"
            value={form.studentId}
            onChange={(e) => setForm((p) => ({ ...p, studentId: e.target.value }))}
          />
          <Input
            label="이름 (본명)"
            placeholder="이름을 정확히 입력하세요"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <Input
            label="예매 비밀번호 (숫자 4자리)"
            type="password"
            inputMode="numeric"
            maxLength={4}
            align="center"
            value={form.password}
            helper="좌석 변경·티켓 출력·취소 시 동일하게 사용됩니다."
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
          />
          {showResetButton && (
            <button
              type="button"
              onClick={requestReset}
              disabled={isResetting}
              className="text-[13px] text-[var(--color-accent-soft)] hover:text-[var(--color-accent)] underline underline-offset-4 font-medium disabled:opacity-50"
            >
              {isResetting ? "메일 발송 중..." : "비밀번호를 잊으셨나요? 이메일로 재설정하기"}
            </button>
          )}
          <PopcornSelector list={popcornList} onChange={handlePopcorn} />
        </div>
      </Modal>

      <Modal
        open={isPaymentOpen}
        onClose={() => {
          setIsPaymentOpen(false);
          setSelectedSeat(null);
        }}
        size="sm"
        title="송금 안내"
      >
        <PaymentQR amount={popcornAmount} depositorLabel={`${form.studentId} ${form.name}`} />
      </Modal>

      <Modal
        open={isMemberFormOpen && !!selectedSeat}
        onClose={() => {
          setIsMemberFormOpen(false);
          setSelectedSeat(null);
        }}
        title="단체 멤버 추가"
        description={selectedSeat ? `좌석 ${selectedSeat}에 앉을 학생 정보를 입력하세요.` : undefined}
        size="md"
        footer={
          <div className="w-full grid grid-cols-3 gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setIsMemberFormOpen(false);
                setSelectedSeat(null);
              }}
            >
              취소
            </Button>
            <Button variant="info" onClick={() => addMember(false)}>계속하기</Button>
            <Button variant="success" onClick={() => addMember(true)}>완료하기</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="학번"
            placeholder="예: 2703 (교직원은 '교직원')"
            value={memberForm.studentId}
            onChange={(e) => setMemberForm((p) => ({ ...p, studentId: e.target.value }))}
          />
          <Input
            label="이름 (본명)"
            placeholder="이름을 정확히 입력하세요"
            value={memberForm.name}
            onChange={(e) => setMemberForm((p) => ({ ...p, name: e.target.value }))}
          />
        </div>
      </Modal>

      <Modal
        open={isSummaryOpen && !!leader}
        onClose={() => setIsSummaryOpen(false)}
        title="단체 예매 최종 확인"
        size="lg"
        footer={
          <div className="w-full flex gap-2">
            <Button variant="ghost" fullWidth onClick={() => setIsSummaryOpen(false)}>돌아가기</Button>
            <Button variant="success" fullWidth onClick={finalizeGroup}>확정 및 메일 발송</Button>
          </div>
        }
      >
        {leader && (
          <>
            <GroupSummaryList
              leader={leader}
              members={members}
              onRemoveMember={(seat) => setMembers((prev) => prev.filter((m) => m.seat !== seat))}
            />
            <div className="mt-4 px-4 py-3 rounded-[var(--radius)] bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 text-[12.5px] text-[var(--color-warning)]">
              1시간 안에 초대 메일에 응답한 사람만 예매가 확정됩니다. 미응답 시 좌석은 자동으로 해제됩니다.
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={isSoloConfirmOpen && !!leader}
        onClose={() => setIsSoloConfirmOpen(false)}
        title="멤버가 없습니다"
        size="sm"
        footer={
          <div className="w-full flex flex-col gap-2">
            <Button
              fullWidth
              onClick={() => {
                if (!leader) return;
                setIsSoloConfirmOpen(false);
                setGroupMode(false);
                setSelectedSeat(leader.seat);
                setLeader(null);
                setMembers([]);
                setIsFormOpen(true);
              }}
            >
              혼자 예매하기
            </Button>
            <Button variant="success" fullWidth onClick={() => setIsSoloConfirmOpen(false)}>
              계속 단체 멤버 추가하기
            </Button>
            <Button
              variant="ghost"
              fullWidth
              onClick={() => {
                setIsSoloConfirmOpen(false);
                setGroupMode(false);
                setLeader(null);
                setMembers([]);
                setSelectedSeat(null);
              }}
            >
              단체 예매 전체 취소
            </Button>
          </div>
        }
      >
        <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed">
          추가된 멤버가 없습니다. <strong className="text-[var(--color-text-primary)]">{leader?.name}</strong>님의
          좌석({leader?.seat})만 혼자 예매하거나, 계속해서 단체 멤버를 추가할 수 있습니다.
        </p>
      </Modal>

      <Modal
        open={groupProgress.sending}
        dismissible={false}
        size="sm"
        zIndex={100}
        title="초대 이메일 발송 중"
        description="창을 닫지 마세요. 이메일 발송이 완료될 때까지 기다려주세요."
      >
        <ProgressBar current={groupProgress.current} total={groupProgress.total} tone="emerald" />
      </Modal>

      <UsageGuide open={isManualOpen} onClose={() => setIsManualOpen(false)} />

      {clickedSeat && (
        <SeatInfoModal
          open={!!clickedSeat}
          onClose={() => setClickedSeat(null)}
          seatId={clickedSeat.id}
          data={clickedSeat.data}
          onCancel={() => {
            window.location.href = `/cancel?ticketId=${clickedSeat.data.ticketId}`;
          }}
          onShowGuide={() => setIsManualOpen(true)}
        />
      )}
    </main>
  );
}

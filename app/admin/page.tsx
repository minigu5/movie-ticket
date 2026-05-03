"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CLUB_MEMBERS, STUDENT_LIST } from "@/lib/constants";
import { USER_EMAILS } from "@/lib/emails";
import type { ActivityLog, BlacklistEntry, MovieSettings, Reservation } from "@/lib/db-types";
import { POPCORN_LABELS, POPCORN_PRICE } from "@/lib/db-types";
import type { TicketRequest } from "@/lib/api-types";
import { formatKRW, formatLogTimestamp, popcornBreakdown, popcornTotal } from "@/lib/format";
import { useToast } from "@/hooks/useToast";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Modal } from "@/components/ui/Modal";
import {
  AlertIcon,
  CheckIcon,
  CrownIcon,
  HomeIcon,
  LockIcon,
  LogIcon,
  MailIcon,
  PrinterIcon,
  RefreshIcon,
  SettingsIcon,
  TrashIcon,
  XIcon,
} from "@/components/icons";

type AdminMovie = MovieSettings;

const VENUES = ["대구과학고등학교 중강당", "대구과학고등학교 대강당"];
const RATINGS = ["전체관람가", "12세이상관람가", "15세이상관람가", "청소년관람불가"];

interface PromoTargets {
  grade1: boolean;
  grade2: boolean;
  grade3: boolean;
  staff: boolean;
  club: boolean;
}

export default function AdminPage() {
  const toast = useToast();

  const [password, setPassword] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [isLoadingUI, setIsLoadingUI] = useState(false);
  const [skipAuth, setSkipAuth] = useState(false);

  const [movie, setMovie] = useState<AdminMovie | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  const [editForm, setEditForm] = useState<AdminMovie | null>(null);
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [showVenueWarn, setShowVenueWarn] = useState(false);

  const [showLogs, setShowLogs] = useState(false);

  const [promoTargets, setPromoTargets] = useState<PromoTargets>({
    grade1: false,
    grade2: false,
    grade3: false,
    staff: false,
    club: true,
  });
  const [singleTarget, setSingleTarget] = useState("");
  const [isSendingPromo, setIsSendingPromo] = useState(false);
  const [promoProgress, setPromoProgress] = useState({ current: 0, total: 0 });
  const [showPromoWarn, setShowPromoWarn] = useState(false);
  const [pendingPromoRecipients, setPendingPromoRecipients] = useState<{ studentId: string; email: string; name: string }[]>([]);

  const [newBlackId, setNewBlackId] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    setBaseUrl(window.location.origin);
    if (localStorage.getItem("skip_auth") === "true") {
      const saved = localStorage.getItem("admin_token");
      if (saved) {
        setPassword(saved);
        setSkipAuth(true);
        setIsAuthed(true);
      } else {
        localStorage.setItem("skip_auth", "false");
      }
    }
  }, []);

  useEffect(() => {
    if (isAuthed) void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  const popcornStats = useMemo(() => {
    let original = 0,
      consomme = 0,
      caramel = 0,
      none = 0,
      cash = 0;
    reservations
      .filter((r) => r.payment_status === "confirmed")
      .forEach((r) => {
        if (!r.popcorn_order || r.popcorn_order === "none") {
          none++;
          return;
        }
        r.popcorn_order.split(",").forEach((p) => {
          if (p === "original") original++;
          else if (p === "consomme") consomme++;
          else if (p === "caramel") caramel++;
          cash += POPCORN_PRICE;
        });
      });
    return {
      original,
      consomme,
      caramel,
      none,
      cash,
      confirmed: reservations.filter((r) => r.payment_status === "confirmed").length,
    };
  }, [reservations]);

  // ===== auth =====
  async function login() {
    const res = await fetch("/api/admin/action", {
      method: "POST",
      body: JSON.stringify({ action: "LOGIN", adminPassword: password }),
    });
    const data = await res.json();
    if (data.success) setIsAuthed(true);
    else toast.error("비밀번호가 틀렸습니다.");
  }

  async function toggleSkipAuth() {
    let currentPass = password;
    if (!skipAuth) {
      const pass = window.prompt("자동 로그인을 켜기 위해 관리자 비밀번호를 입력해주세요.");
      if (!pass) return;
      const res = await fetch("/api/admin/action", {
        method: "POST",
        body: JSON.stringify({ action: "LOGIN", adminPassword: pass }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error("비밀번호가 틀렸습니다.");
        return;
      }
      currentPass = pass;
    }
    const next = !skipAuth;
    if (next) {
      localStorage.setItem("skip_auth", "true");
      localStorage.setItem("admin_token", currentPass);
    } else {
      localStorage.setItem("skip_auth", "false");
      localStorage.removeItem("admin_token");
    }
    setSkipAuth(next);
    toast.notify(next ? "현재 브라우저에서 비밀번호 입력이 생략됩니다." : "자동 로그인이 해제되었습니다.", "info");
  }

  async function fetchData() {
    setIsLoadingUI(true);
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        body: JSON.stringify({ action: "FETCH_INITIAL_DATA", adminPassword: password }),
      });
      const { data, success, error } = await res.json();
      if (!success) {
        if (res.status === 401) setIsAuthed(false);
        toast.error(`데이터 불러오기 실패: ${error ?? ""}`);
        return;
      }
      const { movieData, resData, blData, logData } = data;
      if (movieData) {
        setMovie(movieData);
        setEditForm({
          ...movieData,
          age_rating: movieData.age_rating || "전체관람가",
          mid_vip_start_row: movieData.mid_vip_start_row || "A",
          mid_vip_end_row: movieData.mid_vip_end_row || "C",
          mid_vip_start_col: movieData.mid_vip_start_col || 5,
          mid_vip_end_col: movieData.mid_vip_end_col || 10,
          grand_vip_start_row: movieData.grand_vip_start_row || "A",
          grand_vip_end_row: movieData.grand_vip_end_row || "C",
          grand_vip_start_col: movieData.grand_vip_start_col || 10,
          grand_vip_end_col: movieData.grand_vip_end_col || 18,
        });
      }
      if (resData) setReservations(resData);
      if (blData) setBlacklist(blData);
      if (logData) setLogs(logData);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingUI(false);
    }
  }

  // ===== settings =====
  function onSaveSettingsClick() {
    if (!movie || !editForm) return;
    if (editForm.venue !== movie.venue) setShowVenueWarn(true);
    else void doSave(false);
  }

  async function doSave(isVenueChanged: boolean) {
    if (!movie || !editForm) return;
    const res = await fetch("/api/admin/action", {
      method: "POST",
      body: JSON.stringify({ action: "UPDATE_SETTINGS", adminPassword: password, payload: editForm }),
    });
    const data = await res.json();
    if (!data.success) {
      toast.error(`설정 저장 실패: ${data.error ?? ""}`);
      return;
    }
    if (isVenueChanged) {
      await fetch("/api/admin/action", {
        method: "POST",
        body: JSON.stringify({
          action: "CLEAR_RESERVATIONS",
          adminPassword: password,
          payload: { movieDate: movie.db_date },
        }),
      });
      toast.notify("상영관이 변경되어 예매 내역이 초기화되었습니다.", "success");
    } else {
      toast.notify("설정이 저장되었습니다.", "success");
    }
    setShowVenueWarn(false);
    setIsEditingSettings(false);
    void fetchData();
  }

  // ===== reservation actions =====
  async function approve(t: Reservation) {
    if (!movie) return;
    const total = popcornTotal(t.popcorn_order);
    const ok = await toast.confirm(`${t.student_name}님의 예매를 확정하시겠습니까?\n입금 확인 금액: ${formatKRW(total)}`);
    if (!ok) return;
    const res = await fetch("/api/admin/action", {
      method: "POST",
      body: JSON.stringify({
        action: "APPROVE_RESERVATION",
        adminPassword: password,
        payload: { id: t.id, studentId: t.student_id, studentName: t.student_name, seatNumber: t.seat_number },
      }),
    });
    const data = await res.json();
    if (!data.success) {
      toast.error(`승인 실패: ${data.error ?? ""}`);
      return;
    }
    const userEmail = t.student_id === "교직원" ? USER_EMAILS[t.student_name] : USER_EMAILS[t.student_id];
    if (userEmail) {
      await fetch("/api/ticket", {
        method: "POST",
        body: JSON.stringify({
          email: userEmail,
          name: t.student_name,
          seat: t.seat_number,
          movieTitle: movie.title,
          movieDate: movie.date_string,
          statusType: "confirmed",
          popcorn: t.popcorn_order,
          ticketId: t.id,
          baseUrl,
        } satisfies TicketRequest),
      });
    }
    toast.notify("승인 완료 및 메일 발송", "success");
    void fetchData();
  }

  async function cancelReservation(t: Reservation) {
    if (!movie) return;
    const ok = await toast.confirm(`${t.student_name}님의 예매를 정말 취소하시겠습니까?`, { tone: "danger" });
    if (!ok) return;
    const res = await fetch("/api/admin/action", {
      method: "POST",
      body: JSON.stringify({
        action: "CANCEL_RESERVATION",
        adminPassword: password,
        payload: { id: t.id, studentId: t.student_id, studentName: t.student_name, seatNumber: t.seat_number },
      }),
    });
    const data = await res.json();
    if (!data.success) {
      toast.error(`취소 실패: ${data.error ?? ""}`);
      return;
    }
    const userEmail = t.student_id === "교직원" ? USER_EMAILS[t.student_name] : USER_EMAILS[t.student_id];
    if (userEmail) {
      const isRefundNeeded = t.popcorn_order !== "none" && t.payment_status === "confirmed";
      await fetch("/api/ticket", {
        method: "POST",
        body: JSON.stringify({
          email: userEmail,
          name: t.student_name,
          seat: t.seat_number,
          movieTitle: movie.title,
          movieDate: movie.date_string,
          statusType: "canceled",
          popcorn: t.popcorn_order,
          ticketId: t.id,
          baseUrl,
          isRefundNeeded,
        } satisfies TicketRequest),
      });
    }
    toast.notify("취소 완료 및 메일 발송", "success");
    void fetchData();
  }

  async function resetPrint(t: Reservation) {
    const ok = await toast.confirm(`${t.student_name}님의 발권 상태를 미발권으로 초기화할까요?`);
    if (!ok) return;
    const res = await fetch("/api/admin/action", {
      method: "POST",
      body: JSON.stringify({
        action: "RESET_PRINT",
        adminPassword: password,
        payload: { id: t.id, studentId: t.student_id, studentName: t.student_name, seatNumber: t.seat_number },
      }),
    });
    const data = await res.json();
    if (!data.success) {
      toast.error(`초기화 실패: ${data.error ?? ""}`);
      return;
    }
    toast.notify("발권 상태가 초기화되었습니다.", "success");
    void fetchData();
  }

  // ===== blacklist =====
  async function addBlacklist() {
    if (!movie) return;
    if (newBlackId.length !== 4) {
      toast.error("학번 4자리를 입력해주세요.");
      return;
    }
    const studentName = STUDENT_LIST[newBlackId];
    if (!studentName) {
      toast.error("존재하지 않는 학번입니다.");
      return;
    }
    const ok = await toast.confirm(
      `${studentName}(${newBlackId}) 학생을 블랙리스트에 추가하시겠습니까?\n\n진행 중이거나 완료된 예매가 있다면 자동 취소됩니다.`,
      { tone: "danger" }
    );
    if (!ok) return;
    const res = await fetch("/api/admin/action", {
      method: "POST",
      body: JSON.stringify({
        action: "ADD_BLACKLIST",
        adminPassword: password,
        payload: { studentId: newBlackId, studentName, movieDate: movie.db_date },
      }),
    });
    const data = await res.json();
    if (!data.success) {
      toast.error("추가 실패 (이미 등록된 학생일 수 있습니다).");
      return;
    }
    const userEmail = USER_EMAILS[newBlackId];
    if (data.canceledTicket && userEmail) {
      const ticket = data.canceledTicket as Reservation;
      const isRefundNeeded = ticket.popcorn_order !== "none" && ticket.payment_status === "confirmed";
      await fetch("/api/ticket", {
        method: "POST",
        body: JSON.stringify({
          email: userEmail,
          name: studentName,
          seat: ticket.seat_number,
          movieTitle: movie.title,
          movieDate: movie.date_string,
          statusType: "canceled",
          popcorn: ticket.popcorn_order,
          ticketId: ticket.id,
          baseUrl,
          isRefundNeeded,
        } satisfies TicketRequest),
      });
    }
    if (userEmail) {
      await fetch("/api/blacklist", {
        method: "POST",
        body: JSON.stringify({ email: userEmail, name: studentName, action: "added" }),
      });
    }
    toast.notify("블랙리스트 추가 및 메일 발송 완료", "success");
    setNewBlackId("");
    void fetchData();
  }

  async function removeBlacklist(studentId: string, studentName: string) {
    const ok = await toast.confirm(`${studentName}(${studentId}) 학생의 블랙리스트를 해제하시겠습니까?`);
    if (!ok) return;
    await fetch("/api/admin/action", {
      method: "POST",
      body: JSON.stringify({
        action: "REMOVE_BLACKLIST",
        adminPassword: password,
        payload: { studentId },
      }),
    });
    const userEmail = USER_EMAILS[studentId];
    if (userEmail) {
      await fetch("/api/blacklist", {
        method: "POST",
        body: JSON.stringify({ email: userEmail, name: studentName, action: "removed" }),
      });
    }
    toast.notify("해제 완료 및 안내 메일 발송", "success");
    void fetchData();
  }

  // ===== promo =====
  function preparePromo() {
    if (!movie) return;
    const map = new Map<string, { studentId: string; email: string; name: string }>();
    if (promoTargets.club) {
      CLUB_MEMBERS.forEach((id) => {
        const email = USER_EMAILS[id];
        if (email) map.set(id, { studentId: id, email, name: STUDENT_LIST[id] || "학생" });
      });
    }
    if (singleTarget && USER_EMAILS[singleTarget]) {
      const name = Number.isNaN(Number(singleTarget)) ? singleTarget : STUDENT_LIST[singleTarget] || "학생";
      map.set(singleTarget, { studentId: singleTarget, email: USER_EMAILS[singleTarget], name });
    }
    Object.keys(USER_EMAILS).forEach((key) => {
      let add = false;
      if (promoTargets.grade1 && key.startsWith("1") && key.length === 4) add = true;
      if (promoTargets.grade2 && key.startsWith("2") && key.length === 4) add = true;
      if (promoTargets.grade3 && key.startsWith("3") && key.length === 4) add = true;
      if (promoTargets.staff && Number.isNaN(Number(key))) add = true;
      if (add) {
        map.set(key, {
          studentId: key,
          email: USER_EMAILS[key],
          name: Number.isNaN(Number(key)) ? key : STUDENT_LIST[key] || "학생",
        });
      }
    });
    const recipients = Array.from(map.values());
    if (recipients.length === 0) {
      toast.error("선택된 발송 대상이 없습니다.");
      return;
    }
    setPendingPromoRecipients(recipients);
    setShowPromoWarn(true);
  }

  async function executePromo() {
    if (!movie) return;
    setShowPromoWarn(false);
    setIsSendingPromo(true);
    const recipients = pendingPromoRecipients;
    setPromoProgress({ current: 0, total: recipients.length });
    const CHUNK = 15;
    for (let i = 0; i < recipients.length; i += CHUNK) {
      const chunk = recipients.slice(i, i + CHUNK);
      try {
        await fetch("/api/promo", {
          method: "POST",
          body: JSON.stringify({ chunk, movieInfo: movie, baseUrl }),
        });
      } catch (e) {
        console.error(e);
      }
      setPromoProgress({ current: Math.min(i + CHUNK, recipients.length), total: recipients.length });
      if (i + CHUNK < recipients.length) await new Promise((r) => setTimeout(r, 1000));
    }
    await fetch("/api/admin/action", {
      method: "POST",
      body: JSON.stringify({
        action: "LOG_ACTION",
        adminPassword: password,
        payload: { studentId: "관리자", studentName: "-", description: `홍보 이메일 발송 완료 (${recipients.length}명)` },
      }),
    });
    setIsSendingPromo(false);
    toast.notify("홍보 메일 발송 완료", "success");
    void fetchData();
  }

  // ===== render =====

  if (!isAuthed) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <Card padding="lg" className="w-full max-w-sm text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 flex items-center justify-center text-[var(--color-accent-soft)]">
            <LockIcon className="w-6 h-6" />
          </div>
          <h1 className="mt-4 text-[20px] font-semibold text-[var(--color-text-primary)]">관리자 로그인</h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">비밀번호를 입력해주세요.</p>
          <div className="mt-5 space-y-3">
            <Input
              type="password"
              placeholder="관리자 비밀번호"
              align="center"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void login()}
            />
            <Button fullWidth onClick={login}>접속하기</Button>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 md:px-8 py-6 md:py-8">
      {/* Top nav */}
      <nav className="w-full flex flex-wrap items-center justify-end gap-2 mb-6">
        <Button
          variant={skipAuth ? "primary" : "outline"}
          size="sm"
          leading={<LockIcon className="w-4 h-4" />}
          onClick={toggleSkipAuth}
        >
          {skipAuth ? "자동 로그인 ON" : "자동 로그인 OFF"}
        </Button>
        <Link href="/">
          <Button variant="ghost" size="sm" leading={<HomeIcon className="w-4 h-4" />}>메인</Button>
        </Link>
        <Link href="/print">
          <Button variant="ghost" size="sm" leading={<PrinterIcon className="w-4 h-4" />}>발권기</Button>
        </Link>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <CrownIcon className="w-6 h-6 text-[var(--color-accent-soft)]" />
          <h1 className="text-[22px] md:text-[26px] font-semibold tracking-tight">관리자 대시보드</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leading={<LogIcon className="w-4 h-4" />}
            onClick={() => setShowLogs((v) => !v)}
          >
            {showLogs ? "로그 닫기" : "로그 열기"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            leading={<RefreshIcon className="w-4 h-4" />}
            onClick={() => void fetchData()}
          >
            새로고침
          </Button>
          <Button
            variant="outline"
            size="sm"
            leading={<SettingsIcon className="w-4 h-4" />}
            onClick={() => setIsEditingSettings((v) => !v)}
          >
            설정 변경
          </Button>
        </div>
      </div>

      {/* Stats */}
      <Card padding="md" className="mb-6">
        <div className="text-[11px] tracking-[0.25em] uppercase text-[var(--color-text-muted)] mb-3">예매 및 팝콘 현황 (확정 기준)</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatTile label="총 확정 예매" value={popcornStats.confirmed} suffix="건" tone="amber" />
          <StatTile label="오리지널" value={popcornStats.original} />
          <StatTile label="콘소메" value={popcornStats.consomme} />
          <StatTile label="카라멜" value={popcornStats.caramel} />
          <StatTile label="현금 매출" value={popcornStats.cash} suffix="원" mono tone="emerald" />
        </div>
      </Card>

      {/* Logs */}
      {showLogs && (
        <Card padding="md" className="mb-6">
          <div className="text-[11px] tracking-[0.25em] uppercase text-[var(--color-text-muted)] mb-3">시스템 활동 로그 (최근 100건)</div>
          <div className="max-h-80 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]">
            {logs.length === 0 ? (
              <div className="p-4 text-center text-[13px] text-[var(--color-text-muted)]">로그가 없습니다.</div>
            ) : (
              logs.map((l) => (
                <div
                  key={l.id}
                  className="grid grid-cols-[180px_80px_80px_1fr] gap-3 px-3 py-2 border-b border-[var(--color-border-subtle)] last:border-b-0 text-[12.5px]"
                >
                  <span className="text-[var(--color-text-muted)] font-mono">{formatLogTimestamp(l.created_at)}</span>
                  <span className="text-[var(--color-accent-soft)] font-mono">{l.student_id}</span>
                  <span className="text-[var(--color-info-soft)]">{l.student_name}</span>
                  <span className="text-[var(--color-text-primary)]">{l.description}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* Settings */}
      {isEditingSettings && editForm && (
        <Card padding="md" className="mb-6">
          <div className="text-[11px] tracking-[0.25em] uppercase text-[var(--color-text-muted)] mb-3">상영 설정 편집</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="제목" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            <Input label="포스터 URL" value={editForm.poster_url} onChange={(e) => setEditForm({ ...editForm, poster_url: e.target.value })} />
            <Input
              label="표시 일시 (예: 2026년 4월 18일 18:00)"
              value={editForm.date_string}
              onChange={(e) => setEditForm({ ...editForm, date_string: e.target.value })}
            />
            <Input
              label="DB 날짜 (YYYY-MM-DD)"
              value={editForm.db_date}
              onChange={(e) => setEditForm({ ...editForm, db_date: e.target.value })}
            />
            <SelectField
              label="상영관"
              value={editForm.venue}
              options={VENUES}
              onChange={(v) => setEditForm({ ...editForm, venue: v })}
            />
            <SelectField
              label="관람 등급"
              value={editForm.age_rating}
              options={RATINGS}
              onChange={(v) => setEditForm({ ...editForm, age_rating: v })}
            />
            <Input
              label="예매 마감 (ISO)"
              value={editForm.deadline_date}
              onChange={(e) => setEditForm({ ...editForm, deadline_date: e.target.value })}
              className="md:col-span-2"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <VipZone
              title="중강당 VIP 영역"
              tone="amber"
              startRow={editForm.mid_vip_start_row}
              endRow={editForm.mid_vip_end_row}
              startCol={editForm.mid_vip_start_col}
              endCol={editForm.mid_vip_end_col}
              onChange={(p) => setEditForm({ ...editForm, ...p })}
              prefix="mid"
            />
            <VipZone
              title="대강당 VIP 영역"
              tone="emerald"
              startRow={editForm.grand_vip_start_row}
              endRow={editForm.grand_vip_end_row}
              startCol={editForm.grand_vip_start_col}
              endCol={editForm.grand_vip_end_col}
              onChange={(p) => setEditForm({ ...editForm, ...p })}
              prefix="grand"
            />
          </div>

          <div className="mt-5">
            <Button onClick={onSaveSettingsClick}>변경사항 저장</Button>
          </div>
        </Card>
      )}

      {/* Promo */}
      <Card padding="md" className="mb-6">
        <div className="flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase text-[var(--color-text-muted)] mb-3">
          <MailIcon className="w-3.5 h-3.5" />
          상영작 홍보 메일 발송
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {(["club", "grade1", "grade2", "grade3", "staff"] as (keyof PromoTargets)[]).map((k) => (
            <CheckChip
              key={k}
              checked={promoTargets[k]}
              onChange={(v) => setPromoTargets((p) => ({ ...p, [k]: v }))}
              label={
                k === "club"
                  ? "동아리원"
                  : k === "staff"
                    ? "교직원"
                    : `${k.replace("grade", "")}학년`
              }
            />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-end">
          <SelectField
            label="특정 1인에게만 보내기 (선택)"
            value={singleTarget}
            options={["", ...Object.keys(USER_EMAILS)]}
            onChange={setSingleTarget}
            renderOption={(v) => (v === "" ? "선택 안 함" : `${v} ${STUDENT_LIST[v] ?? ""}`.trim())}
          />
          <Button onClick={preparePromo} disabled={isSendingPromo} leading={<MailIcon className="w-4 h-4" />}>
            메일 발송
          </Button>
        </div>
        {isSendingPromo && (
          <div className="mt-4">
            <ProgressBar current={promoProgress.current} total={promoProgress.total} />
          </div>
        )}
      </Card>

      {/* Blacklist */}
      <Card padding="md" className="mb-6">
        <div className="text-[11px] tracking-[0.25em] uppercase text-[var(--color-text-muted)] mb-3">블랙리스트 관리</div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input
            placeholder="학번 4자리"
            maxLength={4}
            value={newBlackId}
            onChange={(e) => setNewBlackId(e.target.value)}
            align="center"
          />
          <Button variant="danger" onClick={addBlacklist} leading={<AlertIcon className="w-4 h-4" />}>
            추가
          </Button>
        </div>
        {blacklist.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {blacklist.map((b) => (
              <span
                key={b.id}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 text-[12.5px] text-[var(--color-danger-soft)]"
              >
                {b.student_id} · {b.student_name}
                <button
                  type="button"
                  onClick={() => void removeBlacklist(b.student_id, b.student_name)}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  aria-label="해제"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* Reservations */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] tracking-[0.25em] uppercase text-[var(--color-text-muted)]">예매 내역</div>
          <span className="text-[11px] text-[var(--color-text-muted)]">{reservations.length}건</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] border-b border-[var(--color-border-subtle)]">
                <th className="py-2 pr-3">상태</th>
                <th className="py-2 pr-3">좌석</th>
                <th className="py-2 pr-3">학번 / 이름</th>
                <th className="py-2 pr-3">팝콘 / 결제</th>
                <th className="py-2 pr-3">발권</th>
                <th className="py-2 pr-3 text-right">작업</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((t) => (
                <tr key={t.id} className="border-b border-[var(--color-border-subtle)] last:border-b-0 hover:bg-[var(--color-bg-input)]/40">
                  <td className="py-3 pr-3">
                    {t.payment_status === "confirmed" ? (
                      <Badge tone="emerald" leading={<CheckIcon className="w-3 h-3" />}>확정</Badge>
                    ) : t.payment_status === "pending" ? (
                      <Badge tone="yellow">결제 대기</Badge>
                    ) : (
                      <Badge tone="sky">단체 대기</Badge>
                    )}
                    {t.is_group_leader && (
                      <Badge tone="amber" className="ml-1" leading={<CrownIcon className="w-3 h-3" />}>리더</Badge>
                    )}
                  </td>
                  <td className="py-3 pr-3 font-mono text-[var(--color-accent-soft)]">{t.seat_number}</td>
                  <td className="py-3 pr-3">
                    <div className="font-medium text-[var(--color-text-primary)]">{t.student_name}</div>
                    <div className="text-[11.5px] text-[var(--color-text-muted)] font-mono">{t.student_id}</div>
                  </td>
                  <td className="py-3 pr-3">
                    <PopcornCell order={t.popcorn_order} />
                  </td>
                  <td className="py-3 pr-3">
                    {t.is_printed ? <Badge tone="sky">발권 완료</Badge> : <span className="text-[var(--color-text-muted)] text-[12px]">미발권</span>}
                  </td>
                  <td className="py-3 pr-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {t.payment_status === "pending" && (
                        <Button size="sm" variant="success" onClick={() => approve(t)}>승인</Button>
                      )}
                      {t.is_printed && (
                        <Button size="sm" variant="outline" onClick={() => resetPrint(t)}>발권 초기화</Button>
                      )}
                      <Button size="sm" variant="danger" leading={<TrashIcon className="w-3.5 h-3.5" />} onClick={() => cancelReservation(t)}>
                        취소
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {reservations.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[13px] text-[var(--color-text-muted)]">예매 내역이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* venue change warning */}
      <Modal
        open={showVenueWarn}
        onClose={() => setShowVenueWarn(false)}
        tone="danger"
        size="md"
        title="상영관 변경 경고"
        description="상영관을 변경하면 현재 모든 예매 내역이 초기화됩니다. 되돌릴 수 없습니다."
        footer={
          <div className="w-full flex gap-2">
            <Button variant="ghost" fullWidth onClick={() => setShowVenueWarn(false)}>돌아가기</Button>
            <Button variant="danger" fullWidth onClick={() => doSave(true)}>초기화 후 변경</Button>
          </div>
        }
      >
        <div className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
          현재 좌석 배치가 새 상영관과 호환되지 않으므로 모든 예매가 즉시 삭제됩니다. 진행 전 학생들에게 별도로 공지했는지 다시 한 번 확인해주세요.
        </div>
      </Modal>

      {/* promo confirmation */}
      <Modal
        open={showPromoWarn}
        onClose={() => setShowPromoWarn(false)}
        size="md"
        title="대량 메일 발송 확인"
        description={`${pendingPromoRecipients.length}명에게 홍보 메일을 발송합니다.`}
        footer={
          <div className="w-full flex gap-2">
            <Button variant="ghost" fullWidth onClick={() => setShowPromoWarn(false)}>돌아가기</Button>
            <Button fullWidth onClick={executePromo}>발송 시작</Button>
          </div>
        }
      >
        <div className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
          15명씩 묶어서 1초 간격으로 발송됩니다. 발송 도중에는 창을 닫지 말아주세요.
        </div>
      </Modal>

      {/* loading overlay */}
      <Modal open={isLoadingUI} dismissible={false} size="sm" zIndex={90} title="서버 동기화 중">
        <div className="flex flex-col items-center gap-3 py-2">
          <Spinner size={32} />
          <p className="text-[13px] text-[var(--color-text-muted)]">최신 데이터를 불러오는 중입니다.</p>
        </div>
      </Modal>
    </main>
  );
}

function StatTile({
  label,
  value,
  suffix,
  mono,
  tone = "neutral",
}: {
  label: string;
  value: number;
  suffix?: string;
  mono?: boolean;
  tone?: "neutral" | "amber" | "emerald";
}) {
  const color =
    tone === "amber"
      ? "text-[var(--color-accent-soft)]"
      : tone === "emerald"
        ? "text-[var(--color-success-soft)]"
        : "text-[var(--color-text-primary)]";
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] px-4 py-3">
      <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--color-text-muted)]">{label}</div>
      <div className={`mt-1 text-[22px] font-bold ${color} ${mono ? "font-mono" : ""}`}>
        {value.toLocaleString("ko-KR")}
        {suffix && <span className="text-[12px] font-normal text-[var(--color-text-muted)] ml-1">{suffix}</span>}
      </div>
    </div>
  );
}

function PopcornCell({ order }: { order: string | null | undefined }) {
  const breakdown = popcornBreakdown(order);
  const total = popcornTotal(order);
  if (breakdown.length === 0) {
    return <span className="text-[var(--color-text-muted)] text-[12.5px]">무료 관람 (0원)</span>;
  }
  return (
    <div className="space-y-0.5">
      <div className="text-[var(--color-accent-soft)] font-mono font-semibold">{formatKRW(total)}</div>
      <div className="text-[11.5px] text-[var(--color-text-muted)]">
        {breakdown.map((b) => `${POPCORN_LABELS[b.flavor]} ×${b.count}`).join(" · ")}
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  renderOption,
}: {
  label: ReactNode;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  renderOption?: (v: string) => string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-medium text-[var(--color-text-secondary)] tracking-wide uppercase">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 rounded-[var(--radius)] bg-[var(--color-bg-input)] border border-[var(--color-border-subtle)] px-3 text-[14px] text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-accent)]"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {renderOption ? renderOption(o) : o || "—"}
          </option>
        ))}
      </select>
    </div>
  );
}

function CheckChip({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        "px-3 py-1.5 rounded-full border text-[12.5px] font-medium transition-colors",
        checked
          ? "bg-[var(--color-accent)]/15 border-[var(--color-accent)]/40 text-[var(--color-accent-soft)]"
          : "bg-[var(--color-bg-input)] border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function VipZone({
  title,
  tone,
  startRow,
  endRow,
  startCol,
  endCol,
  prefix,
  onChange,
}: {
  title: string;
  tone: "amber" | "emerald";
  startRow: string;
  endRow: string;
  startCol: number;
  endCol: number;
  prefix: "mid" | "grand";
  onChange: (p: Partial<MovieSettings>) => void;
}) {
  const accent = tone === "amber" ? "text-[var(--color-accent-soft)]" : "text-[var(--color-success-soft)]";
  return (
    <div className="rounded-[var(--radius)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] p-3">
      <div className={`text-[11px] tracking-[0.2em] uppercase ${accent} mb-2`}>{title}</div>
      <div className="grid grid-cols-4 gap-2">
        <Input
          label="행 시작"
          value={startRow}
          onChange={(e) => onChange({ [`${prefix}_vip_start_row`]: e.target.value.toUpperCase() } as Partial<MovieSettings>)}
        />
        <Input
          label="행 끝"
          value={endRow}
          onChange={(e) => onChange({ [`${prefix}_vip_end_row`]: e.target.value.toUpperCase() } as Partial<MovieSettings>)}
        />
        <Input
          label="열 시작"
          type="number"
          value={String(startCol)}
          onChange={(e) => onChange({ [`${prefix}_vip_start_col`]: Number(e.target.value) } as Partial<MovieSettings>)}
        />
        <Input
          label="열 끝"
          type="number"
          value={String(endCol)}
          onChange={(e) => onChange({ [`${prefix}_vip_end_col`]: Number(e.target.value) } as Partial<MovieSettings>)}
        />
      </div>
    </div>
  );
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AlertIcon, CheckIcon, SparkleIcon, XIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";

type ToastTone = "info" | "error" | "success";

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ConfirmState {
  message: string;
  tone?: "default" | "danger";
  confirmLabel?: string;
  cancelLabel?: string;
  resolve: (ok: boolean) => void;
}

interface SuccessState {
  title: string;
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
  resolve: () => void;
}

interface ToastApi {
  notify: (message: string, tone?: ToastTone) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  confirm: (
    message: string,
    options?: { tone?: "default" | "danger"; confirmLabel?: string; cancelLabel?: string }
  ) => Promise<boolean>;
  success: (title: string, message: string, options?: { ctaLabel?: string; ctaHref?: string }) => Promise<void>;
}

const Ctx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast must be inside ToastProvider");
  return v;
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [successState, setSuccessState] = useState<SuccessState | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: ToastTone) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, tone, message }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      notify: (m, t = "info") => push(m, t),
      error: (m) => push(m, "error"),
      info: (m) => push(m, "info"),
      confirm: (message, options) =>
        new Promise((resolve) => setConfirmState({ message, ...options, resolve })),
      success: (title, message, options) =>
        new Promise((resolve) => setSuccessState({ title, message, ...options, resolve })),
    }),
    [push]
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <div
            className="pointer-events-none fixed top-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 px-4"
            style={{ zIndex: 60 }}
          >
            {toasts.map((t) => (
              <ToastBubble key={t.id} item={t} onClose={() => dismiss(t.id)} />
            ))}
          </div>,
          document.body
        )}
      {mounted &&
        confirmState &&
        createPortal(
          <ConfirmModal
            state={confirmState}
            onResolve={(ok) => {
              confirmState.resolve(ok);
              setConfirmState(null);
            }}
          />,
          document.body
        )}
      {mounted &&
        successState &&
        createPortal(
          <SuccessModal
            state={successState}
            onClose={() => {
              successState.resolve();
              setSuccessState(null);
            }}
          />,
          document.body
        )}
    </Ctx.Provider>
  );
}

function ToastBubble({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const tones: Record<ToastTone, { bg: string; icon: ReactNode; text: string }> = {
    info: {
      bg: "border-[var(--color-info)]/40 bg-[var(--color-bg-elevated)]",
      icon: <SparkleIcon className="w-4 h-4 text-[var(--color-info-soft)]" />,
      text: "text-[var(--color-text-primary)]",
    },
    error: {
      bg: "border-[var(--color-danger)]/40 bg-[var(--color-bg-elevated)]",
      icon: <AlertIcon className="w-4 h-4 text-[var(--color-danger-soft)]" />,
      text: "text-[var(--color-text-primary)]",
    },
    success: {
      bg: "border-[var(--color-success)]/40 bg-[var(--color-bg-elevated)]",
      icon: <CheckIcon className="w-4 h-4 text-[var(--color-success-soft)]" />,
      text: "text-[var(--color-text-primary)]",
    },
  };
  const t = tones[item.tone];
  return (
    <div
      className={[
        "pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-[var(--radius)] border shadow-[var(--shadow-elev-2)]",
        "max-w-md min-w-[280px] animate-[slide-up_280ms_ease-out_both]",
        t.bg,
      ].join(" ")}
    >
      <div className="mt-0.5">{t.icon}</div>
      <p className={`flex-1 text-[14px] leading-relaxed whitespace-pre-line ${t.text}`}>{item.message}</p>
      <button
        onClick={onClose}
        className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        aria-label="닫기"
      >
        <XIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

function ConfirmModal({ state, onResolve }: { state: ConfirmState; onResolve: (ok: boolean) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onResolve(false);
    };
    window.addEventListener("keydown", onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = original;
    };
  }, [onResolve]);
  const isDanger = state.tone === "danger";
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 80 }}
      onMouseDown={(e) => e.target === e.currentTarget && onResolve(false)}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-[fade-in_220ms_ease-out_both]" />
      <div
        className={[
          "relative w-full max-w-sm bg-[var(--color-bg-elevated)] rounded-[var(--radius-lg)] border p-6 shadow-[var(--shadow-elev-2)]",
          "animate-[scale-in_220ms_ease-out_both]",
          isDanger ? "border-[var(--color-danger)]/40" : "border-[var(--color-border)]",
        ].join(" ")}
      >
        <p className="text-[15px] leading-relaxed text-[var(--color-text-primary)] whitespace-pre-line">
          {state.message}
        </p>
        <div className="mt-6 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => onResolve(false)}>
            {state.cancelLabel ?? "취소"}
          </Button>
          <Button variant={isDanger ? "danger" : "primary"} onClick={() => onResolve(true)}>
            {state.confirmLabel ?? "확인"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SuccessModal({ state, onClose }: { state: SuccessState; onClose: () => void }) {
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 100 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md animate-[fade-in_220ms_ease-out_both]" />
      <div className="relative w-full max-w-md bg-[var(--color-bg-elevated)] rounded-[var(--radius-lg)] border border-[var(--color-success)]/30 p-8 shadow-[var(--shadow-glow-emerald)] animate-[scale-in_220ms_ease-out_both] text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-[var(--color-success)]/15 flex items-center justify-center text-[var(--color-success-soft)]">
          <CheckIcon className="w-7 h-7" />
        </div>
        <h3 className="mt-5 text-[20px] font-semibold text-[var(--color-text-primary)] tracking-tight">
          {state.title}
        </h3>
        <p className="mt-2 text-[14px] text-[var(--color-text-secondary)] whitespace-pre-line leading-relaxed">
          {state.message}
        </p>
        <div className="mt-7 flex flex-col gap-2">
          {state.ctaHref && (
            <a
              href={state.ctaHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="inline-flex items-center justify-center h-12 rounded-[var(--radius)] bg-[var(--color-success)] text-[var(--color-bg-base)] font-semibold hover:bg-[var(--color-success-soft)] transition-colors"
            >
              {state.ctaLabel ?? "확인"}
            </a>
          )}
          <button
            onClick={onClose}
            className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors py-2"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

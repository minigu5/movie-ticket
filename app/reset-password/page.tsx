"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/useToast";

import { Wordmark } from "@/components/domain/Wordmark";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { LockIcon } from "@/components/icons";

export default function ResetPasswordPage() {
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
  const token = params.get("token") ?? "";
  const studentId = params.get("id") ?? "";
  const returnUrl = params.get("returnUrl") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function submit() {
    if (!/^[0-9]{4}$/.test(newPassword)) {
      toast.error("새 비밀번호는 4자리 숫자만 입력해주세요.");
      return;
    }
    setStatus("loading");
    const { data, error } = await supabase.rpc("update_password_secure", {
      p_student_id: studentId,
      p_new_password: newPassword,
      p_reset_token: token,
    });
    if (error || !data) {
      setStatus("error");
      toast.error("유효하지 않거나 만료된 링크입니다.\n새로 비밀번호 재설정을 요청해주세요.");
      return;
    }
    await supabase.from("activity_logs").insert([
      { student_id: studentId, student_name: "-", description: "비밀번호 재설정 완료" },
    ]);
    setStatus("success");
    if (returnUrl) {
      const ok = await toast.confirm("비밀번호가 변경되었습니다.\n예매 취소 페이지로 이어서 가시겠습니까?");
      router.push(ok ? returnUrl : "/");
    } else {
      await toast.success("완료", "비밀번호가 정상적으로 변경되었습니다.");
      router.push("/");
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      <Wordmark size="sm" />
      <div className="w-full max-w-sm mt-8">
        <Card padding="lg" className="text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 flex items-center justify-center text-[var(--color-accent-soft)]">
            <LockIcon className="w-6 h-6" />
          </div>
          <h1 className="mt-4 text-[20px] font-semibold">비밀번호 재설정</h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)] font-mono">{studentId}</p>

          <div className="mt-5 text-left">
            <Input
              label="새 비밀번호 (숫자 4자리)"
              type="password"
              maxLength={4}
              align="center"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value.replace(/[^0-9]/g, ""))}
            />
          </div>

          <Button className="mt-5" fullWidth onClick={submit} loading={status === "loading"}>
            비밀번호 변경
          </Button>
        </Card>
      </div>
    </main>
  );
}

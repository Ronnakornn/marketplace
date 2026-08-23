"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";
import { useTranslations } from "#/i18n/client";
import { changePassword, completePasswordReset, requestPasswordResetOtp, resendEmailVerification, verifyEmailOtp } from "#/features/auth/api";

export function VerifyEmailForm() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const verifyMutation = useMutation({ mutationFn: (value: Parameters<typeof verifyEmailOtp>[0]) => verifyEmailOtp(value) });
  const resendMutation = useMutation({ mutationFn: () => resendEmailVerification() });
  const loading = verifyMutation.isPending ? "verify" : resendMutation.isPending ? "resend" : null;

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await verifyMutation.mutateAsync({ email, otp });
      setMessage(t("auth.emailVerifiedSuccess"));
      setOtp("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.verificationFailed"));
    }
  }

  async function handleResend() {
    setError(null);
    setMessage(null);
    try {
      await resendMutation.mutateAsync();
      setMessage(t("auth.verificationCodeSent"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.resendVerificationFailed"));
    }
  }

  return (
    <AuthShell title={t("auth.verifyEmailTitle")} description={t("auth.verifyEmailDescription")}>
      <StatusMessage message={message} error={error} />
      <form onSubmit={handleVerify} className="space-y-4">
        <TextField id="verify-email" label={t("auth.email")} type="email" value={email} onChange={setEmail} required />
        <TextField id="verify-otp" label={t("auth.verificationCode")} value={otp} onChange={setOtp} required minLength={4} inputMode="numeric" />
        <button type="submit" disabled={loading !== null} className="w-full rounded-full bg-[var(--lagoon-deep)] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {loading === "verify" ? t("auth.verifying") : t("auth.verifyEmail")}
        </button>
      </form>
      <button type="button" onClick={handleResend} disabled={loading !== null} className="mt-3 w-full rounded-full border border-[var(--line)] px-5 py-2.5 text-sm font-semibold text-[var(--sea-ink)] disabled:cursor-not-allowed disabled:opacity-50">
        {loading === "resend" ? t("auth.sending") : t("auth.resendCode")}
      </button>
    </AuthShell>
  );
}

export function ForgotPasswordForm() {
  const t = useTranslations();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resetRequestMutation = useMutation({ mutationFn: (value: string) => requestPasswordResetOtp(value) });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await resetRequestMutation.mutateAsync(email);
      setMessage(t("auth.resetCodeSent"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.resetRequestFailed"));
    }
  }

  return (
    <AuthShell title={t("auth.resetPasswordTitle")} description={t("auth.resetPasswordDescription")}>
      <StatusMessage message={message} error={error} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField id="reset-request-email" label={t("auth.email")} type="email" value={email} onChange={setEmail} required />
        <button type="submit" disabled={resetRequestMutation.isPending} className="w-full rounded-full bg-[var(--lagoon-deep)] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {resetRequestMutation.isPending ? t("auth.sending") : t("auth.sendResetCode")}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-[var(--sea-ink-soft)]">
        {t("auth.haveResetCode")} <Link href="/reset-password" className="font-medium text-[var(--lagoon-deep)] hover:underline">{t("auth.setNewPassword")}</Link>
      </p>
    </AuthShell>
  );
}

export function ResetPasswordForm() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const resetMutation = useMutation({ mutationFn: (value: Parameters<typeof completePasswordReset>[0]) => completePasswordReset(value) });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await resetMutation.mutateAsync({ email, otp, newPassword });
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.resetPasswordFailed"));
    }
  }

  return (
    <AuthShell title={t("auth.setNewPassword")} description={t("auth.setNewPasswordDescription")}>
      <StatusMessage error={error} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField id="reset-email" label={t("auth.email")} type="email" value={email} onChange={setEmail} required />
        <TextField id="reset-otp" label={t("auth.resetCode")} value={otp} onChange={setOtp} required minLength={4} inputMode="numeric" />
        <TextField id="reset-new-password" label={t("auth.newPassword")} type="password" value={newPassword} onChange={setNewPassword} required minLength={8} />
        <button type="submit" disabled={resetMutation.isPending} className="w-full rounded-full bg-[var(--lagoon-deep)] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {resetMutation.isPending ? t("common.saving") : t("auth.saveNewPassword")}
        </button>
      </form>
    </AuthShell>
  );
}

export function ChangePasswordForm() {
  const t = useTranslations();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const changeMutation = useMutation({ mutationFn: (value: Parameters<typeof changePassword>[0]) => changePassword(value) });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await changeMutation.mutateAsync({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setMessage(t("auth.passwordChanged"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.changePasswordFailed"));
    }
  }

  return (
    <AuthShell title={t("auth.changePasswordTitle")} description={t("auth.changePasswordDescription")}>
      <StatusMessage message={message} error={error} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField id="current-password" label={t("auth.currentPassword")} type="password" value={currentPassword} onChange={setCurrentPassword} required />
        <TextField id="new-password" label={t("auth.newPassword")} type="password" value={newPassword} onChange={setNewPassword} required minLength={8} />
        <button type="submit" disabled={changeMutation.isPending} className="w-full rounded-full bg-[var(--lagoon-deep)] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {changeMutation.isPending ? t("common.saving") : t("auth.changePasswordAction")}
        </button>
      </form>
    </AuthShell>
  );
}

function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="page-wrap auth-page flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-12">
      <div className="island-shell auth-card w-full max-w-md rounded-2xl p-8">
        <h1 className="mb-2 text-2xl font-bold text-[var(--sea-ink)]">{title}</h1>
        <p className="mb-6 text-sm text-[var(--sea-ink-soft)]">{description}</p>
        {children}
      </div>
    </div>
  );
}

function TextField({
  id,
  label,
  onChange,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  id: string;
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">{label}</label>
      <input
        id={id}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm text-[var(--sea-ink)] outline-none focus:border-[var(--lagoon-deep)] focus:ring-2 focus:ring-[rgba(79,184,178,0.2)]"
        {...props}
      />
    </div>
  );
}

function StatusMessage({ message, error }: { message?: string | null; error?: string | null }) {
  if (!message && !error) return null;
  return (
    <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`} role="status">
      {error ?? message}
    </div>
  );
}

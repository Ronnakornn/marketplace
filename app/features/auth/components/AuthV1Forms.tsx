"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { changePassword, completePasswordReset, requestPasswordResetOtp, resendEmailVerification, verifyEmailOtp } from "#/features/auth/api";

export function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"verify" | "resend" | null>(null);

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading("verify");
    try {
      await verifyEmailOtp({ email, otp });
      setMessage("Email verified. You can continue using your account.");
      setOtp("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(null);
    }
  }

  async function handleResend() {
    setError(null);
    setMessage(null);
    setLoading("resend");
    try {
      await resendEmailVerification();
      setMessage("A new verification code was sent if your account is eligible.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend verification code");
    } finally {
      setLoading(null);
    }
  }

  return (
    <AuthShell title="Verify your email" description="Enter the code sent to your email address.">
      <StatusMessage message={message} error={error} />
      <form onSubmit={handleVerify} className="space-y-4">
        <TextField id="verify-email" label="Email" type="email" value={email} onChange={setEmail} required />
        <TextField id="verify-otp" label="Verification code" value={otp} onChange={setOtp} required minLength={4} inputMode="numeric" />
        <button type="submit" disabled={loading !== null} className="w-full rounded-full bg-[var(--lagoon-deep)] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {loading === "verify" ? "Verifying..." : "Verify email"}
        </button>
      </form>
      <button type="button" onClick={handleResend} disabled={loading !== null} className="mt-3 w-full rounded-full border border-[var(--line)] px-5 py-2.5 text-sm font-semibold text-[var(--sea-ink)] disabled:cursor-not-allowed disabled:opacity-50">
        {loading === "resend" ? "Sending..." : "Resend code"}
      </button>
    </AuthShell>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await requestPasswordResetOtp(email);
      setMessage("If that email has an account, a reset code has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request reset code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Reset password" description="Request a code to set a new password.">
      <StatusMessage message={message} error={error} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField id="reset-request-email" label="Email" type="email" value={email} onChange={setEmail} required />
        <button type="submit" disabled={loading} className="w-full rounded-full bg-[var(--lagoon-deep)] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? "Sending..." : "Send reset code"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-[var(--sea-ink-soft)]">
        Have a code? <Link href="/reset-password" className="font-medium text-[var(--lagoon-deep)] hover:underline">Set a new password</Link>
      </p>
    </AuthShell>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await completePasswordReset({ email, otp, newPassword });
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Set a new password" description="Use the reset code from your email.">
      <StatusMessage error={error} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField id="reset-email" label="Email" type="email" value={email} onChange={setEmail} required />
        <TextField id="reset-otp" label="Reset code" value={otp} onChange={setOtp} required minLength={4} inputMode="numeric" />
        <TextField id="reset-new-password" label="New password" type="password" value={newPassword} onChange={setNewPassword} required minLength={8} />
        <button type="submit" disabled={loading} className="w-full rounded-full bg-[var(--lagoon-deep)] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? "Saving..." : "Save new password"}
        </button>
      </form>
    </AuthShell>
  );
}

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Password changed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Change password" description="Confirm your current password before setting a new one.">
      <StatusMessage message={message} error={error} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField id="current-password" label="Current password" type="password" value={currentPassword} onChange={setCurrentPassword} required />
        <TextField id="new-password" label="New password" type="password" value={newPassword} onChange={setNewPassword} required minLength={8} />
        <button type="submit" disabled={loading} className="w-full rounded-full bg-[var(--lagoon-deep)] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {loading ? "Saving..." : "Change password"}
        </button>
      </form>
    </AuthShell>
  );
}

function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="page-wrap flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-12">
      <div className="island-shell w-full max-w-md rounded-2xl p-8">
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

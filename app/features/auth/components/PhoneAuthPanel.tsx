"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { completePhoneSignup, requestPhoneAuthOtp, verifyPhoneAuthOtp } from "#/features/auth/api";
import { resolveNextPath } from "../redirect";

type Step = "PHONE" | "OTP" | "SIGNUP";

export function PhoneAuthPanel({ nextPath, mode }: { nextPath?: string | null; mode: "login" | "signup" }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("PHONE");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [pendingSignupToken, setPendingSignupToken] = useState("");
  const [resendAvailableAt, setResendAvailableAt] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestOtpMutation = useMutation({ mutationFn: (value: string) => requestPhoneAuthOtp(value) });
  const verifyOtpMutation = useMutation({ mutationFn: (value: { phone: string; otp: string }) => verifyPhoneAuthOtp(value) });
  const completeSignupMutation = useMutation({ mutationFn: (value: Parameters<typeof completePhoneSignup>[0]) => completePhoneSignup(value) });
  const loading = requestOtpMutation.isPending || verifyOtpMutation.isPending || completeSignupMutation.isPending;

  async function handleRequestOtp(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const result = await requestOtpMutation.mutateAsync(phone);
      setResendAvailableAt(result.resendAvailableAt);
      setStep("OTP");
      setMessage("Verification code sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send verification code");
    }
  }

  async function handleVerifyOtp(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const result = await verifyOtpMutation.mutateAsync({ phone, otp });
      if (result.state === "LOGIN_READY") {
        router.push(resolveNextPath(nextPath ?? null));
        return;
      }
      if (result.state === "SIGNUP_REQUIRED" && result.pendingSignupToken) {
        setPhone(result.phone);
        setPendingSignupToken(result.pendingSignupToken);
        setStep("SIGNUP");
        setMessage("Phone verified. Complete your account with email and password.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to verify phone code");
    }
  }

  async function handleCompleteSignup(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await completeSignupMutation.mutateAsync({ phone, pendingSignupToken, email, name, password });
      router.push(resolveNextPath(nextPath ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete signup");
    }
  }

  const resendText = resendAvailableAt ? `You can request another code after ${formatTime(resendAvailableAt)}.` : null;

  return (
    <section className="mb-6 rounded-xl border border-[var(--line)] bg-white/60 p-4">
      <h2 className="text-sm font-semibold text-[var(--sea-ink)]">Continue with phone</h2>
      <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
        {mode === "signup" ? "Verify your phone, then add email and password." : "Sign in with a verified phone number."}
      </p>
      {message ? <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {step === "PHONE" ? (
        <form onSubmit={handleRequestOtp} className="mt-3 space-y-3">
          <div>
            <label htmlFor={`phone-auth-${mode}`} className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">Phone</label>
            <input
              id={`phone-auth-${mode}`}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm text-[var(--sea-ink)] outline-none focus:border-[var(--lagoon-deep)] focus:ring-2 focus:ring-[rgba(79,184,178,0.2)]"
              placeholder="+66812345678"
              inputMode="tel"
              required
            />
          </div>
          <button type="submit" disabled={loading || !phone.trim()} className="w-full rounded-full border border-[var(--lagoon-deep)] px-5 py-2.5 text-sm font-semibold text-[var(--lagoon-deep)] transition disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "Sending code..." : "Send phone code"}
          </button>
        </form>
      ) : null}

      {step === "OTP" ? (
        <form onSubmit={handleVerifyOtp} className="mt-3 space-y-3">
          <div>
            <label htmlFor={`phone-otp-${mode}`} className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">Phone code</label>
            <input
              id={`phone-otp-${mode}`}
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm text-[var(--sea-ink)] outline-none focus:border-[var(--lagoon-deep)] focus:ring-2 focus:ring-[rgba(79,184,178,0.2)]"
              placeholder="123456"
              inputMode="numeric"
              required
            />
            {resendText ? <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">{resendText}</p> : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" disabled={loading || !otp.trim()} className="flex-1 rounded-full bg-[var(--lagoon-deep)] px-5 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? "Verifying..." : "Verify phone code"}
            </button>
            <button type="button" disabled={loading} onClick={() => { setOtp(""); setStep("PHONE"); }} className="flex-1 rounded-full border border-[var(--line)] px-5 py-2.5 text-sm font-semibold text-[var(--sea-ink)] transition disabled:cursor-not-allowed disabled:opacity-50">
              Change phone
            </button>
          </div>
        </form>
      ) : null}

      {step === "SIGNUP" ? (
        <form onSubmit={handleCompleteSignup} className="mt-3 space-y-3">
          <p className="text-xs text-[var(--sea-ink-soft)]">Verified phone: {phone}</p>
          <Field id={`phone-signup-name-${mode}`} label="Name" value={name} onChange={setName} />
          <Field id={`phone-signup-email-${mode}`} label="Email" value={email} onChange={setEmail} type="email" />
          <Field id={`phone-signup-password-${mode}`} label="Password" value={password} onChange={setPassword} type="password" minLength={8} />
          <button type="submit" disabled={loading || !name.trim() || !email.trim() || password.length < 8} className="w-full rounded-full bg-[var(--lagoon-deep)] px-5 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "Creating account..." : "Complete phone signup"}
          </button>
        </form>
      ) : null}
    </section>
  );
}

function Field({
  id,
  label,
  minLength,
  onChange,
  type = "text",
  value,
}: {
  id: string;
  label: string;
  minLength?: number;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]">{label}</label>
      <input
        id={id}
        type={type}
        minLength={minLength}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm text-[var(--sea-ink)] outline-none focus:border-[var(--lagoon-deep)] focus:ring-2 focus:ring-[rgba(79,184,178,0.2)]"
      />
    </div>
  );
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

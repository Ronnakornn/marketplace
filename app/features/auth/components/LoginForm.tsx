"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "#/lib/auth-client";
import { useTranslations } from "#/i18n/client";
import { resolveNextPath } from "../redirect";
import { SocialSignInButtons } from "./SocialSignInButtons";

export function LoginForm({ nextPath }: { nextPath?: string | null }) {
  const t = useTranslations();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? t("auth.signInFailed"));
      } else {
        router.push(resolveNextPath(nextPath ?? null));
      }
    } catch {
      setError(t("auth.unexpectedError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-wrap auth-page flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-12">
      <div className="island-shell auth-card w-full max-w-md rounded-2xl p-8">
        <h1 className="mb-2 text-2xl font-bold text-[var(--sea-ink)]">
          {t("auth.loginTitle")}
        </h1>
        <p className="mb-6 text-sm text-[var(--sea-ink-soft)]">
          {t("auth.loginSubtitle")}
        </p>

        <SocialSignInButtons nextPath={nextPath} />
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]"
            >
              {t("auth.email")}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.emailPlaceholder")}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm text-[var(--sea-ink)] placeholder-[var(--sea-ink-soft)] outline-none focus:border-[var(--lagoon-deep)] focus:ring-2 focus:ring-[rgba(79,184,178,0.2)]"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]"
            >
              {t("auth.password")}
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm text-[var(--sea-ink)] placeholder-[var(--sea-ink-soft)] outline-none focus:border-[var(--lagoon-deep)] focus:ring-2 focus:ring-[rgba(79,184,178,0.2)]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[var(--lagoon-deep)] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? t("auth.signingIn") : t("auth.signIn")}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
          <Link
            href="/forgot-password"
            className="font-medium text-[var(--lagoon-deep)] hover:underline"
          >
            {t("auth.forgotPassword")}
          </Link>
          <Link
            href="/verify-email"
            className="font-medium text-[var(--lagoon-deep)] hover:underline"
          >
            {t("auth.verifyEmail")}
          </Link>
        </div>

        <p className="mt-5 text-center text-sm text-[var(--sea-ink-soft)]">
          {t("auth.noAccount")} {" "}
          <Link
            href="/signup"
            className="font-medium text-[var(--lagoon-deep)] hover:underline"
          >
            {t("auth.signUp")}
          </Link>
        </p>
      </div>
    </div>
  );
}

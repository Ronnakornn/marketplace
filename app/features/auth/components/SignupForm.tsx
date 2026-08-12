"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { signUp } from "#/lib/auth-client";
import { useTranslations } from "#/i18n/client";
import { SocialSignInButtons } from "./SocialSignInButtons";

export function SignupForm({ nextPath }: { nextPath?: string | null }) {
  const t = useTranslations();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const signupMutation = useMutation({ mutationFn: () => signUp.email({ name, email, password }) });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await signupMutation.mutateAsync();
      if (result.error) {
        setError(result.error.message ?? t("auth.signUpFailed"));
      } else {
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
      }
    } catch {
      setError(t("auth.unexpectedError"));
    }
  }

  return (
    <div className="page-wrap auth-page flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-12">
      <div className="island-shell auth-card w-full max-w-md rounded-2xl p-8">
        <h1 className="mb-2 text-2xl font-bold text-[var(--sea-ink)]">
          {t("auth.signupTitle")}
        </h1>
        <p className="mb-6 text-sm text-[var(--sea-ink-soft)]">
          {t("auth.signupSubtitle")}
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
              htmlFor="name"
              className="mb-1.5 block text-sm font-medium text-[var(--sea-ink)]"
            >
              {t("auth.name")}
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("auth.namePlaceholder")}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm text-[var(--sea-ink)] placeholder-[var(--sea-ink-soft)] outline-none focus:border-[var(--lagoon-deep)] focus:ring-2 focus:ring-[rgba(79,184,178,0.2)]"
            />
          </div>

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
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm text-[var(--sea-ink)] placeholder-[var(--sea-ink-soft)] outline-none focus:border-[var(--lagoon-deep)] focus:ring-2 focus:ring-[rgba(79,184,178,0.2)]"
            />
          </div>

          <button
            type="submit"
            disabled={signupMutation.isPending}
            className="w-full rounded-full bg-[var(--lagoon-deep)] px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {signupMutation.isPending ? t("auth.creatingAccount") : t("auth.createAccount")}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-[var(--sea-ink-soft)]">
          {t("auth.hasAccount")} {" "}
          <Link
            href="/login"
            className="font-medium text-[var(--lagoon-deep)] hover:underline"
          >
            {t("auth.signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}

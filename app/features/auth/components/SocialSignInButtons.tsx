"use client";

import { useState, type ComponentType } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { signIn } from "#/lib/auth-client";
import { useTranslations } from "#/i18n/client";
import { getSocialProviderAvailability, type SocialProviderAvailability } from "../api";
import { resolveNextPath } from "../redirect";

type SocialProvider = keyof SocialProviderAvailability;

const PROVIDERS: Array<{ id: SocialProvider; label: string; Icon: ComponentType }> = [
  { id: "google", label: "Google", Icon: GoogleIcon },
  { id: "facebook", label: "Facebook", Icon: FacebookIcon },
];

export function SocialSignInButtons({ nextPath }: { nextPath?: string | null }) {
  const t = useTranslations();
  const [error, setError] = useState<string | null>(null);
  const availabilityQuery = useQuery({
    queryKey: ["auth", "social-provider-availability"],
    queryFn: getSocialProviderAvailability,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const socialMutation = useMutation({
    mutationFn: (provider: SocialProvider) => signIn.social({ provider, callbackURL: resolveNextPath(nextPath ?? null) }),
  });
  const availability = availabilityQuery.data ?? (availabilityQuery.isError ? { google: false, facebook: false } : null);

  if (!availability) return null;

  async function handleSocialSignIn(provider: SocialProvider) {
    setError(null);
    try {
      const result = await socialMutation.mutateAsync(provider);
      if (result?.error) {
        setError(result.error.message ?? t("auth.socialSignInFailed"));
      }
    } catch {
      setError(t("auth.socialSignInFailed"));
    }
  }

  return (
    <div className="mb-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--line)]" />
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          {t("auth.orContinueWith")}
        </span>
        <div className="h-px flex-1 bg-[var(--line)]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {PROVIDERS.map((provider) => {
          const isLoading = socialMutation.isPending && socialMutation.variables === provider.id;
          const isAvailable = availability[provider.id];
          const { Icon } = provider;
          return (
            <button
              key={provider.id}
              type="button"
              disabled={!isAvailable || socialMutation.isPending}
              onClick={() => {
                if (isAvailable) void handleSocialSignIn(provider.id);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-orange-400 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={isAvailable
                ? t("auth.continueWith").replace("{provider}", provider.label)
                : t("auth.providerUnavailable").replace("{provider}", provider.label)}
            >
              <Icon />
              {isLoading ? t("auth.starting").replace("{provider}", provider.label) : provider.label}
            </button>
          );
        })}
      </div>
      {PROVIDERS.some((provider) => !availability[provider.id]) ? (
        <p className="mt-3 text-center text-xs text-slate-500">
          {t("auth.providerSetup")}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function GoogleIcon() {
  return <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.7 4.7 0 0 1-2 3.1v2.5h3.2c1.9-1.7 3.1-4.3 3.1-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.2-2.5c-.9.6-2 .9-3.5.9-2.7 0-5-1.8-5.8-4.3H2.9v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.2 13.7A6 6 0 0 1 6 12c0-.6.1-1.2.2-1.7V7.7H2.9A10 10 0 0 0 2 12c0 1.6.4 3.1.9 4.3l3.3-2.6Z"/><path fill="#EA4335" d="M12 6c1.5 0 2.9.5 4 1.6l3-3A10 10 0 0 0 2.9 7.7l3.3 2.6C7 7.8 9.3 6 12 6Z"/></svg>;
}

function FacebookIcon() {
  return <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24"><path fill="#1877F2" d="M24 12.1C24 5.4 18.6 0 12 0S0 5.4 0 12.1C0 18.2 4.4 23.2 10.1 24v-8.5H7V12h3.1V9.4c0-3.1 1.8-4.8 4.6-4.8 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 1-2 1.9V12h3.4l-.5 3.5h-2.9V24C19.6 23.2 24 18.2 24 12.1Z"/></svg>;
}

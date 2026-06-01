"use client";

import { useEffect, useState } from "react";
import { signIn } from "#/lib/auth-client";
import { getSocialProviderAvailability, type SocialProviderAvailability } from "../api";
import { resolveNextPath } from "../redirect";

type SocialProvider = keyof SocialProviderAvailability;

const PROVIDERS: Array<{ id: SocialProvider; label: string }> = [
  { id: "google", label: "Google" },
  { id: "facebook", label: "Facebook" },
];

export function SocialSignInButtons({ nextPath }: { nextPath?: string | null }) {
  const [availability, setAvailability] = useState<SocialProviderAvailability | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getSocialProviderAvailability()
      .then((data) => {
        if (mounted) setAvailability(data);
      })
      .catch(() => {
        if (mounted) setAvailability({ google: false, facebook: false });
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!availability) return null;

  async function handleSocialSignIn(provider: SocialProvider) {
    setError(null);
    setLoadingProvider(provider);
    try {
      const result = await signIn.social({
        provider,
        callbackURL: resolveNextPath(nextPath ?? null),
      });
      if (result?.error) {
        setError(result.error.message ?? "Social sign in failed");
      }
    } catch {
      setError("Social sign in failed");
    } finally {
      setLoadingProvider(null);
    }
  }

  return (
    <div className="mb-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--line)]" />
        <span className="text-xs font-medium uppercase tracking-normal text-[var(--sea-ink-soft)]">
          or continue with
        </span>
        <div className="h-px flex-1 bg-[var(--line)]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {PROVIDERS.map((provider) => {
          const isLoading = loadingProvider === provider.id;
          const isAvailable = availability[provider.id];
          return (
            <button
              key={provider.id}
              type="button"
              disabled={!isAvailable || loadingProvider !== null}
              onClick={() => {
                if (isAvailable) void handleSocialSignIn(provider.id);
              }}
              className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--sea-ink)] transition hover:-translate-y-0.5 hover:border-[var(--lagoon-deep)] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={isAvailable ? `Continue with ${provider.label}` : `${provider.label} sign-in is not configured`}
            >
              {isLoading ? `Starting ${provider.label}...` : provider.label}
            </button>
          );
        })}
      </div>
      {PROVIDERS.some((provider) => !availability[provider.id]) ? (
        <p className="mt-3 text-center text-xs text-[var(--sea-ink-soft)]">
          Disabled providers need OAuth credentials in the server environment.
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

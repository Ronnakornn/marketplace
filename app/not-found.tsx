import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-8 text-center">
        <h1 className="text-2xl font-bold text-[var(--sea-ink)]">
          Page not found
        </h1>
        <p className="mt-3 text-sm text-[var(--sea-ink-soft)]">
          The page you are looking for does not exist or is unavailable.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] no-underline"
        >
          Back to home
        </Link>
      </section>
    </div>
  );
}

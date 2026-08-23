import { Suspense } from "react";
import { VerifyEmailForm } from "#/features/auth";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="page-wrap auth-page flex min-h-screen items-center justify-center">Loading...</div>}>
      <VerifyEmailForm />
    </Suspense>
  );
}

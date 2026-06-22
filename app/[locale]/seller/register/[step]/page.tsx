import { notFound } from "next/navigation";
import { SellerRegisterPage } from "#/features/seller/components/SellerOnboardingPages";
import { enforceSellerRoute } from "#/lib/seller-route-guard";

const validSteps = ["account", "shop", "kyc", "terms"] as const;
type RegisterStep = (typeof validSteps)[number];

function isRegisterStep(value: string): value is RegisterStep {
  return (validSteps as readonly string[]).includes(value);
}

export default async function Page({ params }: { params: Promise<{ locale: string; step: string }> }) {
  const { locale, step } = await params;
  if (!isRegisterStep(step)) notFound();

  await enforceSellerRoute(`/seller/register/${step}`, locale);

  return <SellerRegisterPage step={step} />;
}

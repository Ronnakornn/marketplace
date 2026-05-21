"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BellIcon, HeartIcon, LinkIcon, MailIcon, MapPinIcon, MessageCircleIcon, PackageIcon, StoreIcon, TicketIcon, UserCircleIcon } from "lucide-react";
import { BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { fetchAddresses, fetchProfile, fetchSellerApplicationSummary } from "#/features/buyer/api";
import { useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";

export function ProfilePage() {
  const localePath = useLocalePath();
  const t = useTranslations();
  const profileQuery = useQuery({ queryKey: ["buyer-profile"], queryFn: fetchProfile });
  const addressesQuery = useQuery({ queryKey: ["buyer-addresses"], queryFn: fetchAddresses });
  const sellerApplicationQuery = useQuery({ queryKey: ["seller", "application"], queryFn: fetchSellerApplicationSummary });
  const defaultAddress = addressesQuery.data?.find((address) => address.isDefault) ?? addressesQuery.data?.[0];

  return (
    <>
      <BuyerTopBar title={t("buyer.profile")} />
      <div className="mx-auto max-w-3xl space-y-4 px-3 py-4">
        {profileQuery.isLoading ? <BuyerLoadingList /> : null}
        {profileQuery.isError ? <BuyerErrorState message={profileQuery.error.message} onRetry={() => void profileQuery.refetch()} /> : null}
        {profileQuery.data ? (
          <>
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  <AvatarImage src={profileQuery.data.image ?? undefined} alt={profileQuery.data.name} />
                  <AvatarFallback><UserCircleIcon className="size-8" /></AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-bold text-slate-950">{profileQuery.data.name}</h1>
                  <p className="mt-1 flex items-center gap-1 text-sm text-slate-500"><MailIcon className="size-4" />{profileQuery.data.email}</p>
                  <div className="mt-2 flex gap-2">
                    <Badge className="rounded-md bg-orange-600">{profileQuery.data.role}</Badge>
                    <Badge variant="outline" className="rounded-md">{profileQuery.data.status}</Badge>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="font-bold">{t("buyer.buyerShortcuts")}</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Button asChild variant="outline" className="justify-start"><Link href={localePath("/orders")}><PackageIcon className="size-4" />{t("buyer.myOrders")}</Link></Button>
                <Button asChild variant="outline" className="justify-start"><Link href={localePath("/chat")}><MessageCircleIcon className="size-4" />Buyer chat</Link></Button>
                <Button asChild variant="outline" className="justify-start"><Link href={localePath("/account/addresses")}><MapPinIcon className="size-4" />{t("buyer.addresses")}</Link></Button>
                <Button asChild variant="outline" className="justify-start"><Link href={localePath("/wishlist")}><HeartIcon className="size-4" />{t("buyer.wishlist")}</Link></Button>
                <Button asChild variant="outline" className="justify-start"><Link href={localePath("/vouchers")}><TicketIcon className="size-4" />{t("buyer.vouchers")}</Link></Button>
                <Button asChild variant="outline" className="justify-start"><Link href={localePath("/affiliates")}><LinkIcon className="size-4" />{t("buyer.affiliates")}</Link></Button>
                <Button asChild variant="outline" className="justify-start"><Link href={localePath("/followed-shops")}><StoreIcon className="size-4" />{t("buyer.followedShops")}</Link></Button>
                <Button asChild variant="outline" className="justify-start"><Link href={localePath("/notifications")}><BellIcon className="size-4" />{t("buyer.notifications")}</Link></Button>
              </div>
            </section>

            <SellerAccountStatusCard
              isLoading={sellerApplicationQuery.isLoading}
              error={sellerApplicationQuery.error}
              onRetry={() => void sellerApplicationQuery.refetch()}
              application={sellerApplicationQuery.data?.application ?? null}
              shop={sellerApplicationQuery.data?.shop ?? null}
            />

            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold">{t("buyer.shippingAddress")}</h2>
                  {addressesQuery.isLoading ? <p className="mt-1 text-sm text-slate-500">{t("buyer.loadingSavedAddresses")}</p> : null}
                  {defaultAddress ? (
                    <>
                      <p className="mt-2 font-semibold text-slate-950">{defaultAddress.recipientName}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {[defaultAddress.line1, defaultAddress.line2, defaultAddress.city, defaultAddress.region, defaultAddress.postalCode, defaultAddress.country].filter(Boolean).join(", ")}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{t("buyer.savedAddressCount").replace("{count}", String(addressesQuery.data?.length ?? 0))}</p>
                    </>
                  ) : !addressesQuery.isLoading ? (
                    <p className="mt-1 text-sm text-slate-500">{t("buyer.noSavedAddress")}</p>
                  ) : null}
                </div>
                <Button asChild className="shrink-0 rounded-full bg-orange-600 hover:bg-orange-700">
                  <Link href={localePath("/account/addresses")}>{defaultAddress ? t("buyer.manage") : t("common.add")}</Link>
                </Button>
              </div>
              {addressesQuery.isError ? <p className="mt-3 text-sm text-red-600">{addressesQuery.error.message}</p> : null}
            </section>
          </>
        ) : null}
      </div>
    </>
  );
}

function SellerAccountStatusCard({
  application,
  error,
  isLoading,
  onRetry,
  shop,
}: {
  application: {
    id: string;
    status: string;
    rejectionReason?: string | null;
    shopName?: string | null;
    shopSlug?: string | null;
  } | null;
  error: Error | null;
  isLoading: boolean;
  onRetry: () => void;
  shop: { id: string; name: string; slug: string; status: string } | null;
}) {
  const localePath = useLocalePath();
  const status = shop?.status === "ACTIVE" ? "ACTIVE_SHOP" : application?.status ?? "NOT_STARTED";
  const title = shop?.status === "ACTIVE"
    ? "Seller account active"
    : application
      ? "Seller application status"
      : "Start selling";
  const description = shop?.status === "ACTIVE"
    ? `${shop.name} is active. Seller tools are available while buyer cart, orders, reviews, returns, and chat remain available.`
    : application?.status === "SUBMITTED"
      ? "Your seller application is waiting for admin review. Buyer shopping tools remain available."
      : application?.status === "REJECTED"
        ? application.rejectionReason ?? "Update your seller application and submit again."
        : "Open a shop without changing your buyer account.";
  const primaryHref = shop?.status === "ACTIVE"
    ? "/seller"
    : application
      ? "/seller/status"
      : "/seller/register";
  const primaryLabel = shop?.status === "ACTIVE"
    ? "Seller dashboard"
    : application
      ? "View seller status"
      : "Start selling";

  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold text-slate-950">{title}</h2>
            <Badge className="rounded-md bg-emerald-700">{status.replaceAll("_", " ")}</Badge>
          </div>
          {isLoading ? <p className="mt-2 text-sm text-slate-600">Loading seller status...</p> : null}
          {error ? (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-red-700">{error.message}</p>
              <Button type="button" size="sm" variant="outline" onClick={onRetry}>Retry</Button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-700">{description}</p>
          )}
          {application?.shopName ? <p className="mt-2 text-xs font-medium text-slate-500">{application.shopName} / {application.shopSlug}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild className="rounded-full bg-emerald-700 hover:bg-emerald-800">
            <Link href={localePath(primaryHref)}><StoreIcon className="size-4" />{primaryLabel}</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full bg-white/70">
            <Link href={localePath("/seller/chat")}><MessageCircleIcon className="size-4" />Seller chat</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

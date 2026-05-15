"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { BellIcon, MailIcon, MapPinIcon, PackageIcon, UserCircleIcon } from "lucide-react";
import { BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { fetchAddresses, fetchProfile } from "#/features/buyer/api";
import { useLocalePath } from "#/i18n/navigation";

export function ProfilePage() {
  const localePath = useLocalePath();
  const profileQuery = useQuery({ queryKey: ["buyer-profile"], queryFn: fetchProfile });
  const addressesQuery = useQuery({ queryKey: ["buyer-addresses"], queryFn: fetchAddresses });
  const defaultAddress = addressesQuery.data?.find((address) => address.isDefault) ?? addressesQuery.data?.[0];

  return (
    <>
      <BuyerTopBar title="Profile" />
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
              <h2 className="font-bold">Buyer shortcuts</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Button asChild variant="outline" className="justify-start"><Link href={localePath("/orders")}><PackageIcon className="size-4" />My orders</Link></Button>
                <Button asChild variant="outline" className="justify-start"><Link href={localePath("/account/addresses")}><MapPinIcon className="size-4" />Addresses</Link></Button>
                <Button asChild variant="outline" className="justify-start"><Link href={localePath("/notifications")}><BellIcon className="size-4" />Notifications</Link></Button>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold">Shipping address</h2>
                  {addressesQuery.isLoading ? <p className="mt-1 text-sm text-slate-500">Loading saved addresses...</p> : null}
                  {defaultAddress ? (
                    <>
                      <p className="mt-2 font-semibold text-slate-950">{defaultAddress.recipientName}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {[defaultAddress.line1, defaultAddress.line2, defaultAddress.city, defaultAddress.region, defaultAddress.postalCode, defaultAddress.country].filter(Boolean).join(", ")}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{addressesQuery.data?.length ?? 0} saved address{addressesQuery.data?.length === 1 ? "" : "es"}</p>
                    </>
                  ) : !addressesQuery.isLoading ? (
                    <p className="mt-1 text-sm text-slate-500">No saved shipping address yet.</p>
                  ) : null}
                </div>
                <Button asChild className="shrink-0 rounded-full bg-orange-600 hover:bg-orange-700">
                  <Link href={localePath("/account/addresses")}>{defaultAddress ? "Manage" : "Add"}</Link>
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

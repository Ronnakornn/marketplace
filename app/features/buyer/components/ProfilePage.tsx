"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MailIcon, PackageIcon, UserCircleIcon } from "lucide-react";
import { BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { fetchProfile } from "#/features/buyer/api";

export function ProfilePage() {
  const profileQuery = useQuery({ queryKey: ["buyer-profile"], queryFn: fetchProfile });

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
                <Button asChild variant="outline" className="justify-start"><Link href="/orders"><PackageIcon className="size-4" />My orders</Link></Button>
                <Button asChild variant="outline" className="justify-start"><Link href="/notifications">Notifications</Link></Button>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "#/components/ui/button";
import { fetchShopFollowStatus, followShop, unfollowShop } from "#/features/buyer/api";
import { useLocalePath } from "#/i18n/navigation";
import { useSession } from "#/lib/auth-client";

export function ShopFollowButton({ shopId }: { shopId: string }) {
  const router = useRouter();
  const localePath = useLocalePath();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const followQuery = useQuery({
    queryKey: ["buyer-shop-follow-status", shopId],
    queryFn: () => fetchShopFollowStatus(shopId),
    enabled: Boolean(session),
  });
  const followMutation = useMutation({
    mutationFn: () => followQuery.data ? unfollowShop(shopId) : followShop(shopId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["buyer-shop-follow-status", shopId] });
      void queryClient.invalidateQueries({ queryKey: ["buyer-followed-shops"] });
    },
  });

  return (
    <Button className="rounded-full bg-orange-600 hover:bg-orange-700" disabled={followMutation.isPending} onClick={() => {
      if (!session) router.push(localePath("/login"));
      else followMutation.mutate();
    }}>
      {followQuery.data ? "Following" : "Follow shop"}
    </Button>
  );
}

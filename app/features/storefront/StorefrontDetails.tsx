"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "#/components/ui/button";
import { fetchShopFollowStatus, followShop, unfollowShop } from "#/features/buyer/api";
import { createChatRoom } from "#/features/chat";
import { trackDiscoveryEvent } from "#/features/tracking";
import { useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";
import { useSession } from "#/lib/auth-client";
import type { PublicStorefrontProfile } from "#server/modules/seller-shop/seller-shop.service.ts";

interface Review { id: string; userName: string; rating: number; comment: string | null; createdAt: string }
interface Feed { items: Review[]; meta: { page: number; pageSize: number; totalCount: number; hasNextPage: boolean } }

async function fetchFeed(shopId: string, page: number): Promise<Feed> {
  const response = await fetch(`/api/shops/${shopId}/reviews/feed?page=${page}&limit=10`);
  if (!response.ok) throw new Error("reviews");
  return response.json() as Promise<Feed>;
}

export function StorefrontDetails({ shop, locale }: { shop: PublicStorefrontProfile; locale: "th" | "en" }) {
  const t = useTranslations();
  const router = useRouter();
  const localePath = useLocalePath();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showAll, setShowAll] = useState(false);
  const feed = useQuery({ queryKey: ["storefront-reviews", shop.id, page], queryFn: () => fetchFeed(shop.id, page) });
  const followStatus = useQuery({ queryKey: ["buyer-shop-follow-status", shop.id], queryFn: () => fetchShopFollowStatus(shop.id), enabled: Boolean(session) && !shop.viewer.isOwner });

  useEffect(() => { trackDiscoveryEvent({ eventType: "shop_viewed", shopId: shop.id, source: "storefront" }); }, [shop.id]);
  useEffect(() => {
    if (!feed.data) return;
    setReviews((current) => [...new Map([...(page === 1 ? [] : current), ...feed.data.items].map((review) => [review.id, review])).values()]);
  }, [feed.data, page]);

  const followMutation = useMutation({ mutationFn: () => followStatus.data ? unfollowShop(shop.id) : followShop(shop.id), onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: ["buyer-shop-follow-status", shop.id] });
    await queryClient.invalidateQueries({ queryKey: ["buyer-followed-shops"] });
    router.refresh();
    if (!followStatus.data) trackDiscoveryEvent({ eventType: "shop_followed", shopId: shop.id, source: "storefront" });
  } });
  const chatMutation = useMutation({ mutationFn: () => createChatRoom({ shopId: shop.id }), onSuccess: (room) => {
    trackDiscoveryEvent({ eventType: "shop_chat_opened", shopId: shop.id, source: "storefront" });
    router.push(localePath(`/chat/${room.roomId}`));
  } });
  const login = () => router.push(localePath(`/login?next=${encodeURIComponent(`/shops/${shop.slug}`)}`));

  return <>
    {!shop.viewer.isOwner ? <section aria-label={t("storefront.buyerActions")} className="flex flex-wrap gap-3">
      <Button disabled={followMutation.isPending} onClick={() => session ? followMutation.mutate() : login()}>{followStatus.data ? t("storefront.following") : t("storefront.follow")}</Button>
      {shop.chatEnabled ? <Button variant="outline" disabled={chatMutation.isPending} onClick={() => session ? chatMutation.mutate() : login()}>{chatMutation.isPending ? t("storefront.chatOpening") : t("storefront.chat")}</Button> : null}
      {followMutation.isError ? <p role="alert" className="w-full text-sm text-red-700">{t("storefront.followError")}</p> : null}
      {chatMutation.isError ? <p role="alert" className="w-full text-sm text-red-700">{t("storefront.chatError")}</p> : null}
    </section> : null}
    <section id="reviews" tabIndex={-1} aria-labelledby="storefront-reviews-title" className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 id="storefront-reviews-title" className="text-xl font-semibold">{t("storefront.latestReviews")}</h2>
      {feed.isLoading && page === 1 ? <p>{t("storefront.reviewsLoading")}</p> : null}
      {feed.isError && page === 1 ? <div><p role="alert">{t("storefront.reviewsError")}</p><Button variant="outline" onClick={() => void feed.refetch()}>{t("storefront.retry")}</Button></div> : null}
      {!feed.isLoading && !feed.isError && reviews.length === 0 ? <p>{t("storefront.reviewsEmpty")}</p> : null}
      <div className="space-y-3">{reviews.slice(0, showAll ? undefined : 3).map((review) => <article key={review.id} className="rounded-lg bg-slate-50 p-4"><div className="flex justify-between gap-3"><strong>{review.userName}</strong><span aria-label={`${review.rating} / 5`}>{"★".repeat(review.rating)}</span></div>{review.comment ? <p className="mt-2 whitespace-pre-line text-sm">{review.comment}</p> : null}<time className="mt-2 block text-xs text-slate-500" dateTime={review.createdAt}>{new Intl.DateTimeFormat(locale).format(new Date(review.createdAt))}</time></article>)}</div>
      {feed.data && feed.data.meta.totalCount > 3 && !showAll ? <Button variant="outline" onClick={() => setShowAll(true)}>{t("storefront.viewAllReviews")}</Button> : null}
      {showAll && feed.data?.meta.hasNextPage ? <Button variant="outline" disabled={feed.isFetching} onClick={() => setPage((value) => value + 1)}>{feed.isFetching ? t("storefront.reviewsLoading") : t("storefront.moreReviews")}</Button> : null}
      {showAll && feed.isError && page > 1 ? <div><p role="alert">{t("storefront.moreReviewsError")}</p><Button variant="outline" onClick={() => void feed.refetch()}>{t("storefront.retry")}</Button></div> : null}
    </section>
    {(shop.shippingPolicy || shop.returnPolicy) ? <section aria-labelledby="storefront-policies-title" className="space-y-3"><h2 id="storefront-policies-title" className="text-xl font-semibold">{t("storefront.policies")}</h2>{shop.shippingPolicy ? <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-semibold">{t("storefront.shippingPolicy")}</summary><p className="mt-3 whitespace-pre-line text-sm text-slate-700">{shop.shippingPolicy}</p></details> : null}{shop.returnPolicy ? <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-semibold">{t("storefront.returnPolicy")}</summary><p className="mt-3 whitespace-pre-line text-sm text-slate-700">{shop.returnPolicy}</p></details> : null}</section> : null}
  </>;
}

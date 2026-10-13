"use client";
import { AdminTable } from "../components/AdminTable";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "#/components/ui/button";
import { useFormatters, useTranslations } from "#/i18n/client";
import { useLocalePath } from "#/i18n/navigation";
import { directoryApi } from "./client";

export function AdminBuyerDetail({ userId }: { userId: string }) {
  const format = useFormatters();
  const t = useTranslations(),
    path = useLocalePath();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin", "buyer-detail", userId, page],
    queryFn: async () => {
      const result = await directoryApi.api.admin.directory
        .users({ userId })
        .get({ query: { page, limit: 20 } });
      if (result.error) throw result.error;
      return result.data;
    },
  });
  if (query.isPending)
    return <p role="status">{t("admin.directory.loading")}</p>;
  if (query.error || !query.data)
    return <p role="alert">{t("admin.directory.failed")}</p>;
  const data = query.data;
  const hasNext =
    Math.max(data.addresses.total, data.orders.total, data.coins.total) >
    page * data.limit;
  return (
    <div className="grid gap-5">
      <section className="admin-panel rounded-xl p-5">
        <h1 className="text-2xl font-semibold">{data.user.name}</h1>
        <dl className="mt-3 grid gap-2 text-sm">
          <div>
            <dt>{t("admin.directory.email")}</dt>
            <dd>{data.user.email}</dd>
          </div>
          <div>
            <dt>{t("admin.directory.phone")}</dt>
            <dd>{data.user.phone ?? "—"}</dd>
          </div>
          <div>
            <dt>{t("admin.directory.status")}</dt>
            <dd>
              {t(`admin.statuses.${data.user.status}`)} ·{" "}
              {t(`admin.directory.roles.${data.user.role}`)}
            </dd>
          </div>
          <div>
            <dt>{t("admin.directory.created")}</dt>
            <dd>{new Date(data.user.createdAt).toLocaleDateString()}</dd>
          </div>
        </dl>
      </section>
      <section className="admin-panel rounded-xl p-5">
        <h2 className="text-lg font-semibold">
          {t("admin.directory.addresses")} ({data.addresses.total})
        </h2>
        <div className="mt-3 grid gap-3">
          {data.addresses.items.map((address) => (
            <address className="rounded border p-3 not-italic" key={address.id}>
              {address.recipientName} · {address.phone}
              <br />
              {[
                address.line1,
                address.line2,
                address.city,
                address.region,
                address.postalCode,
                address.country,
              ]
                .filter(Boolean)
                .join(", ")}
            </address>
          ))}
        </div>
        {!data.addresses.items.length && <p>{t("admin.directory.empty")}</p>}
      </section>
      <section className="admin-panel rounded-xl p-5">
        <h2 className="text-lg font-semibold">
          {t("admin.directory.orders")} ({data.orders.total})
        </h2>
        <div className="mt-3 overflow-x-auto">
          <AdminTable
            hidePagination
            pagination={{
              pageIndex: page - 1,
              pageSize: data.limit,
              totalRows: data.orders.total,
              onPaginationChange: (updater) => {
                const next =
                  typeof updater === "function"
                    ? updater({ pageIndex: page - 1, pageSize: data.limit })
                    : updater;
                setPage(next.pageIndex + 1);
              },
            }}
            data={data.orders.items ?? []}
            columns={[
              {
                id: "order",
                header: t("admin.directory.order"),
                enableSorting: false,
                cell: ({ row: { original: order } }) => (
                  <>
                    <Link
                      className="underline"
                      href={path(`/admin/orders?orderId=${order.id}`)}
                    >
                      {order.orderNumber}
                    </Link>
                  </>
                ),
              },
              {
                id: "status",
                header: t("admin.directory.status"),
                enableSorting: false,
                cell: ({ row: { original: order } }) => (
                  <>{t(`admin.statuses.${order.status}`)}</>
                ),
              },
              {
                id: "amount",
                header: t("admin.directory.amount"),
                enableSorting: false,
                cell: ({ row: { original: order } }) => (
                  <>{format.currency(order.grandTotal, order.currency)}</>
                ),
              },
            ]}
          />
        </div>
        {!data.orders.items.length && <p>{t("admin.directory.empty")}</p>}
      </section>
      <section className="admin-panel rounded-xl p-5">
        <h2 className="text-lg font-semibold">{t("admin.directory.coins")}</h2>
        {data.coins.wallet ? (
          <dl className="mt-3 grid gap-2 sm:grid-cols-3">
            {Object.entries(data.coins.wallet).map(([key, value]) => (
              <div key={key}>
                <dt className="text-sm text-muted-foreground">
                  {t(`admin.directory.${key}`)}
                </dt>
                <dd className="font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>{t("admin.directory.empty")}</p>
        )}
        <ul className="mt-4 grid gap-2">
          {data.coins.items.map((entry) => (
            <li className="border-t py-2 text-sm" key={entry.id}>
              {t(`admin.statuses.${entry.type}`)} · {entry.amount} ·{" "}
              {t(`admin.statuses.${entry.status}`)}
              <p className="text-muted-foreground">{entry.reason}</p>
            </li>
          ))}
        </ul>
      </section>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          {t("admin.directory.previous")}
        </Button>
        <span>{page}</span>
        <Button
          variant="outline"
          disabled={!hasNext}
          onClick={() => setPage(page + 1)}
        >
          {t("admin.directory.next")}
        </Button>
      </div>
    </div>
  );
}

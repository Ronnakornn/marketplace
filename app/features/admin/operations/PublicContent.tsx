import { treaty, type Treaty } from "@elysiajs/eden";
import { cache } from "react";
import type { createPublishedContentRoutes } from "#server/modules/admin-operations/operations.routes.ts";

const contentApi = treaty<ReturnType<typeof createPublishedContentRoutes>>(
  process.env.API_BASE_URL ?? "http://localhost:3001",
  { fetch: { cache: "no-store" } },
);
export const getPublishedContent = cache(
  async (locale: string, slug: string) => {
    const result = await contentApi.api.content
      .pages({ locale })({ slug })
      .get();
    if (result.error) throw result.error;
    return result.data;
  },
);
export type PublishedContent = NonNullable<
  Treaty.Data<
    ReturnType<
      ReturnType<ReturnType<typeof contentApi.api.content.pages>>["get"]
    >
  >
>;

export function PublicContentBody({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <article className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-8 whitespace-pre-wrap text-base leading-8">{body}</p>
    </article>
  );
}

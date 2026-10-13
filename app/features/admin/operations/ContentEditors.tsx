"use client";

import { AdminTable } from "../components/AdminTable";

import { CouponTargetsManager } from "#/features/admin/marketing-targets/CouponTargetsManager";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { useTranslations } from "#/i18n/client";
import {
  operationsApi,
  useOperationQuery,
  useOperationMutation,
  unwrap,
  type BannerInput,
  type BannerRow,
  type ContentInput,
  type ContentRow,
  type TemplateInput,
  type TemplateRow,
} from "./api";
import {
  CheckField,
  EditButton,
  Editor,
  Field,
  OperationsFrame,
  OperationConfirmation,
  SelectField,
  TextField,
  dateInput,
  toDateInput,
} from "./shared";

const blankBanner: BannerInput = {
  placement: "HOME_HERO",
  title: "",
  subtitle: null,
  imageUrl: "",
  mobileImageUrl: null,
  targetUrl: null,
  status: "DRAFT",
  sortOrder: 0,
  startsAt: null,
  endsAt: null,
  popupFrequency: "SESSION",
  titleTh: "",
  titleEn: "",
  bodyTh: "",
  bodyEn: "",
  reason: "",
};
function metaValue(metadata: BannerRow["metadata"], key: string) {
  return metadata && typeof metadata === "object"
    ? (Object.entries(metadata)
        .find(([name, value]) => name === key && typeof value === "string")?.[1]
        ?.toString() ?? "")
    : "";
}
export function AdminMarketing() {
  const t = useTranslations();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(blankBanner);
  const [id, setId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [removing, setRemoving] = useState<BannerRow | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const rows = useOperationQuery(["banners", page], () =>
    operationsApi.marketing.banners.get({ query: { page, limit: 20 } }),
  );
  const save = useOperationMutation((body: BannerInput) =>
    id
      ? operationsApi.marketing.banners({ id }).patch(body)
      : operationsApi.marketing.banners.post(body),
  );
  const remove = useOperationMutation(
    (input: { row: BannerRow; reason: string }) =>
      operationsApi.marketing.banners({ id: input.row.id }).delete({
        expectedUpdatedAt: new Date(input.row.updatedAt).toISOString(),
        reason: input.reason,
      }),
  );
  function edit(row: BannerRow) {
    setEditorOpen(true);
    save.reset();
    const frequency = metaValue(row.metadata, "popupFrequency");
    setId(row.id);
    setForm({
      placement: row.placement,
      title: row.title,
      subtitle: row.subtitle,
      imageUrl: row.imageUrl,
      mobileImageUrl: row.mobileImageUrl,
      targetUrl: row.targetUrl,
      status: row.status,
      sortOrder: row.sortOrder,
      startsAt: row.startsAt ? new Date(row.startsAt).toISOString() : null,
      endsAt: row.endsAt ? new Date(row.endsAt).toISOString() : null,
      expectedUpdatedAt: new Date(row.updatedAt).toISOString(),
      popupFrequency:
        frequency === "DAILY" || frequency === "ALWAYS" ? frequency : "SESSION",
      titleTh: metaValue(row.metadata, "titleTh"),
      titleEn: metaValue(row.metadata, "titleEn"),
      bodyTh: metaValue(row.metadata, "bodyTh"),
      bodyEn: metaValue(row.metadata, "bodyEn"),
      reason: "",
    });
  }
  return (
    <OperationsFrame
      area="marketing"
      loading={rows.isLoading}
      error={save.error ?? remove.error ?? rows.error}
    >
      <Editor
        title={id ? "editBanner" : "createBanner"}
        triggerLabel="createBanner"
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (open) save.reset();
        }}
        error={save.error ?? rows.error}
        busy={save.isPending}
        onCancel={() => {
          setId(null);
          setForm(blankBanner);
        }}
        onSubmit={() =>
          save.mutateAsync(form, {
            onSuccess: () => {
              setEditorOpen(false);
              setId(null);
              setForm(blankBanner);
            },
          })
        }
      >
        <Field
          label="title"
          value={form.title}
          required
          onChange={(value) => setForm({ ...form, title: value })}
        />
        <Field
          label="subtitle"
          value={form.subtitle ?? ""}
          onChange={(value) => setForm({ ...form, subtitle: value || null })}
        />
        <SelectField
          label="placement"
          value={form.placement}
          values={[
            "HOME_HERO",
            "HOME_POPUP",
            "HOME_HIGHLIGHT",
            "CATEGORY_HERO",
            "SEARCH_TOP",
          ]}
          onChange={(value) => setForm({ ...form, placement: value })}
        />
        <SelectField
          label="status"
          value={form.status}
          values={["DRAFT", "SCHEDULED", "PUBLISHED", "PAUSED", "ARCHIVED"]}
          onChange={(value) => setForm({ ...form, status: value })}
        />
        <Field
          label="imageUrl"
          value={form.imageUrl}
          required
          onChange={(value) => setForm({ ...form, imageUrl: value })}
        />
        <Field
          label="mobileImageUrl"
          value={form.mobileImageUrl ?? ""}
          onChange={(value) =>
            setForm({ ...form, mobileImageUrl: value || null })
          }
        />
        <Field
          label="targetUrl"
          value={form.targetUrl ?? ""}
          onChange={(value) => setForm({ ...form, targetUrl: value || null })}
        />
        <Field
          label="sortOrder"
          type="number"
          value={form.sortOrder}
          onChange={(value) => setForm({ ...form, sortOrder: Number(value) })}
        />
        <Field
          label="startsAt"
          type="datetime-local"
          value={toDateInput(form.startsAt)}
          onChange={(value) => setForm({ ...form, startsAt: dateInput(value) })}
        />
        <Field
          label="endsAt"
          type="datetime-local"
          value={toDateInput(form.endsAt)}
          onChange={(value) => setForm({ ...form, endsAt: dateInput(value) })}
        />
        <SelectField
          label="popupFrequency"
          value={form.popupFrequency}
          values={["SESSION", "DAILY", "ALWAYS"]}
          onChange={(value) => setForm({ ...form, popupFrequency: value })}
        />
        <Field
          label="titleTh"
          value={form.titleTh}
          onChange={(value) => setForm({ ...form, titleTh: value })}
        />
        <Field
          label="titleEn"
          value={form.titleEn}
          onChange={(value) => setForm({ ...form, titleEn: value })}
        />
        <TextField
          label="bodyTh"
          value={form.bodyTh}
          onChange={(value) => setForm({ ...form, bodyTh: value })}
        />
        <TextField
          label="bodyEn"
          value={form.bodyEn}
          onChange={(value) => setForm({ ...form, bodyEn: value })}
        />
        <Field
          label="reason"
          value={form.reason}
          required
          onChange={(value) => setForm({ ...form, reason: value })}
        />
        <section className="rounded-lg border bg-muted/30 p-4 sm:col-span-2">
          <h2 className="text-lg font-medium">
            {t("admin.operations.preview")}
          </h2>
          <h3 className="mt-3 font-medium">{form.title}</h3>
          <p className="whitespace-pre-wrap text-sm">
            {form.bodyTh || form.bodyEn || form.subtitle}
          </p>
          {form.targetUrl ? (
            <p className="mt-3 break-all text-sm text-muted-foreground">
              {form.targetUrl}
            </p>
          ) : null}
        </section>
      </Editor>
      <AdminTable
        isLoading={rows.isLoading}
        data={rows.data?.items ?? []}
        columns={[
          {
            id: "title",
            header: t("admin.operations.fields.title"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => <>{row.title}</>,
          },
          {
            id: "placement",
            header: t("admin.operations.fields.placement"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => (
              <>{t(`admin.operations.values.${row.placement}`)}</>
            ),
          },
          {
            id: "status",
            header: t("admin.operations.fields.status"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => (
              <>{t(`admin.operations.values.${row.status}`)}</>
            ),
          },
          {
            id: "activeNow",
            header: t("admin.operations.fields.activeNow"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => (
              <>
                {t(
                  row.activeNow
                    ? "admin.operations.yes"
                    : "admin.operations.no",
                )}
              </>
            ),
          },
          {
            id: "actions",
            header: t("admin.operations.fields.actions"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => (
              <>
                <div className="flex gap-2">
                  <EditButton onClick={() => edit(row)} />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={remove.isPending}
                    onClick={() => {
                      remove.reset();
                      setRemoveReason("");
                      setRemoving(row);
                    }}
                  >
                    {t("admin.operations.delete")}
                  </Button>
                </div>
              </>
            ),
          },
        ]}
        pagination={{
          pageIndex: page - 1,
          pageSize: 20,
          totalRows: rows.data?.total ?? 0,
          onPaginationChange: (updater) => {
            const next =
              typeof updater === "function"
                ? updater({ pageIndex: page - 1, pageSize: 20 })
                : updater;
            setPage(next.pageIndex + 1);
          },
        }}
      />
      <OperationConfirmation
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title="delete"
        target={removing?.title ?? ""}
        reason={removeReason}
        onReasonChange={setRemoveReason}
        busy={remove.isPending}
        error={remove.error}
        destructive
        onConfirm={() => {
          if (removing)
            remove.mutate(
              { row: removing, reason: removeReason },
              { onSuccess: () => setRemoving(null) },
            );
        }}
      />
      <CouponTargetsManager />
    </OperationsFrame>
  );
}

const blankContent: ContentInput = {
  slug: "",
  locale: "th",
  title: "",
  draftBody: "",
  reason: "",
};
export function AdminContent() {
  const t = useTranslations();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(blankContent);
  const [editing, setEditing] = useState<ContentRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [publication, setPublication] = useState<{
    row: ContentRow;
    unpublish: boolean;
  } | null>(null);
  const [publishReason, setPublishReason] = useState("");
  const rows = useOperationQuery(["content", page], () =>
    operationsApi.content.pages.get({ query: { page, limit: 20 } }),
  );
  const save = useOperationMutation((body: ContentInput) =>
    editing
      ? operationsApi.content.pages({ id: editing.id }).patch(body)
      : operationsApi.content.pages.post(body),
  );
  const publish = useOperationMutation(
    (input: { row: ContentRow; unpublish: boolean; reason: string }) =>
      input.unpublish
        ? operationsApi.content.pages({ id: input.row.id }).unpublish.post({
            expectedVersion: input.row.version,
            reason: input.reason,
          })
        : operationsApi.content.pages({ id: input.row.id }).publish.post({
            expectedVersion: input.row.version,
            reason: input.reason,
          }),
  );
  function edit(row: ContentRow) {
    setEditorOpen(true);
    save.reset();
    setEditing(row);
    setForm({
      slug: row.slug,
      locale: row.locale,
      title: row.title,
      draftBody: row.draftBody,
      expectedVersion: row.version,
      reason: "",
    });
  }
  return (
    <OperationsFrame
      area="content"
      loading={rows.isLoading}
      error={save.error ?? publish.error ?? rows.error}
    >
      <Editor
        title={editing ? "editContent" : "createContent"}
        triggerLabel="createContent"
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (open) save.reset();
        }}
        error={save.error ?? rows.error}
        busy={save.isPending}
        onCancel={() => {
          setEditing(null);
          setForm(blankContent);
        }}
        onSubmit={() =>
          save.mutateAsync(form, {
            onSuccess: () => {
              setEditorOpen(false);
              setEditing(null);
              setForm(blankContent);
            },
          })
        }
      >
        <Field
          label="slug"
          value={form.slug}
          required
          onChange={(value) => setForm({ ...form, slug: value })}
        />
        <SelectField
          label="locale"
          value={form.locale === "en" ? "en" : "th"}
          values={["th", "en"]}
          onChange={(value) => setForm({ ...form, locale: value })}
        />
        <Field
          label="title"
          value={form.title}
          required
          onChange={(value) => setForm({ ...form, title: value })}
        />
        <Field
          label="reason"
          value={form.reason}
          required
          onChange={(value) => setForm({ ...form, reason: value })}
        />
        <div className="sm:col-span-2">
          <TextField
            label="draftBody"
            value={form.draftBody}
            rows={12}
            onChange={(value) => setForm({ ...form, draftBody: value })}
          />
        </div>
        <section className="rounded-lg border bg-muted/30 p-4 sm:col-span-2">
          <h2 className="text-lg font-medium">
            {t("admin.operations.preview")}
          </h2>
          <h3 className="mt-4 text-xl font-medium">{form.title}</h3>
          <p className="mt-4 whitespace-pre-wrap">{form.draftBody}</p>
        </section>
      </Editor>
      <AdminTable
        isLoading={rows.isLoading}
        data={rows.data?.items ?? []}
        columns={[
          {
            id: "title",
            header: t("admin.operations.fields.title"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => <>{row.title}</>,
          },
          {
            id: "slug",
            header: t("admin.operations.fields.slug"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => <>{row.slug}</>,
          },
          {
            id: "locale",
            header: t("admin.operations.fields.locale"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => <>{row.locale}</>,
          },
          {
            id: "publishedAt",
            header: t("admin.operations.fields.publishedAt"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => (
              <>
                {row.publishedAt
                  ? new Date(row.publishedAt).toLocaleString()
                  : t("admin.operations.values.DRAFT")}
              </>
            ),
          },
          {
            id: "actions",
            header: t("admin.operations.fields.actions"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => (
              <>
                <div className="flex flex-wrap gap-2">
                  <EditButton onClick={() => edit(row)} />
                  <Button
                    size="sm"
                    disabled={publish.isPending}
                    onClick={() => {
                      publish.reset();
                      setPublishReason("");
                      setPublication({ row, unpublish: false });
                    }}
                  >
                    {t("admin.operations.publish")}
                  </Button>
                  {row.publishedAt ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={publish.isPending}
                      onClick={() => {
                        publish.reset();
                        setPublishReason("");
                        setPublication({ row, unpublish: true });
                      }}
                    >
                      {t("admin.operations.unpublish")}
                    </Button>
                  ) : null}
                </div>
              </>
            ),
          },
        ]}
        pagination={{
          pageIndex: page - 1,
          pageSize: 20,
          totalRows: rows.data?.total ?? 0,
          onPaginationChange: (updater) => {
            const next =
              typeof updater === "function"
                ? updater({ pageIndex: page - 1, pageSize: 20 })
                : updater;
            setPage(next.pageIndex + 1);
          },
        }}
      />
      <OperationConfirmation
        open={publication !== null}
        onOpenChange={(open) => {
          if (!open) setPublication(null);
        }}
        title={publication?.unpublish ? "unpublish" : "publish"}
        target={publication?.row.title ?? ""}
        reason={publishReason}
        onReasonChange={setPublishReason}
        busy={publish.isPending}
        error={publish.error}
        onConfirm={() => {
          if (publication)
            publish.mutate(
              { ...publication, reason: publishReason },
              { onSuccess: () => setPublication(null) },
            );
        }}
      />
    </OperationsFrame>
  );
}

const blankTemplate: TemplateInput = {
  key: "",
  channel: "IN_APP",
  locale: "th",
  subject: null,
  body: "",
  isActive: true,
  reason: "",
};
export function AdminTemplates() {
  const t = useTranslations();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(blankTemplate);
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [removing, setRemoving] = useState<TemplateRow | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [preview, setPreview] =
    useState<
      Awaited<ReturnType<typeof operationsApi.templates.preview.post>>["data"]
    >(null);
  const [previewError, setPreviewError] = useState<unknown>(null);
  const rows = useOperationQuery(["templates", page], () =>
    operationsApi.templates.get({ query: { page, limit: 20 } }),
  );
  const save = useOperationMutation((body: TemplateInput) =>
    editing
      ? operationsApi.templates({ id: editing.id }).patch(body)
      : operationsApi.templates.post(body),
  );
  const remove = useOperationMutation(
    (input: { row: TemplateRow; reason: string }) =>
      operationsApi.templates({ id: input.row.id }).delete({
        expectedUpdatedAt: new Date(input.row.updatedAt).toISOString(),
        reason: input.reason,
      }),
  );
  function edit(row: TemplateRow) {
    setEditorOpen(true);
    save.reset();
    setPreview(null);
    setPreviewError(null);
    setEditing(row);
    setForm({
      key: row.key,
      channel: row.channel,
      locale: row.locale,
      subject: row.subject,
      body: row.body,
      isActive: row.isActive,
      expectedUpdatedAt: new Date(row.updatedAt).toISOString(),
      reason: "",
    });
  }
  return (
    <OperationsFrame
      area="templates"
      loading={rows.isLoading}
      error={save.error ?? remove.error ?? previewError ?? rows.error}
    >
      <Editor
        title={editing ? "editTemplate" : "createTemplate"}
        triggerLabel="createTemplate"
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (open) save.reset();
        }}
        error={save.error ?? previewError ?? rows.error}
        busy={save.isPending}
        onCancel={() => {
          setEditing(null);
          setForm(blankTemplate);
          setPreview(null);
          setPreviewError(null);
        }}
        onSubmit={() =>
          save.mutateAsync(form, {
            onSuccess: () => {
              setEditorOpen(false);
              setEditing(null);
              setForm(blankTemplate);
            },
          })
        }
      >
        <Field
          label="key"
          value={form.key}
          required
          onChange={(value) => setForm({ ...form, key: value })}
        />
        <SelectField
          label="channel"
          value={form.channel}
          values={["IN_APP", "EMAIL", "SMS", "LINE", "PUSH"]}
          onChange={(value) => setForm({ ...form, channel: value })}
        />
        <SelectField
          label="locale"
          value={form.locale === "en" ? "en" : "th"}
          values={["th", "en"]}
          onChange={(value) => setForm({ ...form, locale: value })}
        />
        <Field
          label="subject"
          value={form.subject ?? ""}
          onChange={(value) => setForm({ ...form, subject: value || null })}
        />
        <CheckField
          label="active"
          checked={form.isActive}
          onChange={(value) => setForm({ ...form, isActive: value })}
        />
        <Field
          label="reason"
          value={form.reason}
          required
          onChange={(value) => setForm({ ...form, reason: value })}
        />
        <div className="sm:col-span-2">
          <TextField
            label="body"
            value={form.body}
            rows={8}
            onChange={(value) => setForm({ ...form, body: value })}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            try {
              setPreviewError(null);
              setPreview(
                unwrap(
                  await operationsApi.templates.preview.post({
                    subject: form.subject ?? "",
                    body: form.body,
                    values: {},
                  }),
                ),
              );
            } catch (error) {
              setPreviewError(error);
            }
          }}
        >
          {t("admin.operations.preview")}
        </Button>
        {preview ? (
          <section className="rounded-lg border bg-muted/30 p-4 sm:col-span-2">
            <h2 className="text-lg font-medium">{preview.subject}</h2>
            <p className="mt-4 whitespace-pre-wrap">{preview.body}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              {t("admin.operations.allowedVariables")}:{" "}
              {preview.allowedVariables.join(", ")}
            </p>
          </section>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("admin.operations.templateHelp")}
          </p>
        )}
      </Editor>
      <AdminTable
        isLoading={rows.isLoading}
        data={rows.data?.items ?? []}
        columns={[
          {
            id: "key",
            header: t("admin.operations.fields.key"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => <>{row.key}</>,
          },
          {
            id: "channel",
            header: t("admin.operations.fields.channel"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => (
              <>{t(`admin.operations.values.${row.channel}`)}</>
            ),
          },
          {
            id: "locale",
            header: t("admin.operations.fields.locale"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => <>{row.locale}</>,
          },
          {
            id: "active",
            header: t("admin.operations.fields.active"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => (
              <>
                {t(
                  row.isActive ? "admin.operations.yes" : "admin.operations.no",
                )}
              </>
            ),
          },
          {
            id: "actions",
            header: t("admin.operations.fields.actions"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => (
              <>
                <div className="flex gap-2">
                  <EditButton onClick={() => edit(row)} />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={remove.isPending}
                    onClick={() => {
                      remove.reset();
                      setRemoveReason("");
                      setRemoving(row);
                    }}
                  >
                    {t("admin.operations.delete")}
                  </Button>
                </div>
              </>
            ),
          },
        ]}
        pagination={{
          pageIndex: page - 1,
          pageSize: 20,
          totalRows: rows.data?.total ?? 0,
          onPaginationChange: (updater) => {
            const next =
              typeof updater === "function"
                ? updater({ pageIndex: page - 1, pageSize: 20 })
                : updater;
            setPage(next.pageIndex + 1);
          },
        }}
      />
      <OperationConfirmation
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title="delete"
        target={removing?.key ?? ""}
        reason={removeReason}
        onReasonChange={setRemoveReason}
        busy={remove.isPending}
        error={remove.error}
        destructive
        onConfirm={() => {
          if (removing)
            remove.mutate(
              { row: removing, reason: removeReason },
              { onSuccess: () => setRemoving(null) },
            );
        }}
      />
    </OperationsFrame>
  );
}

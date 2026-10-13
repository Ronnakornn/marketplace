"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { AdminTable } from "./AdminTable";

import { useState } from "react";
import { MessageSquareWarningIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "#/components/ui/alert-dialog";
import { Button } from "#/components/ui/button";
import { CardContent } from "#/components/ui/card";
import { Label } from "#/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";

import { Textarea } from "#/components/ui/textarea";
import { useTranslations } from "#/i18n/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { AdminDataShell } from "./AdminDataShell";
import { AdminStatusBadge } from "./AdminStatusBadge";

import {
  PAGE_SIZE,
  type AdminModerationAnswer,
  type AdminModerationQuestion,
  type AdminModerationReview,
  type AdminModerationReviewReport,
  useAdminModerationAnswersList,
  useAdminModerationQuestionsList,
  useAdminModerationReviewReportsList,
  useAdminModerationReviewsList,
  useUpdateModerationAnswerStatus,
  useUpdateModerationQuestionStatus,
  useUpdateModerationReviewReportStatus,
  useUpdateModerationReviewStatus,
} from "../hooks/useAdminOperations";

type QueueKey = "reviews" | "reports" | "questions" | "answers";
type ActionTarget =
  | {
      queue: "reviews";
      id: string;
      title: string;
      status: string;
      requiresNote: boolean;
    }
  | {
      queue: "reports";
      id: string;
      title: string;
      status: string;
      requiresNote: boolean;
    }
  | {
      queue: "questions";
      id: string;
      title: string;
      status: string;
      requiresNote: boolean;
    }
  | {
      queue: "answers";
      id: string;
      title: string;
      status: string;
      requiresNote: boolean;
    };

const REVIEW_STATUSES = ["PENDING", "PUBLISHED", "REJECTED", "HIDDEN"] as const;
const REPORT_STATUSES = ["OPEN", "UNDER_REVIEW", "RESOLVED_REMOVED", "RESOLVED_DISMISSED"] as const;
const QUESTION_STATUSES = ["PENDING", "PUBLISHED", "HIDDEN"] as const;
const ANSWER_STATUSES = ["PENDING", "PUBLISHED", "HIDDEN"] as const;

const QUEUES: QueueKey[] = ["reviews", "reports", "questions", "answers"];

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function readErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as {
      value?: { error?: { message?: string } };
      error?: { message?: string };
      message?: string;
    };
    return record.value?.error?.message ?? record.error?.message ?? record.message ?? fallback;
  }
  return fallback;
}

function FilterSelect(props: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  const t = useTranslations();
  return (
    <Select
      value={props.value || "ALL"}
      onValueChange={(value) => props.onChange(value === "ALL" ? "" : value)}
    >
      <SelectTrigger className="h-10 w-full border-border bg-muted/40 text-foreground md:w-52">
        <SelectValue placeholder={t("admin.status")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">{t("admin.common.allStatuses")}</SelectItem>
        {props.options.map((option) => (
          <SelectItem key={option} value={option}>
            {t(`admin.statuses.${option}` as Parameters<typeof t>[0]) === `admin.statuses.${option}`
              ? option.replaceAll("_", " ")
              : t(`admin.statuses.${option}` as Parameters<typeof t>[0])}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StatusActions(props: {
  currentStatus: string;
  options: readonly string[];
  onSelect: (status: string) => void;
  disabled: boolean;
}) {
  const t = useTranslations();
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {props.options
        .filter((status) => status !== props.currentStatus)
        .map((status) => (
          <Button
            key={status}
            size="sm"
            variant="outline"
            className="border-border bg-background text-foreground hover:bg-background hover:text-foreground"
            disabled={props.disabled}
            onClick={() => props.onSelect(status)}
          >
            {t(`admin.statuses.${status}` as Parameters<typeof t>[0]) === `admin.statuses.${status}`
              ? status.replaceAll("_", " ")
              : t(`admin.statuses.${status}` as Parameters<typeof t>[0])}
          </Button>
        ))}
    </div>
  );
}

function needsReviewNote(status: string) {
  return status === "REJECTED" || status === "HIDDEN";
}

function needsReportNote(status: string) {
  return status === "RESOLVED_DISMISSED";
}

function needsQuestionNote(status: string) {
  return status === "HIDDEN";
}

function needsAnswerNote(status: string) {
  return status === "HIDDEN";
}

export function AdminContentModerationQueues() {
  const t = useTranslations();
  const [activeQueue, setActiveQueue] = useState<QueueKey>("reviews");
  const [page, setPage] = useState<Record<QueueKey, number>>({
    reviews: 1,
    reports: 1,
    questions: 1,
    answers: 1,
  });
  const [status, setStatus] = useState<Record<QueueKey, string>>({
    reviews: "PENDING",
    reports: "OPEN",
    questions: "PENDING",
    answers: "PENDING",
  });
  const [search, setSearch] = useState("");
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const commonFilters = {
    page: page[activeQueue],
    limit: PAGE_SIZE,
    status: status[activeQueue],
    q: search,
  };
  const reviewsQuery = useAdminModerationReviewsList(
    activeQueue === "reviews"
      ? commonFilters
      : { page: page.reviews, limit: PAGE_SIZE, status: status.reviews },
  );
  const reportsQuery = useAdminModerationReviewReportsList(
    activeQueue === "reports"
      ? commonFilters
      : { page: page.reports, limit: PAGE_SIZE, status: status.reports },
  );
  const questionsQuery = useAdminModerationQuestionsList(
    activeQueue === "questions"
      ? commonFilters
      : { page: page.questions, limit: PAGE_SIZE, status: status.questions },
  );
  const answersQuery = useAdminModerationAnswersList(
    activeQueue === "answers"
      ? commonFilters
      : { page: page.answers, limit: PAGE_SIZE, status: status.answers },
  );

  const updateReview = useUpdateModerationReviewStatus();
  const updateReport = useUpdateModerationReviewReportStatus();
  const updateQuestion = useUpdateModerationQuestionStatus();
  const updateAnswer = useUpdateModerationAnswerStatus();
  const mutationError =
    updateReview.error ?? updateReport.error ?? updateQuestion.error ?? updateAnswer.error;
  const isMutating =
    updateReview.isPending || updateReport.isPending || updateQuestion.isPending || updateAnswer.isPending;
  const isNoteMissing = Boolean(actionTarget?.requiresNote && note.trim().length === 0);

  const reviews = reviewsQuery.data?.items ?? [];
  const reports = reportsQuery.data?.items ?? [];
  const questions = questionsQuery.data?.items ?? [];
  const answers = answersQuery.data?.items ?? [];

  const activeQuery =
    activeQueue === "reviews"
      ? reviewsQuery
      : activeQueue === "reports"
        ? reportsQuery
        : activeQueue === "questions"
          ? questionsQuery
          : answersQuery;
  const activeStatuses =
    activeQueue === "reviews"
      ? REVIEW_STATUSES
      : activeQueue === "reports"
        ? REPORT_STATUSES
        : activeQueue === "questions"
          ? QUESTION_STATUSES
          : ANSWER_STATUSES;

  function setActiveStatus(nextStatus: string) {
    setStatus((current) => ({ ...current, [activeQueue]: nextStatus }));
    setPage((current) => ({ ...current, [activeQueue]: 1 }));
  }

  function openAction(target: ActionTarget) {
    setActionTarget(target);
    setNote("");
  }

  function submitAction() {
    if (!actionTarget || isNoteMissing) return;
    const payload = {
      id: actionTarget.id,
      status: actionTarget.status,
      note: note.trim() || undefined,
    };
    const options = {
      onSuccess: () => {
        setMessage(t("admin.workspace.updatedStatus").replace("{title}", actionTarget.title).replace("{status}", t(`admin.statuses.${actionTarget.status}`)));
        setActionTarget(null);
        setNote("");
      },
    };
    if (actionTarget.queue === "reviews") updateReview.mutate(payload, options);
    if (actionTarget.queue === "reports") updateReport.mutate(payload, options);
    if (actionTarget.queue === "questions") updateQuestion.mutate(payload, options);
    if (actionTarget.queue === "answers") updateAnswer.mutate(payload, options);
  }

  const reviewsColumns: ColumnDef<AdminModerationReview>[] = [
    {
      id: "review",
      header: t("admin.ui.review"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div className="max-w-md px-5 py-4">
            <p className="font-medium text-foreground">
              {t("admin.contentModeration.reviewSummary")
                .replace("{rating}", String(item.rating))
                .replace("{count}", String(item.reportCount))}
            </p>
            <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
              {item.body ?? t("admin.contentModeration.noReviewBody")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {item.orderItem.productTitle} · {item.orderItem.variantTitle}
            </p>
          </div>
        );
      },
    },
    {
      id: "product",
      header: t("admin.ui.product"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <p className="text-sm text-foreground">{item.product.title}</p>
            <p className="text-xs text-muted-foreground">{item.shop.name}</p>
          </div>
        );
      },
    },
    {
      id: "author",
      header: t("admin.ui.author"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <p className="text-sm text-foreground">{item.user.name}</p>
            <p className="text-xs text-muted-foreground">{item.user.email}</p>
          </div>
        );
      },
    },
    {
      id: "status",
      header: t("admin.ui.status"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <AdminStatusBadge status={item.status} />
          </div>
        );
      },
    },
    {
      id: "created",
      header: t("admin.ui.created"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return <div className="text-sm text-muted-foreground">{formatDate(item.createdAt)}</div>;
      },
    },
    {
      id: "actions",
      header: t("admin.ui.actions"),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <StatusActions
              currentStatus={item.status}
              options={REVIEW_STATUSES}
              disabled={isMutating}
              onSelect={(next) =>
                openAction({
                  queue: "reviews",
                  id: item.id,
                  title: item.product.title,
                  status: next,
                  requiresNote: needsReviewNote(next),
                })
              }
            />
          </div>
        );
      },
    },
  ];

  const reportsColumns: ColumnDef<AdminModerationReviewReport>[] = [
    {
      id: "report",
      header: t("admin.ui.report"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div className="max-w-md px-5 py-4">
            <p className="font-medium text-foreground">{item.reason}</p>
            <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
              {item.detail ?? t("admin.contentModeration.noDetail")}
            </p>
          </div>
        );
      },
    },
    {
      id: "review",
      header: t("admin.ui.review"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <p className="text-sm text-foreground">
              {item.review?.product.title ?? t("admin.contentModeration.reviewRemoved")}
            </p>
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {item.review?.body ?? t("admin.contentModeration.noReviewBody")}
            </p>
          </div>
        );
      },
    },
    {
      id: "reporter",
      header: t("admin.ui.reporter"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <p className="text-sm text-foreground">{item.reportedBy.name}</p>
            <p className="text-xs text-muted-foreground">{item.reportedBy.email}</p>
          </div>
        );
      },
    },
    {
      id: "status",
      header: t("admin.ui.status"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <AdminStatusBadge status={item.status} />
          </div>
        );
      },
    },
    {
      id: "created",
      header: t("admin.ui.created"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return <div className="text-sm text-muted-foreground">{formatDate(item.createdAt)}</div>;
      },
    },
    {
      id: "actions",
      header: t("admin.ui.actions"),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <StatusActions
              currentStatus={item.status}
              options={REPORT_STATUSES}
              disabled={isMutating}
              onSelect={(next) =>
                openAction({
                  queue: "reports",
                  id: item.id,
                  title: item.review?.product.title ?? t("admin.contentModeration.reviewReport"),
                  status: next,
                  requiresNote: needsReportNote(next),
                })
              }
            />
          </div>
        );
      },
    },
  ];

  const questionsColumns: ColumnDef<AdminModerationQuestion>[] = [
    {
      id: "question",
      header: t("admin.ui.question"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div className="max-w-md px-5 py-4">
            <p className="line-clamp-3 font-medium text-foreground">{item.question}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("admin.contentModeration.answerCount").replace("{count}", String(item.answerCount))}
            </p>
          </div>
        );
      },
    },
    {
      id: "product",
      header: t("admin.ui.product"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <p className="text-sm text-foreground">{item.product.title}</p>
            <p className="text-xs text-muted-foreground">{item.shop.name}</p>
          </div>
        );
      },
    },
    {
      id: "author",
      header: t("admin.ui.author"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <p className="text-sm text-foreground">{item.user.name}</p>
            <p className="text-xs text-muted-foreground">{item.user.email}</p>
          </div>
        );
      },
    },
    {
      id: "status",
      header: t("admin.ui.status"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <AdminStatusBadge status={item.status} />
          </div>
        );
      },
    },
    {
      id: "created",
      header: t("admin.ui.created"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return <div className="text-sm text-muted-foreground">{formatDate(item.createdAt)}</div>;
      },
    },
    {
      id: "actions",
      header: t("admin.ui.actions"),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <StatusActions
              currentStatus={item.status}
              options={QUESTION_STATUSES}
              disabled={isMutating}
              onSelect={(next) =>
                openAction({
                  queue: "questions",
                  id: item.id,
                  title: item.product.title,
                  status: next,
                  requiresNote: needsQuestionNote(next),
                })
              }
            />
          </div>
        );
      },
    },
  ];

  const answersColumns: ColumnDef<AdminModerationAnswer>[] = [
    {
      id: "answer",
      header: t("admin.ui.answer"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div className="max-w-md px-5 py-4">
            <p className="line-clamp-3 font-medium text-foreground">{item.answer}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {item.question.product.title} · {item.question.shop.name}
            </p>
          </div>
        );
      },
    },
    {
      id: "question",
      header: t("admin.ui.question"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <p className="line-clamp-2 text-sm text-foreground">{item.question.question}</p>
            <p className="text-xs text-muted-foreground">
              {t("admin.contentModeration.askedBy").replace("{email}", item.question.user.email)}
            </p>
          </div>
        );
      },
    },
    {
      id: "author",
      header: t("admin.ui.author"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <p className="text-sm text-foreground">{item.user.name}</p>
            <p className="text-xs text-muted-foreground">{item.user.email}</p>
          </div>
        );
      },
    },
    {
      id: "status",
      header: t("admin.ui.status"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <AdminStatusBadge status={item.status} />
          </div>
        );
      },
    },
    {
      id: "created",
      header: t("admin.ui.created"),
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;

        return <div className="text-sm text-muted-foreground">{formatDate(item.createdAt)}</div>;
      },
    },
    {
      id: "actions",
      header: t("admin.ui.actions"),
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div>
            <StatusActions
              currentStatus={item.status}
              options={ANSWER_STATUSES}
              disabled={isMutating}
              onSelect={(next) =>
                openAction({
                  queue: "answers",
                  id: item.id,
                  title: item.question.product.title,
                  status: next,
                  requiresNote: needsAnswerNote(next),
                })
              }
            />
          </div>
        );
      },
    },
  ];

  return (
    <AdminDataShell
      title={t("admin.pages.contentModeration.title")}
      description={t("admin.pages.contentModeration.description")}
      icon={MessageSquareWarningIcon}
      search={search}
      searchPlaceholder={t("admin.search.content")}
      onSearchChange={(value) => {
        setSearch(value);
        setPage({ reviews: 1, reports: 1, questions: 1, answers: 1 });
      }}
      isLoading={activeQuery.isLoading}
      error={activeQuery.error}
      onRetry={() => void activeQuery.refetch()}
      filters={
        <FilterSelect value={status[activeQueue]} onChange={setActiveStatus} options={activeStatuses} />
      }
    >
      <CardContent className="p-0">
        {message ? (
          <div className="border-b border-emerald-300/20 bg-emerald-300/10 px-5 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            {message}
          </div>
        ) : null}
        {mutationError ? (
          <div className="border-b border-red-300/20 bg-red-500/10 px-5 py-3 text-sm text-destructive">
            {readErrorMessage(mutationError, t("admin.sellerApplications.operationFailed"))}
          </div>
        ) : null}
        <Tabs
          value={activeQueue}
          onValueChange={(value) => {
            setActiveQueue(value as QueueKey);
            setMessage(null);
          }}
          className="w-full"
        >
          <div className="border-b border-border px-5 py-3">
            <TabsList className="bg-muted/40">
              {QUEUES.map((queue) => (
                <TabsTrigger key={queue} value={queue}>
                  {t(`admin.contentModeration.queues.${queue}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="reviews" className="m-0">
            <AdminTable
              columns={reviewsColumns}
              data={reviews}
              isLoading={reviewsQuery.isLoading}
              emptyMessage={t("admin.contentModeration.empty")}
              getRowId={(item) => item.id}
              pagination={{
                pageIndex: page.reviews - 1,
                pageSize: PAGE_SIZE,
                totalRows: reviewsQuery.data?.pagination.total ?? 0,
                onPaginationChange: (updater) => {
                  const current = { pageIndex: page.reviews - 1, pageSize: PAGE_SIZE };
                  const next = typeof updater === "function" ? updater(current) : updater;
                  setPage((current) => ({ ...current, reviews: next.pageIndex + 1 }));
                },
              }}
            />
          </TabsContent>

          <TabsContent value="reports" className="m-0">
            <AdminTable
              columns={reportsColumns}
              data={reports}
              isLoading={reportsQuery.isLoading}
              emptyMessage={t("admin.contentModeration.empty")}
              getRowId={(item) => item.id}
              pagination={{
                pageIndex: page.reports - 1,
                pageSize: PAGE_SIZE,
                totalRows: reportsQuery.data?.pagination.total ?? 0,
                onPaginationChange: (updater) => {
                  const current = { pageIndex: page.reports - 1, pageSize: PAGE_SIZE };
                  const next = typeof updater === "function" ? updater(current) : updater;
                  setPage((current) => ({ ...current, reports: next.pageIndex + 1 }));
                },
              }}
            />
          </TabsContent>

          <TabsContent value="questions" className="m-0">
            <AdminTable
              columns={questionsColumns}
              data={questions}
              isLoading={questionsQuery.isLoading}
              emptyMessage={t("admin.contentModeration.empty")}
              getRowId={(item) => item.id}
              pagination={{
                pageIndex: page.questions - 1,
                pageSize: PAGE_SIZE,
                totalRows: questionsQuery.data?.pagination.total ?? 0,
                onPaginationChange: (updater) => {
                  const current = { pageIndex: page.questions - 1, pageSize: PAGE_SIZE };
                  const next = typeof updater === "function" ? updater(current) : updater;
                  setPage((current) => ({ ...current, questions: next.pageIndex + 1 }));
                },
              }}
            />
          </TabsContent>

          <TabsContent value="answers" className="m-0">
            <AdminTable
              columns={answersColumns}
              data={answers}
              isLoading={answersQuery.isLoading}
              emptyMessage={t("admin.contentModeration.empty")}
              getRowId={(item) => item.id}
              pagination={{
                pageIndex: page.answers - 1,
                pageSize: PAGE_SIZE,
                totalRows: answersQuery.data?.pagination.total ?? 0,
                onPaginationChange: (updater) => {
                  const current = { pageIndex: page.answers - 1, pageSize: PAGE_SIZE };
                  const next = typeof updater === "function" ? updater(current) : updater;
                  setPage((current) => ({ ...current, answers: next.pageIndex + 1 }));
                },
              }}
            />
          </TabsContent>
        </Tabs>

        <AlertDialog
          open={Boolean(actionTarget)}
          onOpenChange={(open) => {
            if (!open) setActionTarget(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("admin.ui.confirmModeration")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("admin.contentModeration.confirmDescription")
                  .replace("{title}", actionTarget?.title ?? t("admin.contentModeration.content"))
                  .replace(
                    "{status}",
                    actionTarget
                      ? t(`admin.statuses.${actionTarget.status}`)
                      : t("admin.contentModeration.selectedStatus"),
                  )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="content-moderation-note">{t("admin.ui.moderationNote")}</Label>
              <Textarea
                id="content-moderation-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="min-h-28 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950"
                placeholder={
                  actionTarget?.requiresNote
                    ? t("admin.contentModeration.requiredNote")
                    : t("admin.contentModeration.optionalNote")
                }
              />
              {isNoteMissing ? (
                <p className="text-sm font-medium text-red-600">{t("admin.ui.moderationNoteRequired")}</p>
              ) : null}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("admin.ui.cancel")}</AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button disabled={!actionTarget || isNoteMissing || isMutating} onClick={submitAction}>
                  {isMutating ? t("admin.ui.saving") : t("admin.ui.confirm")}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </AdminDataShell>
  );
}

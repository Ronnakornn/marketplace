"use client";

import { useMemo, useState } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { AdminDataShell } from "./AdminDataShell";
import { AdminStatusBadge } from "./AdminStatusBadge";
import { AdminTablePagination } from "./AdminTablePagination";
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
  | { queue: "reviews"; id: string; title: string; status: string; requiresNote: boolean }
  | { queue: "reports"; id: string; title: string; status: string; requiresNote: boolean }
  | { queue: "questions"; id: string; title: string; status: string; requiresNote: boolean }
  | { queue: "answers"; id: string; title: string; status: string; requiresNote: boolean };

const REVIEW_STATUSES = ["PENDING", "PUBLISHED", "REJECTED", "HIDDEN"] as const;
const REPORT_STATUSES = ["OPEN", "UNDER_REVIEW", "RESOLVED_REMOVED", "RESOLVED_DISMISSED"] as const;
const QUESTION_STATUSES = ["PENDING", "PUBLISHED", "HIDDEN"] as const;
const ANSWER_STATUSES = ["PENDING", "PUBLISHED", "HIDDEN"] as const;

const QUEUE_LABELS: Record<QueueKey, string> = {
  reviews: "Reviews",
  reports: "Review Reports",
  questions: "Questions",
  answers: "Answers",
};

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function textMatch(values: Array<unknown>, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return values.some((value) => String(value ?? "").toLowerCase().includes(needle));
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as { value?: { error?: { message?: string } }; error?: { message?: string }; message?: string };
    return record.value?.error?.message ?? record.error?.message ?? record.message ?? "Operation failed.";
  }
  return "Operation failed.";
}

function FilterSelect(props: { value: string; onChange: (value: string) => void; options: readonly string[] }) {
  return (
    <Select value={props.value || "ALL"} onValueChange={(value) => props.onChange(value === "ALL" ? "" : value)}>
      <SelectTrigger className="h-10 w-full border-white/10 bg-slate-950/60 text-slate-100 md:w-52">
        <SelectValue placeholder="Statuses" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">All statuses</SelectItem>
        {props.options.map((option) => (
          <SelectItem key={option} value={option}>
            {option.replaceAll("_", " ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EmptyRow() {
  return (
    <TableRow className="border-white/8 hover:bg-transparent">
      <TableCell colSpan={6} className="h-32 text-center text-slate-400">
        No content matches the current filters.
      </TableCell>
    </TableRow>
  );
}

function StatusActions(props: { currentStatus: string; options: readonly string[]; onSelect: (status: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {props.options.filter((status) => status !== props.currentStatus).map((status) => (
        <Button
          key={status}
          size="sm"
          variant="outline"
          className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
          disabled={props.disabled}
          onClick={() => props.onSelect(status)}
        >
          {status.replaceAll("_", " ")}
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
  const [activeQueue, setActiveQueue] = useState<QueueKey>("reviews");
  const [page, setPage] = useState<Record<QueueKey, number>>({ reviews: 1, reports: 1, questions: 1, answers: 1 });
  const [status, setStatus] = useState<Record<QueueKey, string>>({ reviews: "PENDING", reports: "OPEN", questions: "PENDING", answers: "PENDING" });
  const [search, setSearch] = useState("");
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const commonFilters = { page: page[activeQueue], limit: PAGE_SIZE, status: status[activeQueue], q: search };
  const reviewsQuery = useAdminModerationReviewsList(activeQueue === "reviews" ? commonFilters : { page: page.reviews, limit: PAGE_SIZE, status: status.reviews });
  const reportsQuery = useAdminModerationReviewReportsList(activeQueue === "reports" ? commonFilters : { page: page.reports, limit: PAGE_SIZE, status: status.reports });
  const questionsQuery = useAdminModerationQuestionsList(activeQueue === "questions" ? commonFilters : { page: page.questions, limit: PAGE_SIZE, status: status.questions });
  const answersQuery = useAdminModerationAnswersList(activeQueue === "answers" ? commonFilters : { page: page.answers, limit: PAGE_SIZE, status: status.answers });

  const updateReview = useUpdateModerationReviewStatus();
  const updateReport = useUpdateModerationReviewReportStatus();
  const updateQuestion = useUpdateModerationQuestionStatus();
  const updateAnswer = useUpdateModerationAnswerStatus();
  const mutationError = updateReview.error ?? updateReport.error ?? updateQuestion.error ?? updateAnswer.error;
  const isMutating = updateReview.isPending || updateReport.isPending || updateQuestion.isPending || updateAnswer.isPending;
  const isNoteMissing = Boolean(actionTarget?.requiresNote && note.trim().length === 0);

  const reviews = useMemo(() => (reviewsQuery.data?.items ?? []).filter((item: AdminModerationReview) => textMatch([item.body, item.product.title, item.shop.name, item.user.email, item.status], search)), [reviewsQuery.data, search]);
  const reports = useMemo(() => (reportsQuery.data?.items ?? []).filter((item: AdminModerationReviewReport) => textMatch([item.reason, item.detail, item.reportedBy.email, item.review?.body, item.review?.product.title, item.status], search)), [reportsQuery.data, search]);
  const questions = useMemo(() => (questionsQuery.data?.items ?? []).filter((item: AdminModerationQuestion) => textMatch([item.question, item.product.title, item.shop.name, item.user.email, item.status], search)), [questionsQuery.data, search]);
  const answers = useMemo(() => (answersQuery.data?.items ?? []).filter((item: AdminModerationAnswer) => textMatch([item.answer, item.question.question, item.question.product.title, item.question.shop.name, item.user.email, item.status], search)), [answersQuery.data, search]);

  const activeQuery = activeQueue === "reviews" ? reviewsQuery : activeQueue === "reports" ? reportsQuery : activeQueue === "questions" ? questionsQuery : answersQuery;
  const activeRows = activeQueue === "reviews" ? reviews : activeQueue === "reports" ? reports : activeQueue === "questions" ? questions : answers;
  const activeStatuses = activeQueue === "reviews" ? REVIEW_STATUSES : activeQueue === "reports" ? REPORT_STATUSES : activeQueue === "questions" ? QUESTION_STATUSES : ANSWER_STATUSES;

  function setActivePage(nextPage: number) {
    setPage((current) => ({ ...current, [activeQueue]: nextPage }));
  }

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
    const payload = { id: actionTarget.id, status: actionTarget.status, note: note.trim() || undefined };
    const options = {
      onSuccess: () => {
        setMessage(`${actionTarget.title} updated to ${actionTarget.status.replaceAll("_", " ")}.`);
        setActionTarget(null);
        setNote("");
      },
    };
    if (actionTarget.queue === "reviews") updateReview.mutate(payload, options);
    if (actionTarget.queue === "reports") updateReport.mutate(payload, options);
    if (actionTarget.queue === "questions") updateQuestion.mutate(payload, options);
    if (actionTarget.queue === "answers") updateAnswer.mutate(payload, options);
  }

  return (
    <AdminDataShell
      title="Content Moderation"
      description="Review marketplace UGC queues and apply traceable moderation decisions."
      icon={MessageSquareWarningIcon}
      search={search}
      searchPlaceholder="Search content, products, shops, or users"
      onSearchChange={(value) => { setSearch(value); setActivePage(1); }}
      isLoading={activeQuery.isLoading}
      error={activeQuery.error}
      onRetry={() => void activeQuery.refetch()}
      filters={<FilterSelect value={status[activeQueue]} onChange={setActiveStatus} options={activeStatuses} />}
    >
      <CardContent className="p-0">
        {message ? <div className="border-b border-emerald-300/20 bg-emerald-300/10 px-5 py-3 text-sm text-emerald-100">{message}</div> : null}
        {mutationError ? <div className="border-b border-red-300/20 bg-red-500/10 px-5 py-3 text-sm text-red-200">{readErrorMessage(mutationError)}</div> : null}
        <Tabs value={activeQueue} onValueChange={(value) => { setActiveQueue(value as QueueKey); setMessage(null); }} className="w-full">
          <div className="border-b border-white/10 px-5 py-3">
            <TabsList className="bg-slate-950/60">
              {(Object.keys(QUEUE_LABELS) as QueueKey[]).map((queue) => (
                <TabsTrigger key={queue} value={queue}>{QUEUE_LABELS[queue]}</TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="reviews" className="m-0">
            <Table><TableHeader><TableRow className="border-white/10 bg-white/6 hover:bg-white/6"><TableHead className="px-5 text-slate-300">Review</TableHead><TableHead className="text-slate-300">Product</TableHead><TableHead className="text-slate-300">Author</TableHead><TableHead className="text-slate-300">Status</TableHead><TableHead className="text-slate-300">Created</TableHead><TableHead className="text-right text-slate-300">Actions</TableHead></TableRow></TableHeader><TableBody>
              {reviews.length ? reviews.map((item) => <TableRow key={item.id} className="border-white/8 hover:bg-white/4"><TableCell className="max-w-md px-5 py-4"><p className="font-medium text-white">{item.rating} stars · {item.reportCount} reports</p><p className="mt-1 line-clamp-3 text-sm text-slate-300">{item.body ?? "No review body"}</p><p className="mt-1 text-xs text-slate-500">{item.orderItem.productTitle} · {item.orderItem.variantTitle}</p></TableCell><TableCell><p className="text-sm text-slate-200">{item.product.title}</p><p className="text-xs text-slate-500">{item.shop.name}</p></TableCell><TableCell><p className="text-sm text-slate-200">{item.user.name}</p><p className="text-xs text-slate-500">{item.user.email}</p></TableCell><TableCell><AdminStatusBadge status={item.status} /></TableCell><TableCell className="text-sm text-slate-300">{formatDate(item.createdAt)}</TableCell><TableCell><StatusActions currentStatus={item.status} options={REVIEW_STATUSES} disabled={isMutating} onSelect={(next) => openAction({ queue: "reviews", id: item.id, title: item.product.title, status: next, requiresNote: needsReviewNote(next) })} /></TableCell></TableRow>) : <EmptyRow />}
            </TableBody></Table>
          </TabsContent>

          <TabsContent value="reports" className="m-0">
            <Table><TableHeader><TableRow className="border-white/10 bg-white/6 hover:bg-white/6"><TableHead className="px-5 text-slate-300">Report</TableHead><TableHead className="text-slate-300">Review</TableHead><TableHead className="text-slate-300">Reporter</TableHead><TableHead className="text-slate-300">Status</TableHead><TableHead className="text-slate-300">Created</TableHead><TableHead className="text-right text-slate-300">Actions</TableHead></TableRow></TableHeader><TableBody>
              {reports.length ? reports.map((item) => <TableRow key={item.id} className="border-white/8 hover:bg-white/4"><TableCell className="max-w-md px-5 py-4"><p className="font-medium text-white">{item.reason}</p><p className="mt-1 line-clamp-3 text-sm text-slate-300">{item.detail ?? "No detail provided"}</p></TableCell><TableCell><p className="text-sm text-slate-200">{item.review?.product.title ?? "Review removed"}</p><p className="line-clamp-2 text-xs text-slate-500">{item.review?.body ?? "No review body"}</p></TableCell><TableCell><p className="text-sm text-slate-200">{item.reportedBy.name}</p><p className="text-xs text-slate-500">{item.reportedBy.email}</p></TableCell><TableCell><AdminStatusBadge status={item.status} /></TableCell><TableCell className="text-sm text-slate-300">{formatDate(item.createdAt)}</TableCell><TableCell><StatusActions currentStatus={item.status} options={REPORT_STATUSES} disabled={isMutating} onSelect={(next) => openAction({ queue: "reports", id: item.id, title: item.review?.product.title ?? "Review report", status: next, requiresNote: needsReportNote(next) })} /></TableCell></TableRow>) : <EmptyRow />}
            </TableBody></Table>
          </TabsContent>

          <TabsContent value="questions" className="m-0">
            <Table><TableHeader><TableRow className="border-white/10 bg-white/6 hover:bg-white/6"><TableHead className="px-5 text-slate-300">Question</TableHead><TableHead className="text-slate-300">Product</TableHead><TableHead className="text-slate-300">Author</TableHead><TableHead className="text-slate-300">Status</TableHead><TableHead className="text-slate-300">Created</TableHead><TableHead className="text-right text-slate-300">Actions</TableHead></TableRow></TableHeader><TableBody>
              {questions.length ? questions.map((item) => <TableRow key={item.id} className="border-white/8 hover:bg-white/4"><TableCell className="max-w-md px-5 py-4"><p className="line-clamp-3 font-medium text-white">{item.question}</p><p className="mt-1 text-xs text-slate-500">{item.answerCount} answers</p></TableCell><TableCell><p className="text-sm text-slate-200">{item.product.title}</p><p className="text-xs text-slate-500">{item.shop.name}</p></TableCell><TableCell><p className="text-sm text-slate-200">{item.user.name}</p><p className="text-xs text-slate-500">{item.user.email}</p></TableCell><TableCell><AdminStatusBadge status={item.status} /></TableCell><TableCell className="text-sm text-slate-300">{formatDate(item.createdAt)}</TableCell><TableCell><StatusActions currentStatus={item.status} options={QUESTION_STATUSES} disabled={isMutating} onSelect={(next) => openAction({ queue: "questions", id: item.id, title: item.product.title, status: next, requiresNote: needsQuestionNote(next) })} /></TableCell></TableRow>) : <EmptyRow />}
            </TableBody></Table>
          </TabsContent>

          <TabsContent value="answers" className="m-0">
            <Table><TableHeader><TableRow className="border-white/10 bg-white/6 hover:bg-white/6"><TableHead className="px-5 text-slate-300">Answer</TableHead><TableHead className="text-slate-300">Question</TableHead><TableHead className="text-slate-300">Author</TableHead><TableHead className="text-slate-300">Status</TableHead><TableHead className="text-slate-300">Created</TableHead><TableHead className="text-right text-slate-300">Actions</TableHead></TableRow></TableHeader><TableBody>
              {answers.length ? answers.map((item) => <TableRow key={item.id} className="border-white/8 hover:bg-white/4"><TableCell className="max-w-md px-5 py-4"><p className="line-clamp-3 font-medium text-white">{item.answer}</p><p className="mt-1 text-xs text-slate-500">{item.question.product.title} · {item.question.shop.name}</p></TableCell><TableCell><p className="line-clamp-2 text-sm text-slate-200">{item.question.question}</p><p className="text-xs text-slate-500">Asked by {item.question.user.email}</p></TableCell><TableCell><p className="text-sm text-slate-200">{item.user.name}</p><p className="text-xs text-slate-500">{item.user.email}</p></TableCell><TableCell><AdminStatusBadge status={item.status} /></TableCell><TableCell className="text-sm text-slate-300">{formatDate(item.createdAt)}</TableCell><TableCell><StatusActions currentStatus={item.status} options={ANSWER_STATUSES} disabled={isMutating} onSelect={(next) => openAction({ queue: "answers", id: item.id, title: item.question.product.title, status: next, requiresNote: needsAnswerNote(next) })} /></TableCell></TableRow>) : <EmptyRow />}
            </TableBody></Table>
          </TabsContent>
        </Tabs>
        <AdminTablePagination page={page[activeQueue]} totalPages={activeQuery.data?.pagination.totalPages ?? 1} total={activeQuery.data?.pagination.total ?? 0} visible={activeRows.length} onPageChange={setActivePage} />
        <AlertDialog open={Boolean(actionTarget)} onOpenChange={(open) => { if (!open) setActionTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm moderation action</AlertDialogTitle>
              <AlertDialogDescription>
                Update {actionTarget?.title ?? "content"} to {actionTarget?.status.replaceAll("_", " ") ?? "the selected status"}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="content-moderation-note">Moderation note</Label>
              <textarea
                id="content-moderation-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="min-h-28 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950"
                placeholder={actionTarget?.requiresNote ? "Required for this action." : "Optional internal note."}
              />
              {isNoteMissing ? <p className="text-sm font-medium text-red-600">Moderation note is required for this action.</p> : null}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button disabled={!actionTarget || isNoteMissing || isMutating} onClick={submitAction}>
                  {isMutating ? "Submitting..." : "Confirm"}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </AdminDataShell>
  );
}

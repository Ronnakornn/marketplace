"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "#/components/ui/button";
import { useLocale, useTranslations } from "#/i18n/client";
import { fetchProductQuestionAnswers, type BuyerProductQuestion } from "../queries";

export function ProductQuestionAnswers({ question }: { question: BuyerProductQuestion }) {
  const revision = `${question.productId}:${question.id}:${question.answerCount}:${question.answersCursor}:${question.answers.map(answer => answer.id).join(",")}`;
  return <AnswerPages key={revision} question={question} />;
}

function AnswerPages({ question }: { question: BuyerProductQuestion }) {
  const t = useTranslations();
  const locale = useLocale();
  const [extraAnswers, setExtraAnswers] = useState<BuyerProductQuestion["answers"]>([]);
  const [cursor, setCursor] = useState(question.answersCursor);
  const loadAnswers = useMutation({
    mutationFn: async () => {
      if (!cursor) throw new Error("No further answers");
      return fetchProductQuestionAnswers(question.id, cursor);
    },
    onSuccess: (page) => {
      setExtraAnswers(current => [...current, ...page.items]);
      setCursor(page.nextCursor);
    },
  });
  const answers = [...new Map([...question.answers, ...extraAnswers].map(answer => [answer.id, answer])).values()];
  return <>
    {answers.length ? <div className="mt-4 space-y-3 border-l-2 border-orange-200 pl-3">
      {answers.map(answer => <div key={answer.id} className="rounded-lg bg-orange-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="break-words text-sm font-semibold text-orange-900">{t("product.sellerAnswerFrom").replace("{name}", answer.user.name)}</p>
          {answer.createdAt ? <time dateTime={answer.createdAt} className="text-xs text-orange-700">{new Date(answer.createdAt).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" })}</time> : null}
        </div>
        <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-slate-700">{answer.answer}</p>
      </div>)}
    </div> : <p className="mt-3 text-sm text-slate-500">{t("product.sellerNotAnswered")}</p>}
    {loadAnswers.error ? <p role="alert" className="text-sm text-red-600">{t("product.answersUnavailable")}</p> : null}
    {cursor ? <Button type="button" variant="outline" disabled={loadAnswers.isPending} onClick={() => loadAnswers.mutate()}>
      {loadAnswers.isPending ? t("common.loading") : t("product.loadMoreAnswers")}
    </Button> : null}
  </>;
}

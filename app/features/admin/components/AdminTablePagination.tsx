"use client";

import { Button } from "#/components/ui/button";
import { Pagination, PaginationContent, PaginationItem } from "#/components/ui/pagination";
import { useTranslations } from "#/i18n/client";

export function AdminTablePagination(props: {
  page: number;
  totalPages: number;
  total: number;
  visible: number;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations();
  const totalPages = props.totalPages || 1;
  return (
    <div className="flex flex-col gap-3 rounded-b-xl border-t border-white/10 bg-slate-950/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-400">
        {t("admin.common.showingRecords").replace("{visible}", String(props.visible)).replace("{total}", String(props.total))}
      </p>
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <Button
              variant="outline"
              size="sm"
              className="border-white/12 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
              disabled={props.page <= 1}
              onClick={() => props.onPageChange(props.page - 1)}
            >
              {t("admin.common.previous")}
            </Button>
          </PaginationItem>
          <PaginationItem>
            <span className="min-w-20 text-center text-sm text-slate-300">
              {props.page} / {totalPages}
            </span>
          </PaginationItem>
          <PaginationItem>
            <Button
              variant="outline"
              size="sm"
              className="border-white/12 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
              disabled={props.page >= totalPages}
              onClick={() => props.onPageChange(props.page + 1)}
            >
              {t("admin.common.next")}
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

"use client";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "#/components/ui/native-select";
import { AdminTable } from "../components/AdminTable";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatters, useTranslations } from "#/i18n/client";
import { reportingApi, requireData } from "./api";

const field =
  "rounded border border-input bg-background px-3 py-2 text-sm text-foreground";
type ScheduleInput = Parameters<
  (typeof reportingApi.api.admin)["report-schedules"]["post"]
>[0];
export function AdminReportSchedules() {
  const t = useTranslations(),
    format = useFormatters(),
    client = useQueryClient();
  const [draft, setDraft] = useState<ScheduleInput>({
    name: "",
    type: "SALES",
    format: "XLSX",
    cadence: "DAILY",
    hour: 8,
    filters: { group: "day", timeZone: "Asia/Bangkok" },
    isActive: true,
  });
  const schedules = useQuery({
    queryKey: ["admin", "report-schedules"],
    queryFn: () =>
      requireData(reportingApi.api.admin["report-schedules"].get()),
  });
  const save = useMutation({
    mutationFn: () =>
      requireData(reportingApi.api.admin["report-schedules"].post(draft)),
    onSuccess: () => {
      setDraft({ ...draft, name: "" });
      return client.invalidateQueries({
        queryKey: ["admin", "report-schedules"],
      });
    },
  });
  const toggle = useMutation({
    mutationFn: (schedule: NonNullable<typeof schedules.data>[number]) =>
      requireData(
        reportingApi.api.admin["report-schedules"]({ id: schedule.id }).put({
          name: schedule.name,
          type: "SALES",
          format: schedule.format === "CSV" ? "CSV" : "XLSX",
          cadence:
            schedule.cadence === "MONTHLY"
              ? "MONTHLY"
              : schedule.cadence === "WEEKLY"
                ? "WEEKLY"
                : "DAILY",
          hour: schedule.hour,
          filters: schedule.filters,
          isActive: !schedule.isActive,
          expectedVersion: schedule.version,
        }),
      ),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["admin", "report-schedules"] }),
  });
  return (
    <section className="admin-panel flex flex-col gap-5 rounded-lg p-5">
      <h1 className="text-2xl font-semibold text-white">
        {t("admin.reporting.schedules")}
      </h1>
      <p className="text-sm text-slate-300">
        {t("admin.reporting.scheduleNote")}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          {t("admin.reporting.name")}
          <Input
            className={field}
            required
            maxLength={120}
            value={draft.name}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          {t("admin.reporting.cadence")}
          <NativeSelect
            className={field}
            value={draft.cadence}
            onChange={(event) =>
              setDraft({
                ...draft,
                cadence:
                  event.target.value === "MONTHLY"
                    ? "MONTHLY"
                    : event.target.value === "WEEKLY"
                      ? "WEEKLY"
                      : "DAILY",
              })
            }
          >
            {(["DAILY", "WEEKLY", "MONTHLY"] as const).map((cadence) => (
              <NativeSelectOption key={cadence} value={cadence}>
                {t(`admin.reporting.${cadence}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          {t("admin.reporting.bangkokHour")}
          <Input
            className={field}
            type="number"
            min={0}
            max={23}
            required
            value={draft.hour}
            onChange={(event) =>
              setDraft({ ...draft, hour: Number(event.target.value) })
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          {t("admin.reporting.format")}
          <NativeSelect
            className={field}
            value={draft.format}
            onChange={(event) =>
              setDraft({
                ...draft,
                format: event.target.value === "CSV" ? "CSV" : "XLSX",
              })
            }
          >
            <NativeSelectOption>CSV</NativeSelectOption>
            <NativeSelectOption>XLSX</NativeSelectOption>
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          {t("admin.reporting.shopId")}
          <Input
            className={field}
            value={draft.filters.shopId ?? ""}
            onChange={(event) =>
              setDraft({
                ...draft,
                filters: {
                  ...draft.filters,
                  shopId: event.target.value || undefined,
                },
              })
            }
          />
        </label>
        <Button variant="outline" className={field} disabled={save.isPending}>
          {t("admin.reporting.save")}
        </Button>
      </form>
      {save.error || toggle.error || schedules.error ? (
        <p role="alert" className="text-red-300">
          {(save.error ?? toggle.error ?? schedules.error)?.message}
        </p>
      ) : null}
      {schedules.isPending ? (
        <p role="status" className="text-slate-300">
          {t("admin.reporting.loading")}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <AdminTable
          data={schedules.data ?? []}
          columns={[
            {
              id: "name",
              header: t("admin.reporting.name"),
              enableSorting: false,
              cell: ({ row: { original: schedule } }) => (
                <>
                  {schedule.name}
                  <span className="block text-xs text-slate-400">
                    {schedule.format}
                  </span>
                </>
              ),
            },
            {
              id: "cadence",
              header: t("admin.reporting.cadence"),
              enableSorting: false,
              cell: ({ row: { original: schedule } }) => (
                <>
                  {t(`admin.reporting.${schedule.cadence}`)} · {schedule.hour}
                  :00
                </>
              ),
            },
            {
              id: "nextRun",
              header: t("admin.reporting.nextRun"),
              enableSorting: false,
              cell: ({ row: { original: schedule } }) => (
                <>{format.date(schedule.nextRunAt)}</>
              ),
            },
            {
              id: "statusLabel",
              header: t("admin.reporting.statusLabel"),
              enableSorting: false,
              cell: ({ row: { original: schedule } }) => (
                <>
                  {t(
                    schedule.isActive
                      ? "admin.reporting.active"
                      : "admin.reporting.paused",
                  )}
                </>
              ),
            },
            {
              id: "actions",
              header: t("admin.reporting.actions"),
              enableSorting: false,
              cell: ({ row: { original: schedule } }) => (
                <>
                  <Button
                    variant="outline"
                    className={field}
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate(schedule)}
                  >
                    {t(
                      schedule.isActive
                        ? "admin.reporting.pause"
                        : "admin.reporting.resume",
                    )}
                  </Button>
                </>
              ),
            },
          ]}
        />
        {schedules.data?.length === 0 ? (
          <p className="py-5 text-slate-300">{t("admin.reporting.empty")}</p>
        ) : null}
      </div>
    </section>
  );
}

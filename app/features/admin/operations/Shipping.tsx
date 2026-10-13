"use client";

import { AdminTable } from "../components/AdminTable";

import { useId, useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "#/components/ui/native-select";
import { useTranslations, useFormatters } from "#/i18n/client";
import {
  operationsApi,
  useOperationMutation,
  useOperationQuery,
  unwrap,
  type ProviderInput,
  type ProviderRow,
  type RateInput,
  type RateRow,
} from "./api";
import {
  CheckField,
  EditButton,
  Editor,
  Field,
  OperationsFrame,
  OperationConfirmation,
  splitList,
  optionalNumber,
} from "./shared";

const blankProvider: ProviderInput = {
  shopId: null,
  code: "",
  name: "",
  displayNameTh: null,
  displayNameEn: null,
  isActive: true,
  supportsCod: false,
  supportsPickup: false,
  reason: "",
};
const blankRate: RateInput = {
  providerId: "",
  shopId: null,
  name: "",
  country: "TH",
  postalPrefixes: [],
  regions: [],
  minWeightGrams: 0,
  maxWeightGrams: null,
  maxLengthMm: null,
  maxWidthMm: null,
  maxHeightMm: null,
  volumetricDivisor: 5000,
  baseFee: "0",
  perKgFee: "0",
  priority: 0,
  isActive: true,
  reason: "",
};
export function ShippingProviderPicker(props: {
  value: string;
  onChange: (value: string) => void;
  providers: readonly Pick<ProviderRow, "id" | "name" | "code">[];
  selected?: Pick<RateRow["provider"], "id" | "name"> | null;
}) {
  const t = useTranslations();
  const id = useId();
  const [search, setSearch] = useState("");
  const options = props.providers.filter(
    (provider) =>
      provider.id === props.value ||
      `${provider.name} ${provider.code}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  const missingSelected =
    props.value && !options.some((provider) => provider.id === props.value);
  return (
    <div className="grid gap-2 text-sm">
      <label htmlFor={id}>{t("admin.operations.shipping.provider")}</label>
      <Input
        aria-label={t("admin.operations.shipping.searchProviders")}
        placeholder={t("admin.operations.shipping.searchProviders")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <NativeSelect
        id={id}
        value={props.value}
        required
        onChange={(event) => props.onChange(event.target.value)}
      >
        <NativeSelectOption value="">
          {t("admin.operations.shipping.chooseProvider")}
        </NativeSelectOption>
        {missingSelected ? (
          <NativeSelectOption value={props.value}>
            {props.selected?.id === props.value
              ? props.selected.name
              : t("admin.operations.shipping.selectedProvider")}
          </NativeSelectOption>
        ) : null}
        {options.map((provider) => (
          <NativeSelectOption key={provider.id} value={provider.id}>
            {provider.name} · {provider.code}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <p className="text-xs text-muted-foreground">
        {t("admin.operations.shipping.providerSearchHelp")}
      </p>
    </div>
  );
}
export function AdminShipping() {
  const t = useTranslations();
  const { currency } = useFormatters();
  const [providerPage, setProviderPage] = useState(1);
  const [ratePage, setRatePage] = useState(1);
  const [provider, setProvider] = useState(blankProvider);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [rate, setRate] = useState(blankRate);
  const [rateId, setRateId] = useState<string | null>(null);
  const [providerOpen, setProviderOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<
    RateRow["provider"] | null
  >(null);
  const [removing, setRemoving] = useState<
    | { kind: "provider"; row: ProviderRow }
    | { kind: "rate"; row: RateRow }
    | null
  >(null);
  const [removeReason, setRemoveReason] = useState("");
  const providers = useOperationQuery(["providers", providerPage], () =>
    operationsApi.shipping.providers.get({
      query: { page: providerPage, limit: 20 },
    }),
  );
  const rates = useOperationQuery(["rates", ratePage], () =>
    operationsApi.shipping.rates.get({ query: { page: ratePage, limit: 20 } }),
  );
  const saveProvider = useOperationMutation((body: ProviderInput) =>
    providerId
      ? operationsApi.shipping.providers({ id: providerId }).patch(body)
      : operationsApi.shipping.providers.post(body),
  );
  const saveRate = useOperationMutation((body: RateInput) =>
    rateId
      ? operationsApi.shipping.rates({ id: rateId }).patch(body)
      : operationsApi.shipping.rates.post(body),
  );
  const removeProvider = useOperationMutation(
    (input: { row: ProviderRow; reason: string }) =>
      operationsApi.shipping.providers({ id: input.row.id }).delete({
        expectedUpdatedAt: new Date(input.row.updatedAt).toISOString(),
        reason: input.reason,
      }),
  );
  const removeRate = useOperationMutation(
    (input: { row: RateRow; reason: string }) =>
      operationsApi.shipping
        .rates({ id: input.row.id })
        .delete({ expectedVersion: input.row.version, reason: input.reason }),
  );
  const [quote, setQuote] = useState({
    shopId: "",
    country: "TH",
    postalCode: "",
    region: "",
    weightGrams: 1000,
    lengthMm: 100,
    widthMm: 100,
    heightMm: 100,
  });
  const [quoted, setQuoted] =
    useState<
      Awaited<ReturnType<typeof operationsApi.shipping.quote.post>>["data"]
    >(null);
  const [quoteError, setQuoteError] = useState<unknown>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  function editProvider(row: ProviderRow) {
    saveProvider.reset();
    setProviderOpen(true);
    setProviderId(row.id);
    setProvider({
      shopId: row.shopId,
      code: row.code,
      name: row.name,
      displayNameTh: row.displayNameTh,
      displayNameEn: row.displayNameEn,
      isActive: row.isActive,
      supportsCod: row.supportsCod,
      supportsPickup: row.supportsPickup,
      expectedUpdatedAt: new Date(row.updatedAt).toISOString(),
      reason: "",
    });
  }
  function editRate(row: RateRow) {
    saveRate.reset();
    setRateOpen(true);
    setSelectedProvider(row.provider);
    setRateId(row.id);
    setRate({
      providerId: row.providerId,
      shopId: row.shopId,
      name: row.name,
      country: row.country,
      postalPrefixes: row.postalPrefixes,
      regions: row.regions,
      minWeightGrams: row.minWeightGrams,
      maxWeightGrams: row.maxWeightGrams,
      maxLengthMm: row.maxLengthMm,
      maxWidthMm: row.maxWidthMm,
      maxHeightMm: row.maxHeightMm,
      volumetricDivisor: row.volumetricDivisor,
      baseFee: row.baseFee,
      perKgFee: row.perKgFee,
      priority: row.priority,
      isActive: row.isActive,
      expectedVersion: row.version,
      reason: "",
    });
  }
  return (
    <OperationsFrame
      area="shipping"
      loading={providers.isLoading || rates.isLoading}
      error={
        saveProvider.error ??
        saveRate.error ??
        removeProvider.error ??
        removeRate.error ??
        quoteError ??
        providers.error ??
        rates.error
      }
    >
      <h2 className="text-lg font-medium">
        {t("admin.operations.shipping.providers")}
      </h2>
      <Editor
        title={providerId ? "editProvider" : "createProvider"}
        triggerLabel="createProvider"
        open={providerOpen}
        onOpenChange={(open) => {
          setProviderOpen(open);
          if (open) saveProvider.reset();
        }}
        error={saveProvider.error ?? providers.error}
        busy={saveProvider.isPending}
        onCancel={() => {
          setProviderId(null);
          setProvider(blankProvider);
        }}
        onSubmit={() =>
          saveProvider.mutateAsync(provider, {
            onSuccess: () => {
              setProviderOpen(false);
              setProviderId(null);
              setProvider(blankProvider);
            },
          })
        }
      >
        <Field
          label="code"
          value={provider.code}
          required
          onChange={(value) => setProvider({ ...provider, code: value })}
        />
        <Field
          label="name"
          value={provider.name}
          required
          onChange={(value) => setProvider({ ...provider, name: value })}
        />
        <Field
          label="shopId"
          value={provider.shopId ?? ""}
          onChange={(value) =>
            setProvider({ ...provider, shopId: value || null })
          }
        />
        <Field
          label="titleTh"
          value={provider.displayNameTh ?? ""}
          onChange={(value) =>
            setProvider({ ...provider, displayNameTh: value || null })
          }
        />
        <Field
          label="titleEn"
          value={provider.displayNameEn ?? ""}
          onChange={(value) =>
            setProvider({ ...provider, displayNameEn: value || null })
          }
        />
        <CheckField
          label="active"
          checked={provider.isActive}
          onChange={(value) => setProvider({ ...provider, isActive: value })}
        />
        <CheckField
          label="supportsCod"
          checked={provider.supportsCod}
          onChange={(value) => setProvider({ ...provider, supportsCod: value })}
        />
        <CheckField
          label="supportsPickup"
          checked={provider.supportsPickup}
          onChange={(value) =>
            setProvider({ ...provider, supportsPickup: value })
          }
        />
        <Field
          label="reason"
          value={provider.reason}
          required
          onChange={(value) => setProvider({ ...provider, reason: value })}
        />
      </Editor>
      <AdminTable
        isLoading={providers.isLoading}
        data={providers.data?.items ?? []}
        columns={[
          {
            id: "name",
            header: t("admin.operations.fields.name"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => <>{row.name}</>,
          },
          {
            id: "code",
            header: t("admin.operations.fields.code"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => <>{row.code}</>,
          },
          {
            id: "shopId",
            header: t("admin.operations.fields.shopId"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => (
              <>{row.shopId ?? t("admin.operations.global")}</>
            ),
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
                  <EditButton onClick={() => editProvider(row)} />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={removeProvider.isPending}
                    onClick={() => {
                      removeProvider.reset();
                      setRemoveReason("");
                      setRemoving({ kind: "provider", row });
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
          pageIndex: providerPage - 1,
          pageSize: 20,
          totalRows: providers.data?.total ?? 0,
          onPaginationChange: (updater) => {
            const next =
              typeof updater === "function"
                ? updater({ pageIndex: providerPage - 1, pageSize: 20 })
                : updater;
            setProviderPage(next.pageIndex + 1);
          },
        }}
      />
      <h2 className="text-lg font-medium">
        {t("admin.operations.shipping.rates")}
      </h2>
      <Editor
        title={rateId ? "editRate" : "createRate"}
        triggerLabel="createRate"
        open={rateOpen}
        onOpenChange={(open) => {
          setRateOpen(open);
          if (open) saveRate.reset();
        }}
        error={saveRate.error ?? providers.error ?? rates.error}
        busy={saveRate.isPending}
        onCancel={() => {
          setRateId(null);
          setRate(blankRate);
          setSelectedProvider(null);
        }}
        onSubmit={() =>
          saveRate.mutateAsync(rate, {
            onSuccess: () => {
              setRateOpen(false);
              setRateId(null);
              setRate(blankRate);
            },
          })
        }
      >
        <ShippingProviderPicker
          value={rate.providerId}
          providers={providers.data?.items ?? []}
          selected={selectedProvider}
          onChange={(value) => setRate({ ...rate, providerId: value })}
        />
        <Field
          label="shopId"
          value={rate.shopId ?? ""}
          onChange={(value) => setRate({ ...rate, shopId: value || null })}
        />
        <Field
          label="name"
          value={rate.name}
          required
          onChange={(value) => setRate({ ...rate, name: value })}
        />
        <Field
          label="country"
          value={rate.country}
          onChange={(value) =>
            setRate({ ...rate, country: value.toUpperCase() })
          }
        />
        <Field
          label="postalPrefixes"
          value={rate.postalPrefixes.join(", ")}
          onChange={(value) =>
            setRate({ ...rate, postalPrefixes: splitList(value) })
          }
        />
        <Field
          label="regions"
          value={rate.regions.join(", ")}
          onChange={(value) => setRate({ ...rate, regions: splitList(value) })}
        />
        <Field
          label="minWeightGrams"
          type="number"
          value={rate.minWeightGrams}
          onChange={(value) =>
            setRate({ ...rate, minWeightGrams: Number(value) })
          }
        />
        <Field
          label="maxWeightGrams"
          type="number"
          value={rate.maxWeightGrams ?? ""}
          onChange={(value) =>
            setRate({ ...rate, maxWeightGrams: optionalNumber(value) })
          }
        />
        <Field
          label="maxLengthMm"
          type="number"
          value={rate.maxLengthMm ?? ""}
          onChange={(value) =>
            setRate({ ...rate, maxLengthMm: optionalNumber(value) })
          }
        />
        <Field
          label="maxWidthMm"
          type="number"
          value={rate.maxWidthMm ?? ""}
          onChange={(value) =>
            setRate({ ...rate, maxWidthMm: optionalNumber(value) })
          }
        />
        <Field
          label="maxHeightMm"
          type="number"
          value={rate.maxHeightMm ?? ""}
          onChange={(value) =>
            setRate({ ...rate, maxHeightMm: optionalNumber(value) })
          }
        />
        <Field
          label="volumetricDivisor"
          type="number"
          value={rate.volumetricDivisor}
          onChange={(value) =>
            setRate({ ...rate, volumetricDivisor: Number(value) })
          }
        />
        <Field
          label="baseFee"
          value={rate.baseFee}
          onChange={(value) => setRate({ ...rate, baseFee: value })}
        />
        <Field
          label="perKgFee"
          value={rate.perKgFee}
          onChange={(value) => setRate({ ...rate, perKgFee: value })}
        />
        <Field
          label="priority"
          type="number"
          value={rate.priority}
          onChange={(value) => setRate({ ...rate, priority: Number(value) })}
        />
        <CheckField
          label="active"
          checked={rate.isActive}
          onChange={(value) => setRate({ ...rate, isActive: value })}
        />
        <Field
          label="reason"
          value={rate.reason}
          required
          onChange={(value) => setRate({ ...rate, reason: value })}
        />
      </Editor>
      <AdminTable
        isLoading={rates.isLoading}
        data={rates.data?.items ?? []}
        columns={[
          {
            id: "name",
            header: t("admin.operations.fields.name"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => <>{row.name}</>,
          },
          {
            id: "providerId",
            header: t("admin.operations.shipping.provider"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => <>{row.provider.name}</>,
          },
          {
            id: "baseFee",
            header: t("admin.operations.fields.baseFee"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => <>{currency(row.baseFee)}</>,
          },
          {
            id: "perKgFee",
            header: t("admin.operations.fields.perKgFee"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => <>{currency(row.perKgFee)}</>,
          },
          {
            id: "weight",
            header: t("admin.operations.fields.weight"),
            enableSorting: false,
            cell: ({ row: { original: row } }) => (
              <>
                {row.minWeightGrams} /{" "}
                {row.maxWeightGrams ?? t("admin.operations.unbounded")}
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
                  <EditButton onClick={() => editRate(row)} />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={removeRate.isPending}
                    onClick={() => {
                      removeRate.reset();
                      setRemoveReason("");
                      setRemoving({ kind: "rate", row });
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
          pageIndex: ratePage - 1,
          pageSize: 20,
          totalRows: rates.data?.total ?? 0,
          onPaginationChange: (updater) => {
            const next =
              typeof updater === "function"
                ? updater({ pageIndex: ratePage - 1, pageSize: 20 })
                : updater;
            setRatePage(next.pageIndex + 1);
          },
        }}
      />
      <Editor
        title="shipping.quote"
        submitLabel="shipping.quote"
        description="shipping.quoteDescription"
        error={quoteError ?? providers.error ?? rates.error}
        busy={quoteBusy}
        onSubmit={async () => {
          try {
            setQuoteBusy(true);
            setQuoteError(null);
            const { weightGrams, lengthMm, widthMm, heightMm, ...address } =
              quote;
            setQuoted(
              unwrap(
                await operationsApi.shipping.quote.post({
                  ...address,
                  packages: [{ weightGrams, lengthMm, widthMm, heightMm }],
                }),
              ),
            );
          } catch (error) {
            setQuoteError(error);
          } finally {
            setQuoteBusy(false);
          }
        }}
      >
        <Field
          label="shopId"
          value={quote.shopId}
          required
          onChange={(value) => setQuote({ ...quote, shopId: value })}
        />
        <Field
          label="country"
          value={quote.country}
          onChange={(value) => setQuote({ ...quote, country: value })}
        />
        <Field
          label="postalCode"
          value={quote.postalCode}
          onChange={(value) => setQuote({ ...quote, postalCode: value })}
        />
        <Field
          label="regions"
          value={quote.region}
          onChange={(value) => setQuote({ ...quote, region: value })}
        />
        {(["weightGrams", "lengthMm", "widthMm", "heightMm"] as const).map(
          (key) => (
            <Field
              key={key}
              label={key}
              type="number"
              value={quote[key]}
              onChange={(value) => setQuote({ ...quote, [key]: Number(value) })}
            />
          ),
        )}
        {quoted ? (
          <p role="status">
            {currency(quoted.fee)} ·{" "}
            {quoted.providerName ?? t("admin.operations.default")} ·{" "}
            {quoted.chargeableWeightGrams} {t("admin.operations.grams")}
          </p>
        ) : null}
      </Editor>
      <OperationConfirmation
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title="delete"
        target={removing?.row.name ?? ""}
        reason={removeReason}
        onReasonChange={setRemoveReason}
        destructive
        busy={removeProvider.isPending || removeRate.isPending}
        error={
          removing?.kind === "provider"
            ? removeProvider.error
            : removeRate.error
        }
        onConfirm={() => {
          if (!removing) return;
          const options = { onSuccess: () => setRemoving(null) };
          if (removing.kind === "provider")
            removeProvider.mutate(
              { row: removing.row, reason: removeReason },
              options,
            );
          else
            removeRate.mutate(
              { row: removing.row, reason: removeReason },
              options,
            );
        }}
      />
    </OperationsFrame>
  );
}

"use client";

import { useState } from "react";
import { Button } from "#/components/ui/button";
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
  Cell,
  CheckField,
  DataTable,
  EditButton,
  Editor,
  Field,
  OperationsFrame,
  Pager,
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
export function AdminShipping() {
  const t = useTranslations();
  const { currency } = useFormatters();
  const [page, setPage] = useState(1);
  const [provider, setProvider] = useState(blankProvider);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [rate, setRate] = useState(blankRate);
  const [rateId, setRateId] = useState<string | null>(null);
  const providers = useOperationQuery(["providers", page], () =>
    operationsApi.shipping.providers.get({ query: { page, limit: 20 } }),
  );
  const rates = useOperationQuery(["rates", page], () =>
    operationsApi.shipping.rates.get({ query: { page, limit: 20 } }),
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
  const removeProvider = useOperationMutation((row: ProviderRow) =>
    operationsApi.shipping
      .providers({ id: row.id })
      .delete({
        expectedUpdatedAt: new Date(row.updatedAt).toISOString(),
        reason: provider.reason,
      }),
  );
  const removeRate = useOperationMutation((row: RateRow) =>
    operationsApi.shipping
      .rates({ id: row.id })
      .delete({ expectedVersion: row.version, reason: rate.reason }),
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
  function editProvider(row: ProviderRow) {
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
      <DataTable headings={["name", "code", "shopId", "active", "actions"]}>
        {providers.data?.items.map((row) => (
          <tr key={row.id}>
            <Cell>{row.name}</Cell>
            <Cell>{row.code}</Cell>
            <Cell>{row.shopId ?? t("admin.operations.global")}</Cell>
            <Cell>
              {t(row.isActive ? "admin.operations.yes" : "admin.operations.no")}
            </Cell>
            <Cell>
              <div className="flex gap-2">
                <EditButton onClick={() => editProvider(row)} />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={provider.reason.trim().length < 3}
                  onClick={() => removeProvider.mutate(row)}
                >
                  {t("admin.operations.delete")}
                </Button>
              </div>
            </Cell>
          </tr>
        ))}
      </DataTable>
      <Editor
        title={providerId ? "editProvider" : "createProvider"}
        busy={saveProvider.isPending}
        onCancel={() => {
          setProviderId(null);
          setProvider(blankProvider);
        }}
        onSubmit={() =>
          saveProvider.mutate(provider, {
            onSuccess: () => {
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
      <h2 className="text-lg font-medium">
        {t("admin.operations.shipping.rates")}
      </h2>
      <DataTable
        headings={[
          "name",
          "providerId",
          "baseFee",
          "perKgFee",
          "weight",
          "actions",
        ]}
      >
        {rates.data?.items.map((row) => (
          <tr key={row.id}>
            <Cell>{row.name}</Cell>
            <Cell>{row.provider.name}</Cell>
            <Cell>{currency(row.baseFee)}</Cell>
            <Cell>{currency(row.perKgFee)}</Cell>
            <Cell>
              {row.minWeightGrams} /{" "}
              {row.maxWeightGrams ?? t("admin.operations.unbounded")}
            </Cell>
            <Cell>
              <div className="flex gap-2">
                <EditButton onClick={() => editRate(row)} />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={rate.reason.trim().length < 3}
                  onClick={() => removeRate.mutate(row)}
                >
                  {t("admin.operations.delete")}
                </Button>
              </div>
            </Cell>
          </tr>
        ))}
      </DataTable>
      <Pager
        page={page}
        total={Math.max(providers.data?.total ?? 0, rates.data?.total ?? 0)}
        onPage={setPage}
      />
      <Editor
        title={rateId ? "editRate" : "createRate"}
        busy={saveRate.isPending}
        onCancel={() => {
          setRateId(null);
          setRate(blankRate);
        }}
        onSubmit={() =>
          saveRate.mutate(rate, {
            onSuccess: () => {
              setRateId(null);
              setRate(blankRate);
            },
          })
        }
      >
        <Field
          label="providerId"
          value={rate.providerId}
          required
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
      <Editor
        title="shipping.quote"
        onSubmit={async () => {
          try {
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
    </OperationsFrame>
  );
}

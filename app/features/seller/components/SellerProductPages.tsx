"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { ArchiveIcon, ArrowDownIcon, ArrowUpIcon, BarChart3Icon, EditIcon, PlusIcon, SaveIcon, SendIcon, TrashIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "#/i18n/client";
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
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { DataTable } from "#/components/ui/data-table";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "#/components/ui/select";
import { Textarea } from "#/components/ui/textarea";
import type { BuyerProductQuestion } from "#/features/product/queries";
import { SellerPageHeader } from "./SellerShell";
import {
  type SellerProduct,
  type SellerProductImage,
  type SellerProductInput,
  type SellerProductOptionInput,
  type SellerProductVideo,
  type SellerVariantInput,
  useAnswerSellerProductQuestion,
  useArchiveSellerProduct,
  useSellerCategorySpecs,
  useCreateSellerProduct,
  useCreateSellerVariant,
  useDeleteSellerProductImage,
  useDeleteSellerProductVideo,
  useDeleteSellerVariant,
  useSellerBrands,
  useSellerCategories,
  useSellerProduct,
  useSellerProductQuestions,
  useSellerProducts,
  usePublishSellerProduct,
  useUpdateSellerProductImagesOrder,
  useUpdateSellerProductImage,
  useUpdateSellerProductOptions,
  useUpdateSellerProduct,
  useUpdateSellerVariant,
  useUpdateSellerVariantStock,
  useUploadAndCreateSellerProductImage,
  useUploadAndUpsertSellerProductVideo,
} from "../hooks/useSellerManage";

type ProductStatus = "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "REJECTED" | "SUSPENDED" | "ARCHIVED";
type VariantStatus = "ACTIVE" | "INACTIVE";
type Translator = ReturnType<typeof useTranslations>;
type AppLocale = ReturnType<typeof useLocale>;
type ProductStudioSectionId = "basics" | "category-specs" | "media" | "variants" | "inventory" | "review";
type CategorySpecValueType = "TEXT" | "NUMBER" | "BOOLEAN" | "SELECT" | "MULTI_SELECT";
type CategorySpecDefinition = {
  id?: string;
  attributeKey: string;
  displayName?: string | null;
  displayNameTh?: string | null;
  displayNameEn?: string | null;
  valueType?: CategorySpecValueType | string | null;
  isRequired?: boolean | null;
  isFilterable?: boolean | null;
  unit?: string | null;
  allowedValues?: unknown;
  sortOrder?: number | null;
};
type ProductAttributeDraft = {
  attributeKey: string;
  displayName: string;
  value: string;
  isFilterable: boolean;
};
type ReadinessCheck = {
  id: string;
  label: string;
  passed: boolean;
  missingLabel: string;
};

const MAX_PRODUCT_IMAGES = 10;
const MAX_PRODUCT_VIDEO_BYTES = 25 * 1024 * 1024;
const PRODUCT_VIDEO_TYPES = ["video/mp4", "video/webm"];
const DEFAULT_BULK_STATUS: VariantStatus = "ACTIVE";
const PRODUCT_STUDIO_SECTIONS: Array<{ id: ProductStudioSectionId }> = [
  { id: "basics" },
  { id: "category-specs" },
  { id: "media" },
  { id: "variants" },
  { id: "inventory" },
  { id: "review" },
];

interface ProductFormState {
  title: string;
  slug: string;
  description: string;
  status: ProductStatus;
  categoryId: string;
  brandId: string;
  titleTh: string;
  titleEn: string;
  descriptionTh: string;
  descriptionEn: string;
  metaTitle: string;
  metaDescription: string;
  warrantyInfo: string;
  condition: string;
  countryOfOrigin: string;
  highlightsText: string;
  attributesText: string;
}

interface VariantFormState {
  id?: string;
  sku: string;
  title: string;
  titleTh: string;
  titleEn: string;
  price: string;
  currency: string;
  status: VariantStatus;
  quantityOnHand: string;
  quantityReserved: number;
  reorderLevel: string;
  weightGrams: string;
  lengthMm: string;
  widthMm: string;
  heightMm: string;
  optionValueIds: string[];
}

interface ProductOptionDraftState {
  id: string;
  name: string;
  nameTh: string;
  nameEn: string;
  sortOrder: number;
  values: Array<{
    id: string;
    value: string;
    valueTh: string;
    valueEn: string;
    displayType: string;
    colorHex: string;
    sortOrder: number;
  }>;
}

interface ImageDraftState {
  id: string;
  file?: File;
  url: string;
  altText: string;
  sortOrder: number;
  isPrimary: boolean;
  width?: number | null;
  height?: number | null;
  status: "existing" | "pending" | "uploading" | "error";
  error?: string;
}

interface VideoDraftState {
  id?: string;
  file?: File;
  url?: string;
  contentType?: string;
  fileName?: string;
  fileSize?: number;
  status: "existing" | "pending" | "uploading" | "error";
  error?: string;
}

interface VariantBulkState {
  price: string;
  stock: string;
  status: VariantStatus;
}

interface ProductStudioBaseline {
  form: ProductFormState;
  images: ImageDraftState[];
  video: VideoDraftState | null;
  variants: VariantFormState[];
  options: ProductOptionDraftState[];
}

type ProductStudioConfirmation =
  | { type: "discard" }
  | { type: "remove-option"; index: number; label: string; impactedCount: number }
  | { type: "remove-option-value"; optionIndex: number; valueIndex: number; label: string; impactedCount: number }
  | { type: "delete-variant"; variant: VariantFormState; index: number; label: string };

function getProductStudioConfirmationCopy(confirmation: ProductStudioConfirmation, t: Translator) {
  if (confirmation.type === "discard") {
    return {
      title: t("seller.editor.confirm.discardTitle"),
      description: t("seller.editor.confirm.discardDescription"),
      action: t("seller.editor.confirm.discardAction"),
    };
  }
  if (confirmation.type === "remove-option") {
    return {
      title: t("seller.editor.confirm.removeOptionTitle"),
      description: t("seller.editor.confirm.removeOptionDescription")
        .replace("{name}", confirmation.label)
        .replace("{count}", String(confirmation.impactedCount)),
      action: t("seller.editor.confirm.removeAction"),
    };
  }
  if (confirmation.type === "remove-option-value") {
    return {
      title: t("seller.editor.confirm.removeValueTitle"),
      description: t("seller.editor.confirm.removeValueDescription")
        .replace("{name}", confirmation.label)
        .replace("{count}", String(confirmation.impactedCount)),
      action: t("seller.editor.confirm.removeAction"),
    };
  }
  return {
    title: t("seller.editor.confirm.deleteVariantTitle"),
    description: t("seller.editor.confirm.deleteVariantDescription").replace("{name}", confirmation.label),
    action: t("seller.editor.confirm.deleteVariantAction"),
  };
}

const emptyProductForm: ProductFormState = {
  title: "",
  slug: "",
  description: "",
  status: "DRAFT",
  categoryId: "",
  brandId: "",
  titleTh: "",
  titleEn: "",
  descriptionTh: "",
  descriptionEn: "",
  metaTitle: "",
  metaDescription: "",
  warrantyInfo: "",
  condition: "",
  countryOfOrigin: "",
  highlightsText: "",
  attributesText: "",
};

const emptyVariantForm: VariantFormState = {
  sku: "",
  title: "",
  titleTh: "",
  titleEn: "",
  price: "",
  currency: "THB",
  status: "ACTIVE",
  quantityOnHand: "0",
  quantityReserved: 0,
  reorderLevel: "0",
  weightGrams: "",
  lengthMm: "",
  widthMm: "",
  heightMm: "",
  optionValueIds: [],
};

function productToForm(product: SellerProduct): ProductFormState {
  return {
    title: product.title ?? "",
    slug: product.slug ?? "",
    description: product.description ?? "",
    status: product.status as ProductStatus,
    categoryId: product.category?.id ?? product.categoryId ?? "",
    brandId: product.brand?.id ?? product.brandId ?? "",
    titleTh: product.titleTh ?? "",
    titleEn: product.titleEn ?? "",
    descriptionTh: product.descriptionTh ?? "",
    descriptionEn: product.descriptionEn ?? "",
    metaTitle: product.metaTitle ?? "",
    metaDescription: product.metaDescription ?? "",
    warrantyInfo: product.warrantyInfo ?? "",
    condition: product.condition ?? "",
    countryOfOrigin: product.countryOfOrigin ?? "",
    highlightsText: (product.highlights ?? []).map((highlight: { text?: string }) => highlight.text ?? "").filter(Boolean).join("\n"),
    attributesText: (product.attributes ?? []).map((attribute: { attributeKey?: string; displayName?: string; value?: string; isFilterable?: boolean }) => [
      attribute.attributeKey ?? attribute.displayName ?? "",
      attribute.displayName ?? "",
      attribute.value ?? "",
      attribute.isFilterable ? "filterable" : "",
    ].join("|")).join("\n"),
  };
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseHighlights(value: string) {
  return value.split("\n").map((text, index) => ({ text: text.trim(), sortOrder: index })).filter((highlight) => highlight.text);
}

function parseAttributes(value: string) {
  return value
    .split("\n")
    .map((line, index) => {
      const [key, name, attributeValue, filterable] = line.split("|").map((part) => part.trim());
      return {
        attributeKey: key || undefined,
        displayName: name || key || "",
        value: attributeValue || "",
        sortOrder: index,
        isFilterable: filterable?.toLowerCase() === "filterable" || filterable === "true",
      };
    })
    .filter((attribute) => attribute.displayName && attribute.value);
}

function parseAttributeDrafts(value: string): ProductAttributeDraft[] {
  return parseAttributes(value).map((attribute) => ({
    attributeKey: attribute.attributeKey ?? attribute.displayName,
    displayName: attribute.displayName,
    value: attribute.value,
    isFilterable: Boolean(attribute.isFilterable),
  }));
}

function serializeAttributeDrafts(attributes: ProductAttributeDraft[]) {
  return attributes
    .filter((attribute) => attribute.attributeKey.trim() || attribute.displayName.trim() || attribute.value.trim())
    .map((attribute) => [
      attribute.attributeKey.trim() || attribute.displayName.trim(),
      attribute.displayName.trim() || attribute.attributeKey.trim(),
      attribute.value.trim(),
      attribute.isFilterable ? "filterable" : "",
    ].join("|"))
    .join("\n");
}

function toBaselineImage(image: ImageDraftState): ImageDraftState {
  return {
    id: image.id,
    url: image.url,
    altText: image.altText,
    sortOrder: image.sortOrder,
    isPrimary: image.isPrimary,
    width: image.width ?? null,
    height: image.height ?? null,
    status: "existing",
  };
}

function toBaselineVideo(video: VideoDraftState | null): VideoDraftState | null {
  if (!video) return null;
  return {
    id: video.id,
    url: video.url,
    contentType: video.contentType,
    fileName: video.fileName,
    fileSize: video.fileSize,
    status: "existing",
  };
}

function createProductStudioBaseline(
  form: ProductFormState,
  images: ImageDraftState[],
  video: VideoDraftState | null,
  variants: VariantFormState[],
  options: ProductOptionDraftState[],
): ProductStudioBaseline {
  return {
    form: { ...form },
    images: images.map(toBaselineImage),
    video: toBaselineVideo(video),
    variants: variants.map((variant) => ({ ...variant, optionValueIds: [...variant.optionValueIds] })),
    options: options.map((option) => ({ ...option, values: option.values.map((value) => ({ ...value })) })),
  };
}

function productImagesToDrafts(product?: SellerProduct | null): ImageDraftState[] {
  return (product?.images ?? []).map((image, index) => ({
    id: image.id,
    url: image.url,
    altText: image.altText ?? "",
    sortOrder: image.sortOrder ?? index,
    isPrimary: Boolean(image.isPrimary),
    width: image.width ?? null,
    height: image.height ?? null,
    status: "existing",
  }));
}

function productVideoToDraft(product?: SellerProduct | null): VideoDraftState | null {
  const video = product?.video as SellerProductVideo | null | undefined;
  if (!video) return null;
  return {
    id: video.id,
    url: video.url,
    contentType: video.contentType,
    fileName: video.fileName,
    fileSize: video.fileSize,
    status: "existing",
  };
}

function productVariantsToForms(product?: SellerProduct | null): VariantFormState[] {
  return (product?.variants ?? []).map((variant) => ({
    id: variant.id,
    sku: variant.sku ?? "",
    title: variant.title ?? "",
    titleTh: variant.titleTh ?? "",
    titleEn: variant.titleEn ?? "",
    price: String(Number(variant.price ?? 0) / 100),
    currency: variant.currency ?? "THB",
    status: (variant.status ?? "ACTIVE") as VariantStatus,
    quantityOnHand: String(variant.inventory?.quantityOnHand ?? 0),
    quantityReserved: variant.inventory?.quantityReserved ?? 0,
    reorderLevel: String(variant.inventory?.reorderLevel ?? 0),
    weightGrams: variant.weightGrams == null ? "" : String(variant.weightGrams),
    lengthMm: variant.lengthMm == null ? "" : String(variant.lengthMm),
    widthMm: variant.widthMm == null ? "" : String(variant.widthMm),
    heightMm: variant.heightMm == null ? "" : String(variant.heightMm),
    optionValueIds: (variant.optionValues ?? []).map((item: { optionValueId?: string; optionValue?: { id?: string } }) => item.optionValueId ?? item.optionValue?.id ?? "").filter(Boolean),
  }));
}

function productOptionsToDrafts(product?: SellerProduct | null): ProductOptionDraftState[] {
  return (product?.options ?? []).map((option, optionIndex) => ({
    id: option.id ?? `option-${optionIndex}`,
    name: option.name ?? "",
    nameTh: option.nameTh ?? "",
    nameEn: option.nameEn ?? "",
    sortOrder: option.sortOrder ?? optionIndex,
    values: (option.values ?? []).map((value, valueIndex) => ({
      id: value.id ?? `value-${optionIndex}-${valueIndex}`,
      value: value.value ?? "",
      valueTh: value.valueTh ?? "",
      valueEn: value.valueEn ?? "",
      displayType: value.displayType ?? "TEXT",
      colorHex: value.colorHex ?? "",
      sortOrder: value.sortOrder ?? valueIndex,
    })),
  }));
}

function toOptionalNumber(value: string) {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

function toVariantInput(variant: VariantFormState): SellerVariantInput & { status?: VariantStatus } {
  return {
    sku: variant.sku.trim(),
    title: variant.title.trim(),
    titleTh: optionalText(variant.titleTh),
    titleEn: optionalText(variant.titleEn),
    price: Math.round(Number(variant.price || "0") * 100),
    currency: variant.currency.trim() || "THB",
    status: variant.status,
    quantityOnHand: Number(variant.quantityOnHand || "0"),
    reorderLevel: Number(variant.reorderLevel || "0"),
    weightGrams: toOptionalNumber(variant.weightGrams),
    lengthMm: toOptionalNumber(variant.lengthMm),
    widthMm: toOptionalNumber(variant.widthMm),
    heightMm: toOptionalNumber(variant.heightMm),
    optionValueIds: variant.optionValueIds,
  };
}

function getAvailableStock(variant: VariantFormState) {
  return Math.max(0, Number(variant.quantityOnHand || "0") - variant.quantityReserved);
}

function createPreviewUrl(file: File) {
  return typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
}

function normalizeSpecDefinitions(category?: unknown, product?: SellerProduct | null, fetchedSpecs?: CategorySpecDefinition[] | null): CategorySpecDefinition[] {
  const categorySpecs = Array.isArray(fetchedSpecs)
    ? fetchedSpecs
    : ((category as { attributeDefinitions?: CategorySpecDefinition[]; specs?: CategorySpecDefinition[] } | undefined)?.attributeDefinitions
    ?? (category as { specs?: CategorySpecDefinition[] } | undefined)?.specs
    ?? []);
  if (categorySpecs.length) {
    return categorySpecs
      .filter((spec) => spec.attributeKey)
      .map((spec) => ({ ...spec, valueType: normalizeSpecValueType(spec.valueType) }))
      .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));
  }
  return ((product?.attributes ?? []) as Array<{ attributeKey?: string; displayName?: string; isFilterable?: boolean; sortOrder?: number }>)
    .filter((attribute) => attribute.attributeKey || attribute.displayName)
    .map((attribute, index) => ({
      attributeKey: attribute.attributeKey ?? attribute.displayName ?? `attribute-${index + 1}`,
      displayName: attribute.displayName ?? attribute.attributeKey ?? `Attribute ${index + 1}`,
      valueType: "TEXT",
      isRequired: false,
      isFilterable: Boolean(attribute.isFilterable),
      sortOrder: attribute.sortOrder ?? index,
    }));
}

function normalizeSpecValueType(valueType?: string | null): CategorySpecValueType {
  const normalized = valueType?.trim().toUpperCase().replaceAll("-", "_");
  if (normalized === "NUMBER" || normalized === "BOOLEAN" || normalized === "SELECT" || normalized === "MULTI_SELECT") return normalized;
  return "TEXT";
}

function getLocalizedText(locale: AppLocale, value?: string | null, valueTh?: string | null, valueEn?: string | null) {
  return locale === "th"
    ? valueTh || value || valueEn || ""
    : valueEn || value || valueTh || "";
}

function getSpecDisplayName(spec: CategorySpecDefinition, locale: AppLocale = "en") {
  return getLocalizedText(locale, spec.displayName, spec.displayNameTh, spec.displayNameEn) || spec.attributeKey;
}

function getSpecInputLabel(spec: CategorySpecDefinition, locale: AppLocale) {
  const name = getSpecDisplayName(spec, locale);
  return spec.unit ? `${name} (${spec.unit})` : name;
}

function getSpecHelperText(spec: CategorySpecDefinition, t: Translator) {
  const valueType = normalizeSpecValueType(spec.valueType);
  if (valueType === "NUMBER") return spec.unit
    ? t("seller.editor.spec.numericWithUnit").replace("{unit}", spec.unit)
    : t("seller.editor.spec.numeric");
  if (valueType === "BOOLEAN") return t("seller.editor.spec.boolean");
  if (valueType === "MULTI_SELECT") return t("seller.editor.spec.multiSelect");
  return "";
}

function getAllowedSpecValues(spec: CategorySpecDefinition) {
  if (Array.isArray(spec.allowedValues)) return spec.allowedValues.map(String).filter(Boolean);
  if (typeof spec.allowedValues === "string") {
    try {
      const parsed = JSON.parse(spec.allowedValues);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return spec.allowedValues.split(",").map((value) => value.trim()).filter(Boolean);
    }
  }
  return [];
}

function getAttributeValue(form: ProductFormState, key: string) {
  return parseAttributeDrafts(form.attributesText).find((attribute) => attribute.attributeKey === key)?.value ?? "";
}

function updateAttributeValue(form: ProductFormState, spec: CategorySpecDefinition, value: string, locale: AppLocale): ProductFormState {
  const attributes = parseAttributeDrafts(form.attributesText);
  const key = spec.attributeKey;
  const existingIndex = attributes.findIndex((attribute) => attribute.attributeKey === key);
  const nextAttribute = {
    attributeKey: key,
    displayName: getSpecDisplayName(spec, locale),
    value,
    isFilterable: Boolean(spec.isFilterable),
  };
  const nextAttributes = existingIndex >= 0
    ? attributes.map((attribute, index) => index === existingIndex ? nextAttribute : attribute)
    : [...attributes, nextAttribute];
  return { ...form, attributesText: serializeAttributeDrafts(nextAttributes) };
}

function getCategorySpecKeys(specs: CategorySpecDefinition[]) {
  return new Set(specs.map((spec) => spec.attributeKey));
}

function getAdditionalAttributesText(form: ProductFormState, specs: CategorySpecDefinition[]) {
  const specKeys = getCategorySpecKeys(specs);
  return serializeAttributeDrafts(parseAttributeDrafts(form.attributesText).filter((attribute) => !specKeys.has(attribute.attributeKey)));
}

function updateAdditionalAttributesText(form: ProductFormState, specs: CategorySpecDefinition[], value: string): ProductFormState {
  const specKeys = getCategorySpecKeys(specs);
  const categoryAttributes = parseAttributeDrafts(form.attributesText).filter((attribute) => specKeys.has(attribute.attributeKey));
  const additionalAttributes = parseAttributeDrafts(value).filter((attribute) => !specKeys.has(attribute.attributeKey));
  return { ...form, attributesText: serializeAttributeDrafts([...categoryAttributes, ...additionalAttributes]) };
}

function getRequiredSpecMissing(form: ProductFormState, specs: CategorySpecDefinition[], locale: AppLocale) {
  return specs
    .filter((spec) => spec.isRequired)
    .filter((spec) => !getAttributeValue(form, spec.attributeKey).trim())
    .map((spec) => getSpecDisplayName(spec, locale));
}

function getReadinessChecks(form: ProductFormState, images: ImageDraftState[], variants: VariantFormState[], requiredSpecMissing: string[], t: Translator): ReadinessCheck[] {
  return [
    { id: "category", label: t("seller.editor.readiness.category"), passed: Boolean(form.categoryId), missingLabel: t("seller.editor.readiness.missingCategory") },
    { id: "required-specs", label: t("seller.editor.readiness.requiredSpecs"), passed: requiredSpecMissing.length === 0, missingLabel: requiredSpecMissing.length ? t("seller.editor.readiness.missingRequiredSpecs").replace("{items}", requiredSpecMissing.join(", ")) : t("seller.editor.readiness.missingRequiredSpecsFallback") },
    { id: "primary-image", label: t("seller.editor.readiness.primaryImage"), passed: images.some((image) => image.isPrimary), missingLabel: t("seller.editor.readiness.missingPrimaryImage") },
    { id: "active-priced-variant", label: t("seller.editor.readiness.activeVariant"), passed: variants.some((variant) => variant.status === "ACTIVE" && Number(variant.price || "0") > 0), missingLabel: t("seller.editor.readiness.missingActiveVariant") },
  ];
}

function getPublishReadiness(checks: ReadinessCheck[]) {
  return checks.filter((check) => !check.passed).map((check) => check.missingLabel);
}

function getOptionCombinationKey(variant: VariantFormState) {
  return variant.optionValueIds.filter(Boolean).sort().join("|");
}

function getVariantCombinationLabel(variant: VariantFormState, options: ProductOptionDraftState[], locale: AppLocale, t: Translator) {
  const labels = options.flatMap((option) => option.values.filter((value) => variant.optionValueIds.includes(value.id)).map((value) => {
    const optionName = getLocalizedText(locale, option.name, option.nameTh, option.nameEn) || t("seller.editor.variant.optionFallback");
    const optionValue = getLocalizedText(locale, value.value, value.valueTh, value.valueEn) || t("seller.editor.variant.valueFallback");
    return `${optionName}: ${optionValue}`;
  }));
  return labels.length ? labels.join(" / ") : t("seller.editor.variant.baseVariant");
}

function getDuplicateOptionCombinationError(variants: VariantFormState[], t: Translator) {
  const seen = new Set<string>();
  for (const variant of variants) {
    const key = getOptionCombinationKey(variant);
    if (!key) continue;
    if (seen.has(key)) return t("seller.editor.error.duplicateCombination");
    seen.add(key);
  }
  return "";
}

function getDuplicateSkuIndexes(variants: VariantFormState[]) {
  const counts = new Map<string, number>();
  variants.forEach((variant) => {
    const sku = variant.sku.trim().toLowerCase();
    if (sku) counts.set(sku, (counts.get(sku) ?? 0) + 1);
  });
  return new Set(variants.flatMap((variant, index) => {
    const sku = variant.sku.trim().toLowerCase();
    return sku && (counts.get(sku) ?? 0) > 1 ? [index] : [];
  }));
}

function getDuplicateCombinationIndexes(variants: VariantFormState[]) {
  const counts = new Map<string, number>();
  variants.forEach((variant) => {
    const key = getOptionCombinationKey(variant);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return new Set(variants.flatMap((variant, index) => {
    const key = getOptionCombinationKey(variant);
    return key && (counts.get(key) ?? 0) > 1 ? [index] : [];
  }));
}

function getVariantRowErrors(variant: VariantFormState, index: number, duplicateSkuIndexes: Set<number>, duplicateCombinationIndexes: Set<number>, t: Translator) {
  const errors: string[] = [];
  if (!variant.sku.trim()) errors.push(t("seller.editor.error.skuRequired"));
  if (duplicateSkuIndexes.has(index)) errors.push(t("seller.editor.error.duplicateSku"));
  if (duplicateCombinationIndexes.has(index)) errors.push(t("seller.editor.error.duplicateOptionCombination"));
  if (Number(variant.price || "0") < 0) errors.push(t("seller.editor.error.priceNegative"));
  if (Number(variant.quantityOnHand || "0") < 0) errors.push(t("seller.editor.error.stockNegative"));
  return errors;
}

function buildOptionCombinations(options: ProductOptionDraftState[]) {
  const activeOptions = options.slice(0, 2).map((option) => option.values.filter((value) => value.value.trim()).map((value) => value.id)).filter((values) => values.length);
  if (!activeOptions.length) return [];
  if (activeOptions.length === 1) return activeOptions[0].map((id) => [id]);
  return activeOptions[0].flatMap((firstId) => activeOptions[1].map((secondId) => [firstId, secondId]));
}

function buildGeneratedVariant(combination: string[], index: number, options: ProductOptionDraftState[], t: Translator): VariantFormState {
  const labels = options.flatMap((option) => option.values.filter((value) => combination.includes(value.id)).map((value) => value.value.trim())).filter(Boolean);
  return {
    ...emptyVariantForm,
    sku: `SKU-${index + 1}`,
    title: labels.join(" / ") || t("seller.editor.variant.generatedName").replace("{index}", String(index + 1)),
    optionValueIds: combination,
  };
}

function getLatestModerationReason(product?: SellerProduct | null) {
  const actions = ((product as { moderationCase?: { actions?: Array<{ action?: string; note?: string | null }> } } | null)?.moderationCase?.actions ?? []);
  return actions.find((action) => action.action === "REJECT" || action.action === "SUSPEND")?.note ?? null;
}

function toProductOptionsInput(options: ProductOptionDraftState[]): SellerProductOptionInput[] {
  return options
    .map((option, optionIndex) => ({
      name: option.name.trim(),
      nameTh: optionalText(option.nameTh),
      nameEn: optionalText(option.nameEn),
      sortOrder: optionIndex,
      values: option.values
        .map((value, valueIndex) => ({
          value: value.value.trim(),
          valueTh: optionalText(value.valueTh),
          valueEn: optionalText(value.valueEn),
          displayType: value.displayType.trim() || "TEXT",
          colorHex: optionalText(value.colorHex),
          sortOrder: valueIndex,
        }))
        .filter((value) => value.value),
    }))
    .filter((option) => option.name && option.values.length);
}

function toProductInput(form: ProductFormState): SellerProductInput {
  return {
    title: form.title.trim(),
    slug: form.slug.trim() || undefined,
    description: optionalText(form.description),
    categoryId: optionalText(form.categoryId),
    brandId: optionalText(form.brandId),
    titleTh: optionalText(form.titleTh),
    titleEn: optionalText(form.titleEn),
    descriptionTh: optionalText(form.descriptionTh),
    descriptionEn: optionalText(form.descriptionEn),
    metaTitle: optionalText(form.metaTitle),
    metaDescription: optionalText(form.metaDescription),
    warrantyInfo: optionalText(form.warrantyInfo),
    condition: optionalText(form.condition),
    countryOfOrigin: optionalText(form.countryOfOrigin),
    highlights: parseHighlights(form.highlightsText),
    attributes: parseAttributes(form.attributesText),
  };
}

function formatMoney(cents: number | bigint | undefined, currency = "THB") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(cents ?? 0) / 100);
}

function StatusPill({ value }: { value: string }) {
  const t = useTranslations();
  const labels: Record<string, string> = {
    DRAFT: t("seller.products.statusDraft"), PENDING_REVIEW: t("seller.products.statusPendingReview"), ACTIVE: t("seller.manage.status.active"),
    REJECTED: t("seller.manage.status.rejected"), SUSPENDED: t("seller.products.suspended"), ARCHIVED: t("seller.products.archivedStatus"),
  };
  return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{labels[value] ?? value.replaceAll("_", " ")}</span>;
}

function ErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations();
  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p role="alert" className="text-sm text-red-700">{error instanceof Error ? error.message : t("seller.editor.error.load")}</p>
        <Button type="button" variant="outline" onClick={retry}>{t("seller.editor.retry")}</Button>
      </CardContent>
    </Card>
  );
}

function CategorySpecField({
  spec,
  fieldId,
  value,
  isMissing = false,
  onChange,
}: {
  spec: CategorySpecDefinition;
  fieldId: string;
  value: string;
  isMissing?: boolean;
  onChange: (value: string) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const valueType = normalizeSpecValueType(spec.valueType);
  const allowedValues = getAllowedSpecValues(spec);
  const helperText = getSpecHelperText(spec, t);
  const displayName = getSpecDisplayName(spec, locale);
  const label = `${getSpecInputLabel(spec, locale)}${spec.isRequired ? " *" : ""}`;

  return (
    <Field label={label} htmlFor={fieldId}>
      {valueType === "BOOLEAN" ? (
        <Select name={fieldId} value={value || "NONE"} onValueChange={(nextValue) => onChange(nextValue === "NONE" ? "" : nextValue)}>
          <SelectTrigger id={fieldId} aria-label={displayName}><SelectValue placeholder={t("seller.editor.spec.selectValue")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">{t("seller.editor.spec.noValue")}</SelectItem>
            <SelectItem value="true">{t("seller.editor.spec.true")}</SelectItem>
            <SelectItem value="false">{t("seller.editor.spec.false")}</SelectItem>
          </SelectContent>
        </Select>
      ) : valueType === "SELECT" && allowedValues.length ? (
        <Select name={fieldId} value={value || "NONE"} onValueChange={(nextValue) => onChange(nextValue === "NONE" ? "" : nextValue)}>
          <SelectTrigger id={fieldId} aria-label={displayName}><SelectValue placeholder={t("seller.editor.spec.selectValue")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">{t("seller.editor.spec.noValue")}</SelectItem>
            {allowedValues.map((allowedValue) => <SelectItem key={allowedValue} value={allowedValue}>{allowedValue}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : valueType === "MULTI_SELECT" ? (
        <Textarea id={fieldId} name={fieldId} value={value} onChange={(event) => onChange(event.target.value)} rows={2} aria-invalid={isMissing} />
      ) : (
        <Input id={fieldId} name={fieldId} type={valueType === "NUMBER" ? "number" : "text"} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={isMissing} className={valueType === "NUMBER" ? "tabular-nums" : undefined} />
      )}
      {helperText ? <p className="text-xs text-slate-500">{helperText}</p> : null}
      {isMissing ? <p role="alert" className="text-xs text-red-600">{t("seller.editor.spec.required").replace("{name}", displayName)}</p> : null}
    </Field>
  );
}

function getVariantPriceContext(product: SellerProduct) {
  const variants = product.variants ?? [];
  if (!variants.length) return "No variants";
  const prices = variants.map((variant) => Number(variant.price ?? 0));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const currency = variants[0]?.currency ?? "THB";
  return min === max ? formatMoney(min, currency) : `${formatMoney(min, currency)} - ${formatMoney(max, currency)}`;
}

function getVariantStockContext(product: SellerProduct, labels?: { noStock: string; available: string }) {
  const variants = product.variants ?? [];
  if (!variants.length) return labels?.noStock ?? "No stock";
  const available = variants.reduce((total, variant) => total + ((variant.inventory?.quantityOnHand ?? 0) - (variant.inventory?.quantityReserved ?? 0)), 0);
  return `${available} ${labels?.available ?? "available"}`;
}

export function SellerProductsPage() {
  const t = useTranslations();
  const [status, setStatus] = useState<"" | ProductStatus>("");
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [archiveTarget, setArchiveTarget] = useState<SellerProduct | null>(null);
  const query = useSellerProducts({ q, status, cursor });
  const archiveProduct = useArchiveSellerProduct();
  const products = query.data?.data ?? [];

  function confirmArchiveProduct() {
    if (!archiveTarget) return;
    archiveProduct.mutate(archiveTarget.id, {
      onSuccess: () => {
        toast.success(t("seller.products.archived"));
        setArchiveTarget(null);
      },
        onError: (error: unknown) => toast.error(error instanceof Error ? error.message : t("seller.products.archiveError")),
    });
  }

  const columns = useMemo<ColumnDef<SellerProduct>[]>(() => [
    {
      accessorKey: "title",
      header: t("seller.products.product"),
      cell: ({ row }) => (
        <div className="min-w-52">
          <p className="font-medium text-slate-950">{row.original.title}</p>
          <p className="text-xs text-slate-500">{row.original.slug}</p>
          <p className="mt-1 text-xs text-slate-500">{row.original.category?.name ?? t("seller.products.noCategory")} · {row.original.brand?.name ?? t("seller.products.noBrand")}</p>
        </div>
      ),
    },
    { accessorKey: "status", header: t("seller.products.status"), cell: ({ row }) => <StatusPill value={row.original.status} /> },
    {
      id: "assets",
      header: t("seller.products.assets"),
      cell: ({ row }) => <div className="text-sm"><p>{row.original.images?.length ?? 0} {t("seller.products.images")}</p><p className="text-xs text-slate-500">{row.original.variants.length} {t("seller.products.variants")}</p></div>,
    },
    {
      id: "priceStock",
      header: t("seller.products.priceStock"),
      cell: ({ row }) => <div className="min-w-36 text-sm"><p>{getVariantPriceContext(row.original)}</p><p className="text-xs text-slate-500">{getVariantStockContext(row.original, { noStock: t("seller.products.noStock"), available: t("seller.products.available") })}</p></div>,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t("seller.products.actions")}</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button asChild variant="outline" size="sm" aria-label={t("seller.products.editLabel").replace("{title}", row.original.title)}>
            <Link href={`/seller/products/${row.original.id}`}>
              <EditIcon className="size-4" />
              <span className="sr-only">{t("seller.products.edit")}</span>
            </Link>
          </Button>
          <Button type="button" variant="outline" size="sm" aria-label={t("seller.products.archiveLabel").replace("{title}", row.original.title)} onClick={() => setArchiveTarget(row.original)} disabled={row.original.status === "ARCHIVED"}>
            <ArchiveIcon className="size-4" />
            <span className="sr-only">{t("seller.products.archive")}</span>
          </Button>
        </div>
      ),
    },
  ], [t]);

  return (
    <>
      <SellerPageHeader title={t("seller.products.title")} description={t("seller.products.description")} />
      {query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      <SellerProductQuestionsPanel products={products} />
      <Card className="rounded-lg border-slate-200 bg-white">
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={products}
            isLoading={query.isLoading}
            loadingMessage={t("seller.products.loading")}
            emptyMessage={t("seller.products.empty")}
            pageSize={10}
            className="overflow-x-auto"
            labels={{
              showing: t("common.showing"),
              of: t("common.of"),
              rows: t("common.rows"),
              previous: t("common.previous"),
              next: t("common.next"),
              previousPage: t("common.previousPage"),
              nextPage: t("common.nextPage"),
              sortBy: t("common.sortBy"),
            }}
            renderToolbar={() => (
              <>
                <div className="flex w-full flex-col gap-3 sm:flex-row">
                  <Input value={q} onChange={(event) => { setQ(event.target.value); setCursor(undefined); }} placeholder={t("seller.products.search")} aria-label={t("seller.products.search")} className="sm:max-w-sm" />
                  <Select value={status || "ALL"} onValueChange={(value) => { setStatus(value === "ALL" ? "" : value as ProductStatus); setCursor(undefined); }}>
                    <SelectTrigger className="sm:w-48" aria-label={t("seller.products.filterStatus")}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">{t("seller.products.allStatuses")}</SelectItem>
                      <SelectItem value="DRAFT">{t("seller.products.statusDraft")}</SelectItem>
                      <SelectItem value="PENDING_REVIEW">{t("seller.products.statusPendingReview")}</SelectItem>
                      <SelectItem value="ACTIVE">{t("seller.manage.status.active")}</SelectItem>
                      <SelectItem value="REJECTED">{t("seller.manage.status.rejected")}</SelectItem>
                      <SelectItem value="SUSPENDED">{t("seller.products.suspended")}</SelectItem>
                      <SelectItem value="ARCHIVED">{t("seller.products.archivedStatus")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button asChild className="w-full sm:w-auto">
                  <Link href="/seller/analytics/products">
                    <BarChart3Icon className="size-4" />
                    {t("seller.products.analytics")}
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/seller/products/new">
                    <PlusIcon className="size-4" />
                    {t("seller.products.create")}
                  </Link>
                </Button>
              </>
            )}
          />
          {query.data?.meta.nextCursor ? (
            <div className="mt-4 flex justify-end">
              <Button type="button" variant="outline" onClick={() => setCursor(query.data.meta.nextCursor ?? undefined)}>{t("seller.products.nextPage")}</Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <AlertDialog open={Boolean(archiveTarget)} onOpenChange={(open) => { if (!open) setArchiveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("seller.products.archiveTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("seller.products.archiveDescription").replace("{title}", archiveTarget?.title ?? t("seller.products.thisProduct"))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveProduct.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={archiveProduct.isPending} onClick={confirmArchiveProduct}>
              {archiveProduct.isPending ? t("seller.products.archiving") : t("seller.products.archiveTitle")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SellerProductQuestionsPanel({ products }: { products: SellerProduct[] }) {
  const t = useTranslations();
  const activeProducts = products.filter((product) => product.status === "ACTIVE").slice(0, 6);

  if (!activeProducts.length) {
    return (
      <Card className="mb-4 rounded-lg border-slate-200 bg-white">
        <CardHeader>
          <CardTitle>{t("seller.products.questionsTitle")}</CardTitle>
          <p className="text-sm text-slate-500">{t("seller.products.questionsActiveDescription")}</p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">{t("seller.products.noActiveQuestions")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-4 rounded-lg border-slate-200 bg-white">
      <CardHeader>
        <CardTitle>{t("seller.products.questionsTitle")}</CardTitle>
        <p className="text-sm text-slate-500">{t("seller.products.questionsDescription")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeProducts.map((product) => (
          <SellerProductQuestionList key={product.id} product={product} />
        ))}
      </CardContent>
    </Card>
  );
}

function SellerProductQuestionList({ product }: { product: SellerProduct }) {
  const t = useTranslations();
  const query = useSellerProductQuestions(product.id);
  const unanswered = (query.data ?? []).filter((question) => question.answers.length === 0);

  if (query.isLoading) {
    return <p className="text-sm text-slate-500">{t("seller.products.loadingQuestions").replace("{title}", product.title)}</p>;
  }

  if (query.error) {
    return (
      <div className="rounded-md border border-red-100 bg-red-50 p-3">
        <p className="text-sm font-medium text-red-700">{product.title}</p>
        <p className="text-sm text-red-600">{query.error.message}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>{t("seller.products.retry")}</Button>
      </div>
    );
  }

  if (!unanswered.length) {
    return (
      <div className="rounded-md border border-slate-200 p-3">
        <p className="text-sm font-medium text-slate-900">{product.title}</p>
        <p className="text-sm text-slate-500">{t("seller.products.noUnanswered")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-slate-200 p-3">
      <p className="text-sm font-medium text-slate-900">{product.title}</p>
      {unanswered.map((question) => (
        <SellerProductQuestionAnswerForm key={question.id} productId={product.id} question={question} />
      ))}
    </div>
  );
}

function SellerProductQuestionAnswerForm({ productId, question }: { productId: string; question: BuyerProductQuestion }) {
  const t = useTranslations();
  const answerQuestion = useAnswerSellerProductQuestion();
  const [answer, setAnswer] = useState("");
  const trimmed = answer.trim();

  function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmed) return;
    answerQuestion.mutate({ productId, questionId: question.id, answer: trimmed }, {
      onSuccess: () => setAnswer(""),
      onError: (error: unknown) => toast.error(error instanceof Error ? error.message : t("seller.products.answerError")),
    });
  }

  return (
    <form className="space-y-2 rounded-md bg-slate-50 p-3" onSubmit={submitAnswer}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">{t("seller.products.buyerQuestion")}</p>
        <p className="mt-1 text-sm text-slate-900">{question.question}</p>
      </div>
      <Field label={`${t("seller.products.answerFrom")} ${question.user.name}`} htmlFor={`answer-${question.id}`}>
        <Textarea
          id={`answer-${question.id}`}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          disabled={answerQuestion.isPending}
          placeholder={t("seller.products.answerPlaceholder")}
        />
      </Field>
      {answerQuestion.error ? <p className="text-sm text-red-600">{answerQuestion.error.message}</p> : null}
      {answerQuestion.isSuccess && !answerQuestion.error ? <p className="text-sm text-green-700">{t("seller.products.answerSubmitted")}</p> : null}
      <Button type="submit" disabled={!trimmed || answerQuestion.isPending}>
        {answerQuestion.isPending ? t("seller.products.submitting") : t("seller.products.submitAnswer")}
      </Button>
    </form>
  );
}

export function SellerProductCreatePage() {
  const t = useTranslations();
  const router = useRouter();
  const createProduct = useCreateSellerProduct();
  const [error, setError] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    createProduct.mutate(
      {
        title: t("seller.editor.untitledDraft"),
      },
      {
        onSuccess: (product) => {
          toast.success(t("seller.editor.success.draftCreated"));
          router.push(`/seller/products/${product.id}`);
        },
        onError: (mutationError: unknown) => {
          setError(mutationError instanceof Error ? mutationError.message : t("seller.editor.error.draftCreate"));
        },
      },
    );
  }, [createProduct, router, t]);

  return (
    <>
      <SellerPageHeader title={t("seller.editor.createTitle")} description={t("seller.editor.createDescription")} />
      <Card className="rounded-lg border-slate-200 bg-white">
        <CardContent className="space-y-4 pt-6">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-950">{createProduct.isPending ? t("seller.editor.creatingDraft") : t("seller.editor.draftPreparation")}</p>
            <p className="mt-1 text-sm text-slate-600">{t("seller.editor.draftPreparationDescription")}</p>
          </div>
          {error ? (
            <div className="flex flex-col gap-3 rounded-md border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p role="alert" className="text-sm text-red-700">{error}</p>
              <Button type="button" variant="outline" onClick={() => {
                setError("");
                createProduct.mutate(
                  { title: t("seller.editor.untitledDraft") },
                  {
                    onSuccess: (product) => router.push(`/seller/products/${product.id}`),
                    onError: (mutationError: unknown) => setError(mutationError instanceof Error ? mutationError.message : t("seller.editor.error.draftCreate")),
                  },
                );
              }} disabled={createProduct.isPending}>
                {t("seller.editor.retry")}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}

export function SellerProductEditPage({ productId }: { productId: string }) {
  return <SellerProductFormPage mode="edit" productId={productId} />;
}

function getDraftStatusLabel(status: ImageDraftState["status"] | VideoDraftState["status"], t: Translator) {
  const labels = {
    existing: t("seller.products.completed"),
    pending: t("seller.editor.media.pending"),
    uploading: t("seller.editor.media.uploading"),
    error: t("seller.editor.media.error"),
  };
  return labels[status];
}

function SellerProductFormPage({ mode, productId }: { mode: "create" | "edit"; productId?: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const productsQuery = useSellerProducts({ limit: 50 });
  const productQuery = useSellerProduct(mode === "edit" ? productId : undefined);
  const categoriesQuery = useSellerCategories();
  const brandsQuery = useSellerBrands();
  const createProduct = useCreateSellerProduct();
  const updateProduct = useUpdateSellerProduct();
  const createVariant = useCreateSellerVariant();
  const updateVariant = useUpdateSellerVariant();
  const deleteVariant = useDeleteSellerVariant();
  const updateVariantStock = useUpdateSellerVariantStock();
  const uploadImage = useUploadAndCreateSellerProductImage();
  const updateImageOrder = useUpdateSellerProductImagesOrder();
  const updateImage = useUpdateSellerProductImage();
  const deleteImage = useDeleteSellerProductImage();
  const uploadVideo = useUploadAndUpsertSellerProductVideo();
  const deleteVideo = useDeleteSellerProductVideo();
  const updateOptions = useUpdateSellerProductOptions();
  const publishProduct = usePublishSellerProduct();
  const product = mode === "edit" ? (productQuery.data ?? (productsQuery.data?.data ?? []).find((item) => item.id === productId)) : null;
  const initialForm = useMemo(() => product ? productToForm(product) : emptyProductForm, [product]);
  const [form, setForm] = useState<ProductFormState>(initialForm);
  const [createdProduct, setCreatedProduct] = useState<SellerProduct | null>(null);
  const [seedProductId, setSeedProductId] = useState<string | undefined>();
  const [formError, setFormError] = useState("");
  const [images, setImages] = useState<ImageDraftState[]>(() => productImagesToDrafts(product));
  const [video, setVideo] = useState<VideoDraftState | null>(() => productVideoToDraft(product));
  const [variants, setVariants] = useState<VariantFormState[]>(() => productVariantsToForms(product));
  const [options, setOptions] = useState<ProductOptionDraftState[]>(() => productOptionsToDrafts(product));
  const [baseline, setBaseline] = useState<ProductStudioBaseline>(() => createProductStudioBaseline(
    initialForm,
    productImagesToDrafts(product),
    productVideoToDraft(product),
    productVariantsToForms(product),
    productOptionsToDrafts(product),
  ));
  const [confirmation, setConfirmation] = useState<ProductStudioConfirmation | null>(null);
  const [mediaError, setMediaError] = useState("");
  const [variantError, setVariantError] = useState("");
  const [optionError, setOptionError] = useState("");
  const [bulk, setBulk] = useState<VariantBulkState>({ price: "", stock: "", status: DEFAULT_BULK_STATUS });
  const [isDraggingImages, setIsDraggingImages] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const categorySpecsQuery = useSellerCategorySpecs(form.categoryId || null);
  const workingProduct = createdProduct ?? product;
  const workingProductId = workingProduct?.id ?? productId;

  useEffect(() => {
    if (mode === "edit" && product?.id && seedProductId !== product.id) {
      setSeedProductId(product.id);
      setForm(initialForm);
      setImages(productImagesToDrafts(product));
      setVideo(productVideoToDraft(product));
      setVariants(productVariantsToForms(product));
      setOptions(productOptionsToDrafts(product));
      setBaseline(createProductStudioBaseline(
        initialForm,
        productImagesToDrafts(product),
        productVideoToDraft(product),
        productVariantsToForms(product),
        productOptionsToDrafts(product),
      ));
    }
  }, [initialForm, mode, product?.id, seedProductId]);

  const selectedCategory = useMemo(() => (categoriesQuery.data ?? []).find((category) => category.id === form.categoryId) ?? workingProduct?.category ?? null, [categoriesQuery.data, form.categoryId, workingProduct?.category]);
  const categorySpecs = useMemo(() => normalizeSpecDefinitions(selectedCategory, workingProduct, categorySpecsQuery.data), [selectedCategory, workingProduct, categorySpecsQuery.data]);
  const requiredSpecs = useMemo(() => categorySpecs.filter((spec) => spec.isRequired), [categorySpecs]);
  const optionalSpecs = useMemo(() => categorySpecs.filter((spec) => !spec.isRequired), [categorySpecs]);
  const requiredSpecMissing = useMemo(() => getRequiredSpecMissing(form, categorySpecs, locale), [form, categorySpecs, locale]);
  const readinessChecks = useMemo(() => getReadinessChecks(form, images, variants, requiredSpecMissing, t), [form, images, variants, requiredSpecMissing, t]);
  const readinessMissing = useMemo(() => getPublishReadiness(readinessChecks), [readinessChecks]);
  const duplicateCombinationError = getDuplicateOptionCombinationError(variants, t);
  const duplicateSkuIndexes = useMemo(() => getDuplicateSkuIndexes(variants), [variants]);
  const duplicateCombinationIndexes = useMemo(() => getDuplicateCombinationIndexes(variants), [variants]);
  const hasPrimaryImage = images.some((image) => image.isPrimary);
  const generatedCombinationCount = buildOptionCombinations(options).length;
  const moderationReason = getLatestModerationReason(workingProduct);
  const currentStudioSnapshot = createProductStudioBaseline(form, images, video, variants, options);
  const dirty = JSON.stringify(currentStudioSnapshot) !== JSON.stringify(baseline);
  const isSaving = createProduct.isPending || updateProduct.isPending || createVariant.isPending || updateVariant.isPending || updateVariantStock.isPending || uploadImage.isPending || updateImage.isPending || updateImageOrder.isPending || deleteImage.isPending || uploadVideo.isPending || deleteVideo.isPending || deleteVariant.isPending || updateOptions.isPending || publishProduct.isPending;
  const saveState = isSaving ? t("seller.editor.saving") : dirty ? t("seller.editor.unsaved") : t("seller.editor.saved");

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);

  function cancel() {
    if (dirty) {
      setConfirmation({ type: "discard" });
      return;
    }
    router.push("/seller/products");
  }

  function addOption() {
    setOptionError("");
    if (options.length >= 2) {
      setOptionError(t("seller.editor.error.axesLimit"));
      return;
    }
    setOptions((current) => [...current, {
      id: `option-${Date.now()}`,
      name: "",
      nameTh: "",
      nameEn: "",
      sortOrder: current.length,
      values: [{ id: `value-${Date.now()}`, value: "", valueTh: "", valueEn: "", displayType: "TEXT", colorHex: "", sortOrder: 0 }],
    }]);
  }

  function updateOptionDraft(index: number, patch: Partial<ProductOptionDraftState>) {
    setOptions((current) => current.map((option, optionIndex) => optionIndex === index ? { ...option, ...patch } : option));
  }

  function addOptionValue(optionIndex: number) {
    setOptions((current) => current.map((option, index) => index === optionIndex ? {
      ...option,
      values: [...option.values, { id: `value-${Date.now()}`, value: "", valueTh: "", valueEn: "", displayType: "TEXT", colorHex: "", sortOrder: option.values.length }],
    } : option));
  }

  function updateOptionValueDraft(optionIndex: number, valueIndex: number, patch: Partial<ProductOptionDraftState["values"][number]>) {
    setOptions((current) => current.map((option, index) => index === optionIndex ? {
      ...option,
      values: option.values.map((value, currentValueIndex) => currentValueIndex === valueIndex ? { ...value, ...patch } : value),
    } : option));
  }

  function removeOption(index: number) {
    const option = options[index];
    const impacted = variants.filter((variant) => option.values.some((value) => variant.optionValueIds.includes(value.id)));
    if (impacted.length) {
      setConfirmation({ type: "remove-option", index, label: option.name || t("seller.editor.confirm.thisOption"), impactedCount: impacted.length });
      return;
    }
    performRemoveOption(index);
  }

  function performRemoveOption(index: number) {
    const option = options[index];
    if (!option) return;
    setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index));
    setVariants((current) => current.map((variant) => ({ ...variant, optionValueIds: variant.optionValueIds.filter((id) => !option.values.some((value) => value.id === id)) })));
  }

  function removeOptionValue(optionIndex: number, valueIndex: number) {
    const value = options[optionIndex]?.values[valueIndex];
    const impacted = variants.filter((variant) => variant.optionValueIds.includes(value?.id ?? ""));
    if (impacted.length) {
      setConfirmation({ type: "remove-option-value", optionIndex, valueIndex, label: value?.value || t("seller.editor.confirm.thisValue"), impactedCount: impacted.length });
      return;
    }
    performRemoveOptionValue(optionIndex, valueIndex);
  }

  function performRemoveOptionValue(optionIndex: number, valueIndex: number) {
    const value = options[optionIndex]?.values[valueIndex];
    setOptions((current) => current.map((option, index) => index === optionIndex ? {
      ...option,
      values: option.values.filter((_, currentValueIndex) => currentValueIndex !== valueIndex),
    } : option));
    if (value) {
      setVariants((current) => current.map((variant) => ({ ...variant, optionValueIds: variant.optionValueIds.filter((id) => id !== value.id) })));
    }
  }

  function saveOptions() {
    setOptionError("");
    if (!workingProductId) {
      setOptionError(t("seller.editor.error.draftBeforeOptions"));
      return;
    }
    const input = toProductOptionsInput(options);
    if (options.length && !input.length) {
      setOptionError(t("seller.editor.error.optionRequirements"));
      return;
    }
    updateOptions.mutate({ productId: workingProductId, options: input }, {
      onSuccess: (updatedProduct: SellerProduct) => {
        const savedOptions = productOptionsToDrafts(updatedProduct);
        setOptions(savedOptions);
        setBaseline((current) => ({ ...current, options: savedOptions }));
        toast.success(t("seller.editor.success.optionsSaved"));
      },
      onError: (error: unknown) => setOptionError(error instanceof Error ? error.message : t("seller.editor.error.optionsSave")),
    });
  }

  function saveImageOrder() {
    setMediaError("");
    if (!workingProductId) {
      setMediaError(t("seller.editor.error.draftBeforeReorder"));
      return;
    }
    const existingImages = images.filter((image) => image.status === "existing");
    updateImageOrder.mutate({
      productId: workingProductId,
      images: existingImages.map((image, index) => ({ id: image.id, sortOrder: index })),
      primaryImageId: existingImages.find((image) => image.isPrimary)?.id ?? null,
    }, {
      onSuccess: () => {
        setImages((current) => current.map((image, index) => ({ ...image, sortOrder: index })));
        setBaseline((current) => ({
          ...current,
          images: current.images.map((baselineImage) => {
            const index = existingImages.findIndex((image) => image.id === baselineImage.id);
            return index >= 0 ? { ...baselineImage, sortOrder: index, isPrimary: existingImages[index].isPrimary } : baselineImage;
          }),
        }));
        toast.success(t("seller.editor.success.imageOrderSaved"));
      },
      onError: (error: unknown) => setMediaError(error instanceof Error ? error.message : t("seller.editor.error.imageOrderSave")),
    });
  }

  function moveImage(imageId: string, direction: -1 | 1) {
    setImages((current) => {
      const index = current.findIndex((image) => image.id === imageId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [image] = next.splice(index, 1);
      next.splice(nextIndex, 0, image);
      return next.map((item, sortOrder) => ({ ...item, sortOrder }));
    });
  }

  function publishListing() {
    setFormError("");
    if (!workingProductId) {
      setFormError(t("seller.editor.error.draftBeforeReview"));
      return;
    }
    if (readinessMissing.length) {
      setFormError(t("seller.editor.error.reviewNeeds").replace("{items}", readinessMissing.join(", ")));
      return;
    }
    if (duplicateCombinationError) {
      setVariantError(duplicateCombinationError);
      return;
    }
    publishProduct.mutate(workingProductId, {
      onSuccess: (savedProduct) => {
        const savedForm = productToForm(savedProduct);
        setForm(savedForm);
        setBaseline((current) => ({ ...current, form: savedForm }));
        toast.success(t("seller.editor.success.reviewSubmitted"));
      },
      onError: (error: unknown) => setFormError(error instanceof Error ? error.message : t("seller.editor.error.reviewSubmit")),
    });
  }

  function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (!form.title.trim()) {
      setFormError(t("seller.editor.error.titleRequired"));
      document.getElementById("product-title")?.focus();
      return;
    }
    if (form.status === "ACTIVE" && readinessMissing.length) {
      setFormError(t("seller.editor.error.activeNeeds").replace("{items}", readinessMissing.join(", ")));
      return;
    }
    if (duplicateCombinationError) {
      setVariantError(duplicateCombinationError);
      return;
    }
    const input = toProductInput(form);
    const options = {
      onSuccess: (savedProduct: SellerProduct) => {
        const savedForm = productToForm(savedProduct);
        setBaseline((current) => ({ ...current, form: savedForm }));
        toast.success(mode === "edit" ? t("seller.editor.success.productUpdated") : t("seller.editor.success.productCreated"));
        if (mode === "create") {
          setCreatedProduct(savedProduct);
          setSeedProductId(savedProduct.id);
          setForm(savedForm);
        }
      },
      onError: (error: unknown) => {
        setFormError(error instanceof Error ? error.message : t("seller.editor.error.productSave"));
        toast.error(t("seller.editor.error.productSave"));
      },
    };
    if (mode === "edit" && productId) {
      updateProduct.mutate({ productId, ...input }, options);
      return;
    }
    createProduct.mutate(input, options);
  }

  function addImageFiles(event: ChangeEvent<HTMLInputElement>) {
    addImageFileList(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function addImageFileList(files: File[]) {
    setMediaError("");
    if (!files.length) return;
    if (images.length + files.length > MAX_PRODUCT_IMAGES) {
      setMediaError(t("seller.editor.error.imageLimit").replace("{max}", String(MAX_PRODUCT_IMAGES)));
      return;
    }
    setImages((current) => [
      ...current,
      ...files.map((file, index) => ({
        id: `pending-${Date.now()}-${index}`,
        file,
        url: createPreviewUrl(file),
        altText: file.name,
        sortOrder: current.length + index,
        isPrimary: current.length === 0 && index === 0,
        status: "pending" as const,
      })),
    ]);
  }

  function handleImageDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingImages(false);
    addImageFileList(Array.from(event.dataTransfer.files ?? []).filter((file) => file.type.startsWith("image/")));
  }

  function handleImageDrag(event: DragEvent<HTMLDivElement>, active: boolean) {
    event.preventDefault();
    setIsDraggingImages(active);
  }

  function addVideoFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setMediaError("");
    if (!file) return;
    if (video) {
      setMediaError(t("seller.editor.error.videoSingle"));
      return;
    }
    if (!PRODUCT_VIDEO_TYPES.includes(file.type)) {
      setMediaError(t("seller.editor.error.videoType"));
      return;
    }
    if (file.size > MAX_PRODUCT_VIDEO_BYTES) {
      setMediaError(t("seller.editor.error.videoSize"));
      return;
    }
    setVideo({
      file,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type,
      url: createPreviewUrl(file),
      status: "pending",
    });
  }

  function updateImageDraft(imageId: string, patch: Partial<ImageDraftState>) {
    setImages((current) => current.map((image) => image.id === imageId ? { ...image, ...patch } : image));
  }

  function setPrimaryImage(imageId: string) {
    setImages((current) => current.map((image) => ({ ...image, isPrimary: image.id === imageId })));
  }

  function removeImage(image: ImageDraftState) {
    if (image.status !== "existing" || !workingProductId) {
      setImages((current) => {
        const next = current.filter((item) => item.id !== image.id);
        if (image.isPrimary && next.length) return next.map((item, index) => ({ ...item, isPrimary: index === 0 }));
        return next;
      });
      return;
    }
    deleteImage.mutate({ productId: workingProductId, imageId: image.id }, {
      onSuccess: () => {
        setImages((current) => {
          const next = current.filter((item) => item.id !== image.id);
          if (image.isPrimary && next.length) return next.map((item, index) => ({ ...item, isPrimary: index === 0 }));
          return next;
        });
        setBaseline((current) => ({ ...current, images: current.images.filter((item) => item.id !== image.id) }));
        toast.success(t("seller.editor.success.imageRemoved"));
      },
      onError: (error: unknown) => setMediaError(error instanceof Error ? error.message : t("seller.editor.error.imageRemove")),
    });
  }

  function saveImage(image: ImageDraftState) {
    if (!workingProductId) {
      setMediaError(t("seller.editor.error.draftBeforeMedia"));
      return;
    }
    updateImageDraft(image.id, { status: "uploading", error: undefined });
    if (image.status === "existing") {
      updateImage.mutate({ productId: workingProductId, imageId: image.id, altText: optionalText(image.altText), sortOrder: image.sortOrder, isPrimary: image.isPrimary, width: image.width, height: image.height }, {
        onSuccess: () => {
          updateImageDraft(image.id, { status: "existing" });
          setBaseline((current) => ({ ...current, images: current.images.map((item) => item.id === image.id ? toBaselineImage(image) : item) }));
          toast.success(t("seller.editor.success.imageUpdated"));
        },
        onError: (error: unknown) => updateImageDraft(image.id, { status: "error", error: error instanceof Error ? error.message : t("seller.editor.error.imageSave") }),
      });
      return;
    }
    if (!image.file) return;
    uploadImage.mutate({ productId: workingProductId, file: image.file, altText: optionalText(image.altText), sortOrder: image.sortOrder, isPrimary: image.isPrimary, width: image.width, height: image.height }, {
      onSuccess: ({ image: savedImage }: { image: SellerProductImage }) => {
        const savedDraft: ImageDraftState = {
          ...image,
          id: savedImage.id,
          url: savedImage.url,
          width: savedImage.width ?? image.width,
          height: savedImage.height ?? image.height,
          status: "existing",
          error: undefined,
          file: undefined,
        };
        setImages((current) => current.map((item) => item.id === image.id ? savedDraft : item));
        setBaseline((current) => ({ ...current, images: [...current.images, toBaselineImage(savedDraft)] }));
        toast.success(t("seller.editor.success.imageUploaded"));
      },
      onError: (error: unknown) => updateImageDraft(image.id, { status: "error", error: error instanceof Error ? error.message : t("seller.editor.error.imageUpload") }),
    });
  }

  function removeVideo() {
    if (video?.status === "existing" && workingProductId) {
      deleteVideo.mutate(workingProductId, {
        onSuccess: () => {
          setVideo(null);
          setBaseline((current) => ({ ...current, video: null }));
          toast.success(t("seller.editor.success.videoRemoved"));
        },
        onError: (error: unknown) => setMediaError(error instanceof Error ? error.message : t("seller.editor.error.videoRemove")),
      });
      return;
    }
    setVideo(null);
  }

  function saveVideo() {
    if (!workingProductId) {
      setMediaError(t("seller.editor.error.draftBeforeMedia"));
      return;
    }
    if (!video?.file) return;
    setVideo((current) => current ? { ...current, status: "uploading", error: undefined } : current);
    uploadVideo.mutate({ productId: workingProductId, file: video.file, sortOrder: 0 }, {
      onSuccess: ({ video: savedVideo }: { video: SellerProductVideo }) => {
        const savedDraft: VideoDraftState = {
          id: savedVideo.id,
          url: savedVideo.url,
          contentType: savedVideo.contentType,
          fileName: savedVideo.fileName,
          fileSize: savedVideo.fileSize,
          status: "existing",
        };
        setVideo(savedDraft);
        setBaseline((current) => ({ ...current, video: toBaselineVideo(savedDraft) }));
        toast.success(t("seller.editor.success.videoUploaded"));
      },
      onError: (error: unknown) => setVideo((current) => current ? { ...current, status: "error", error: error instanceof Error ? error.message : t("seller.editor.error.videoUpload") } : current),
    });
  }

  function addVariant() {
    setVariants((current) => [...current, { ...emptyVariantForm, sku: `SKU-${current.length + 1}` }]);
  }

  function generateVariantsFromOptions() {
    const combinations = buildOptionCombinations(options);
    if (!combinations.length) {
      setVariantError(t("seller.editor.error.optionValueBeforeRows"));
      return;
    }
    setVariantError("");
    setVariants((current) => {
      const existingKeys = new Set(current.map(getOptionCombinationKey).filter(Boolean));
      const nextRows = combinations
        .filter((combination) => !existingKeys.has(combination.slice().sort().join("|")))
        .map((combination, index) => buildGeneratedVariant(combination, current.length + index, options, t));
      return [...current, ...nextRows];
    });
  }

  function moveOptionValue(optionIndex: number, valueIndex: number, direction: -1 | 1) {
    setOptions((current) => current.map((option, index) => {
      if (index !== optionIndex) return option;
      const nextIndex = valueIndex + direction;
      if (nextIndex < 0 || nextIndex >= option.values.length) return option;
      const nextValues = [...option.values];
      const [value] = nextValues.splice(valueIndex, 1);
      nextValues.splice(nextIndex, 0, value);
      return { ...option, values: nextValues.map((item, sortOrder) => ({ ...item, sortOrder })) };
    }));
  }

  function applyBulk(field: keyof VariantBulkState) {
    setVariantError("");
    setVariants((current) => current.map((variant) => {
      if (field === "price" && bulk.price.trim()) return { ...variant, price: bulk.price };
      if (field === "stock" && bulk.stock.trim()) return { ...variant, quantityOnHand: bulk.stock };
      if (field === "status") return { ...variant, status: bulk.status };
      return variant;
    }));
  }

  function updateVariantDraft(index: number, patch: Partial<VariantFormState>) {
    setVariants((current) => current.map((variant, variantIndex) => variantIndex === index ? { ...variant, ...patch } : variant));
  }

  function deleteVariantDraft(variant: VariantFormState, index: number) {
    setConfirmation({
      type: "delete-variant",
      variant,
      index,
      label: getLocalizedText(locale, variant.title, variant.titleTh, variant.titleEn) || variant.sku || t("seller.editor.variant.generatedName").replace("{index}", String(index + 1)),
    });
  }

  function performDeleteVariantDraft(variant: VariantFormState, index: number) {
    if (!variant.id || !workingProductId) {
      setVariants((current) => current.filter((_, variantIndex) => variantIndex !== index));
      return;
    }
    deleteVariant.mutate({ productId: workingProductId, variantId: variant.id }, {
      onSuccess: () => {
        setVariants((current) => current.filter((item) => item.id !== variant.id));
        setBaseline((current) => ({ ...current, variants: current.variants.filter((item) => item.id !== variant.id) }));
        toast.success(t("seller.editor.success.variantDeleted"));
      },
      onError: (error: unknown) => setVariantError(error instanceof Error ? error.message : t("seller.editor.error.variantDelete")),
    });
  }

  function saveVariant(variant: VariantFormState, index: number) {
    setVariantError("");
    if (!workingProductId) {
      setVariantError(t("seller.editor.error.draftBeforeVariants"));
      return;
    }
    if (!variant.sku.trim() || !variant.title.trim()) {
      setVariantError(t("seller.editor.error.variantRequired"));
      document.getElementById(!variant.sku.trim() ? `variant-sku-${index}` : `variant-title-${index}`)?.focus();
      return;
    }
    const rowErrors = getVariantRowErrors(variant, index, duplicateSkuIndexes, duplicateCombinationIndexes, t);
    if (rowErrors.length) {
      setVariantError(rowErrors.join(" "));
      document.getElementById(`variant-sku-${index}`)?.focus();
      return;
    }
    if (Number(variant.price || "0") < 0 || Number(variant.quantityOnHand || "0") < 0 || Number(variant.reorderLevel || "0") < 0) {
      setVariantError(t("seller.editor.error.variantNegative"));
      return;
    }
    const input = toVariantInput(variant);
    const saveStock = (savedVariant: VariantFormState, successMessage: string) => {
      updateVariantStock.mutate({
        productId: workingProductId,
        variantId: savedVariant.id!,
        quantityOnHand: input.quantityOnHand,
        reorderLevel: input.reorderLevel,
      }, {
        onSuccess: () => {
          setBaseline((current) => {
            const exists = current.variants.some((item) => item.id === savedVariant.id);
            return {
              ...current,
              variants: exists
                ? current.variants.map((item) => item.id === savedVariant.id ? { ...savedVariant, optionValueIds: [...savedVariant.optionValueIds] } : item)
                : [...current.variants, { ...savedVariant, optionValueIds: [...savedVariant.optionValueIds] }],
            };
          });
          toast.success(successMessage);
        },
        onError: (error: unknown) => setVariantError(error instanceof Error ? error.message : t("seller.editor.error.variantStockSave")),
      });
    };
    if (variant.id) {
      updateVariant.mutate({ productId: workingProductId, variantId: variant.id, ...input }, {
        onSuccess: () => {
          saveStock({ ...variant, id: variant.id }, t("seller.editor.success.variantUpdated"));
        },
        onError: (error: unknown) => setVariantError(error instanceof Error ? error.message : t("seller.editor.error.variantSave")),
      });
      return;
    }
    createVariant.mutate({ productId: workingProductId, ...input }, {
      onSuccess: (savedVariant: { id: string }) => {
        const savedDraft = { ...variant, id: savedVariant.id };
        updateVariantDraft(index, { id: savedVariant.id });
        saveStock(savedDraft, t("seller.editor.success.variantCreated"));
      },
      onError: (error: unknown) => setVariantError(error instanceof Error ? error.message : t("seller.editor.error.variantSave")),
    });
  }

  function confirmPendingAction() {
    if (!confirmation) return;
    const pending = confirmation;
    setConfirmation(null);
    if (pending.type === "discard") {
      router.push("/seller/products");
      return;
    }
    if (pending.type === "remove-option") {
      performRemoveOption(pending.index);
      return;
    }
    if (pending.type === "remove-option-value") {
      performRemoveOptionValue(pending.optionIndex, pending.valueIndex);
      return;
    }
    performDeleteVariantDraft(pending.variant, pending.index);
  }

  const confirmationCopy = confirmation ? getProductStudioConfirmationCopy(confirmation, t) : null;

  if (mode === "edit" && (productQuery.error || productsQuery.error)) {
    return (
      <>
        <SellerPageHeader title={t("seller.editor.editTitle")} description={t("seller.editor.editDescription")} />
        <ErrorState error={productQuery.error ?? productsQuery.error} retry={() => { void productQuery.refetch(); void productsQuery.refetch(); }} />
      </>
    );
  }

  if (mode === "edit" && !product && (productQuery.isLoading || productsQuery.isLoading)) {
    return (
      <>
        <SellerPageHeader title={t("seller.editor.editTitle")} description={t("seller.editor.editDescription")} />
        <Card><CardContent className="pt-6 text-sm text-slate-500">{t("seller.editor.loading")}</CardContent></Card>
      </>
    );
  }

  if (mode === "edit" && !product) {
    return (
      <>
        <SellerPageHeader title={t("seller.editor.editTitle")} description={t("seller.editor.editDescription")} />
        <Card><CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-600">{t("seller.editor.notFound")}</p><Button type="button" variant="outline" onClick={() => { void productQuery.refetch(); void productsQuery.refetch(); }}>{t("seller.editor.retry")}</Button></CardContent></Card>
      </>
    );
  }

  return (
    <>
      <SellerPageHeader title={t("seller.editor.studioTitle")} description={t("seller.editor.studioDescription")} />
      <ProductStudioHeader
        productTitle={getLocalizedText(locale, form.title, form.titleTh, form.titleEn) || workingProduct?.title || t("seller.editor.untitledDraft")}
        productStatus={form.status}
        saveState={saveState}
        isSaving={isSaving}
        canPublish={Boolean(workingProductId) && readinessMissing.length === 0 && !duplicateCombinationError && !["ACTIVE", "SUSPENDED", "PENDING_REVIEW"].includes(form.status)}
        onPublish={publishListing}
        onCancel={cancel}
      />
      <ProductStudioNav />
      <form id="seller-product-studio-form" className="flex flex-col gap-4" autoComplete="off" onSubmit={submitProduct}>
        <div className="space-y-4">
          <ProductSection id="basics">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("seller.products.labels.title")} htmlFor="product-title"><Input id="product-title" name="title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required aria-describedby={formError ? "product-form-error" : undefined} /></Field>
              <Field label={t("seller.products.labels.slug")} htmlFor="product-slug"><Input id="product-slug" name="slug" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="optional-slug" /></Field>
            </div>
            <Field label={t("seller.products.labels.description")} htmlFor="product-description"><Textarea id="product-description" name="description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={4} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("seller.products.labels.thaiTitle")} htmlFor="product-title-th"><Input id="product-title-th" name="titleTh" value={form.titleTh} onChange={(event) => setForm((current) => ({ ...current, titleTh: event.target.value }))} /></Field>
              <Field label={t("seller.products.labels.englishTitle")} htmlFor="product-title-en"><Input id="product-title-en" name="titleEn" value={form.titleEn} onChange={(event) => setForm((current) => ({ ...current, titleEn: event.target.value }))} /></Field>
              <Field label={t("seller.products.labels.thaiDescription")} htmlFor="product-description-th"><Textarea id="product-description-th" name="descriptionTh" value={form.descriptionTh} onChange={(event) => setForm((current) => ({ ...current, descriptionTh: event.target.value }))} rows={3} /></Field>
              <Field label={t("seller.products.labels.englishDescription")} htmlFor="product-description-en"><Textarea id="product-description-en" name="descriptionEn" value={form.descriptionEn} onChange={(event) => setForm((current) => ({ ...current, descriptionEn: event.target.value }))} rows={3} /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("seller.products.labels.brand")} htmlFor="product-brand">
                <Select name="brandId" value={form.brandId || "NONE"} onValueChange={(value) => setForm((current) => ({ ...current, brandId: value === "NONE" ? "" : value }))}>
                  <SelectTrigger id="product-brand" aria-label={t("seller.products.labels.brand" as never)}><SelectValue placeholder={t("seller.products.editorActions.selectBrand" as never)} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">{t("seller.products.editorActions.noBrand" as never)}</SelectItem>
                    {(brandsQuery.data ?? []).map((brand) => <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("seller.products.labels.seoTitle")} htmlFor="product-meta-title"><Input id="product-meta-title" name="metaTitle" value={form.metaTitle} onChange={(event) => setForm((current) => ({ ...current, metaTitle: event.target.value }))} /></Field>
            </div>
            <Field label={t("seller.products.labels.seoDescription")} htmlFor="product-meta-description"><Textarea id="product-meta-description" name="metaDescription" value={form.metaDescription} onChange={(event) => setForm((current) => ({ ...current, metaDescription: event.target.value }))} rows={2} /></Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t("seller.products.labels.condition")} htmlFor="product-condition"><Input id="product-condition" name="condition" value={form.condition} onChange={(event) => setForm((current) => ({ ...current, condition: event.target.value }))} placeholder={t("seller.editor.placeholder.condition")} /></Field>
              <Field label={t("seller.products.labels.warranty")} htmlFor="product-warranty"><Input id="product-warranty" name="warrantyInfo" value={form.warrantyInfo} onChange={(event) => setForm((current) => ({ ...current, warrantyInfo: event.target.value }))} /></Field>
              <Field label={t("seller.products.labels.origin")} htmlFor="product-origin"><Input id="product-origin" name="countryOfOrigin" value={form.countryOfOrigin} onChange={(event) => setForm((current) => ({ ...current, countryOfOrigin: event.target.value }))} placeholder="TH" /></Field>
            </div>
          </ProductSection>
          <ProductSection id="category-specs">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("seller.products.labels.category")} htmlFor="product-category">
                <Select name="categoryId" value={form.categoryId || "NONE"} onValueChange={(value) => setForm((current) => ({ ...current, categoryId: value === "NONE" ? "" : value }))}>
                  <SelectTrigger id="product-category" aria-label={t("seller.products.labels.category" as never)}><SelectValue placeholder={t("seller.products.editorActions.selectCategory" as never)} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">{t("seller.products.editorActions.noCategory" as never)}</SelectItem>
                    {(categoriesQuery.data ?? []).map((category) => <SelectItem key={category.id} value={category.id}>{getLocalizedText(locale, category.name, category.nameTh, category.nameEn)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("seller.products.labels.status")} htmlFor="product-status">
                <div id="product-status" className="flex h-10 items-center"><StatusPill value={form.status} /></div>
              </Field>
            </div>
            {!form.categoryId ? <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">{t("seller.products.editorActions.chooseCategory" as never)}</p> : null}
            {form.categoryId && (categoriesQuery.isLoading || categorySpecsQuery.isLoading) ? <p className="text-sm text-slate-500">{t("seller.products.editorActions.loadingSpecs" as never)}</p> : null}
            {requiredSpecs.length ? (
              <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{t("seller.products.editorActions.requiredSpecs" as never)}</p>
                  <p className="text-xs text-slate-500">{t("seller.products.editorActions.requiredSpecsHelp" as never)}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {requiredSpecs.map((spec) => {
                    const fieldId = `required-spec-${spec.attributeKey}`;
                    const value = getAttributeValue(form, spec.attributeKey);
                    const isMissing = !value.trim();
                    return (
                      <CategorySpecField
                        key={spec.attributeKey}
                        spec={spec}
                        fieldId={fieldId}
                        value={value}
                        isMissing={isMissing}
                        onChange={(nextValue) => setForm((current) => updateAttributeValue(current, spec, nextValue, locale))}
                      />
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="space-y-3 rounded-lg border border-slate-200 p-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">{t("seller.products.editorActions.optionalSpecs" as never)}</p>
                <p className="text-xs text-slate-500">{t("seller.products.editorActions.optionalSpecsHelp" as never)}</p>
              </div>
              {optionalSpecs.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {optionalSpecs.map((spec) => {
                    const fieldId = `optional-spec-${spec.attributeKey}`;
                    const value = getAttributeValue(form, spec.attributeKey);
                    return (
                      <CategorySpecField
                        key={spec.attributeKey}
                        spec={spec}
                        fieldId={fieldId}
                        value={value}
                        onChange={(nextValue) => setForm((current) => updateAttributeValue(current, spec, nextValue, locale))}
                      />
                    );
                  })}
                </div>
              ) : <p className="text-sm text-slate-500">{t("seller.products.editorActions.noOptionalSpecs" as never)}</p>}
            </div>
            <Field label={t("seller.products.labels.additionalSpecs")} htmlFor="product-attributes"><Textarea id="product-attributes" name="additionalSpecifications" value={getAdditionalAttributesText(form, categorySpecs)} onChange={(event) => setForm((current) => updateAdditionalAttributesText(current, categorySpecs, event.target.value))} rows={3} placeholder={t("seller.editor.placeholder.additionalSpecs")} /></Field>
            <Field label={t("seller.products.labels.highlights")} htmlFor="product-highlights"><Textarea id="product-highlights" name="highlights" value={form.highlightsText} onChange={(event) => setForm((current) => ({ ...current, highlightsText: event.target.value }))} rows={3} placeholder={t("seller.editor.placeholder.highlights")} /></Field>
          </ProductSection>
        </div>
        <div className="space-y-4">
          <ProductSection id="media">
            {!workingProductId ? <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">{t("seller.products.editorActions.saveDraftMedia" as never)}</p> : null}
            {!hasPrimaryImage ? <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">{t("seller.products.editorActions.readinessWarning" as never)}</p> : null}
            <div
              className={`rounded-lg border border-dashed p-4 text-sm ${isDraggingImages ? "select-none border-slate-900 bg-slate-50 text-slate-900" : "border-slate-300 bg-white text-slate-600"}`}
              onDragOver={(event) => handleImageDrag(event, true)}
              onDragLeave={(event) => handleImageDrag(event, false)}
              onDrop={handleImageDrop}
            >
              {t("seller.editor.media.dropImages")}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input ref={imageInputRef} name="productImages" type="file" accept="image/*" multiple className="sr-only" onChange={addImageFiles} aria-label={t("seller.products.editorActions.uploadImages" as never)} />
              <Button type="button" variant="outline" onClick={() => imageInputRef.current?.click()}>
                <UploadIcon className="size-4" />
                {t("seller.editor.media.addImages")}
              </Button>
              <input ref={videoInputRef} name="productVideo" type="file" accept="video/mp4,video/webm" className="sr-only" onChange={addVideoFile} aria-label={t("seller.products.editorActions.uploadVideo" as never)} />
              <Button type="button" variant="outline" onClick={() => videoInputRef.current?.click()}>
                <UploadIcon className="size-4" />
                {t("seller.editor.media.addVideo")}
              </Button>
            </div>
            <p className="text-xs text-slate-500">{t("seller.products.mediaCount" as never).replace("{count}", String(images.length)).replace("{max}", String(MAX_PRODUCT_IMAGES))}</p>
            {mediaError ? <p role="alert" className="text-sm text-red-600">{mediaError}</p> : null}
            {images.some((image) => image.status === "existing") ? (
              <Button type="button" variant="outline" onClick={saveImageOrder} disabled={isSaving}>{t("seller.products.editorActions.saveImageOrder" as never)}</Button>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {images.map((image, imageIndex) => (
                <div key={image.id} className="space-y-3 rounded-lg border border-slate-200 p-3">
                  <img src={image.url} alt={image.altText || t("seller.editor.media.imagePreviewAlt")} width={image.width ?? 800} height={image.height ?? 800} loading="lazy" decoding="async" className="aspect-square w-full rounded-md object-cover" />
                  <div aria-live="polite" className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-2 py-1 font-semibold ${image.status === "error" ? "bg-red-100 text-red-700" : image.status === "uploading" ? "bg-blue-100 text-blue-700" : image.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                      {getDraftStatusLabel(image.status, t)}
                    </span>
                    {image.isPrimary ? <span className="rounded-full bg-slate-900 px-2 py-1 font-semibold text-white">{t("seller.products.primary" as never)}</span> : null}
                  </div>
                  <Field label={t("seller.products.labels.altText")} htmlFor={`image-alt-${image.id}`}>
                    <Input id={`image-alt-${image.id}`} name={`images.${imageIndex}.altText`} value={image.altText} onChange={(event) => updateImageDraft(image.id, { altText: event.target.value })} />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label={t("seller.products.labels.order")} htmlFor={`image-order-${image.id}`}>
                      <Input id={`image-order-${image.id}`} name={`images.${imageIndex}.sortOrder`} type="number" min="0" value={image.sortOrder} onChange={(event) => updateImageDraft(image.id, { sortOrder: Number(event.target.value) })} className="tabular-nums" />
                    </Field>
                    <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
                      <input type="radio" name="primaryImage" value={image.id} checked={image.isPrimary} onChange={() => setPrimaryImage(image.id)} />
                      {t("seller.products.primary" as never)}
                    </label>
                  </div>
                  {image.error ? <p role="alert" className="text-sm text-red-600">{image.error}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" aria-label={t("seller.editor.media.moveImageUp").replace("{index}", String(imageIndex + 1))} onClick={() => moveImage(image.id, -1)} disabled={imageIndex === 0}><ArrowUpIcon className="size-4" /></Button>
                    <Button type="button" variant="outline" aria-label={t("seller.editor.media.moveImageDown").replace("{index}", String(imageIndex + 1))} onClick={() => moveImage(image.id, 1)} disabled={imageIndex === images.length - 1}><ArrowDownIcon className="size-4" /></Button>
                    <Button type="button" variant="outline" onClick={() => saveImage(image)} disabled={isSaving}>{image.status === "uploading" ? t("seller.products.editorActions.uploading" as never) : image.status === "error" ? t("seller.editor.retry") : t("seller.products.editorActions.saveImage" as never)}</Button>
                    <Button type="button" variant="outline" aria-label={t("seller.editor.media.removeImageLabel").replace("{name}", image.altText || image.id)} onClick={() => removeImage(image)}><TrashIcon className="size-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
            {video ? (
              <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-900">{video.fileName ?? t("seller.products.editorActions.productVideo" as never)}</p>
                <p className="text-xs tabular-nums text-slate-500">{video.contentType ?? t("seller.editor.media.videoTypeFallback")} {video.fileSize ? `· ${(video.fileSize / 1024 / 1024).toFixed(1)} MB` : ""}</p>
                {video.url && video.contentType && PRODUCT_VIDEO_TYPES.includes(video.contentType) ? <video src={video.url} controls preload="metadata" aria-label={t("seller.editor.media.videoPreviewLabel")} className="aspect-video w-full rounded-md bg-slate-100" /> : <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">{t("seller.products.videoPreviewUnavailable" as never)}</p>}
                <span aria-live="polite" className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${video.status === "error" ? "bg-red-100 text-red-700" : video.status === "uploading" ? "bg-blue-100 text-blue-700" : video.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                  {getDraftStatusLabel(video.status, t)}
                </span>
                {video.error ? <p role="alert" className="text-sm text-red-600">{video.error}</p> : null}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={saveVideo} disabled={isSaving || video.status === "existing"}>{video.status === "uploading" ? t("seller.products.editorActions.uploading" as never) : video.status === "error" ? t("seller.editor.media.retryVideo") : t("seller.editor.media.saveVideo")}</Button>
                  <Button type="button" variant="outline" onClick={removeVideo}>{t("seller.products.editorActions.removeVideo" as never)}</Button>
                </div>
              </div>
            ) : null}
            {!video ? <p className="rounded-lg border border-slate-200 p-3 text-sm text-slate-500">{t("seller.products.editorActions.noVideo" as never)}</p> : null}
          </ProductSection>
          <ProductSection id="variants">
            {!workingProductId ? <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">{t("seller.products.editorActions.saveDraftMedia" as never)}</p> : null}
            {optionError ? <p role="alert" className="text-sm text-red-600">{optionError}</p> : null}
            {duplicateCombinationError ? <p role="alert" className="text-sm text-red-600">{duplicateCombinationError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={addOption} disabled={options.length >= 2}><PlusIcon className="size-4" />{t("seller.products.editorActions.addOption" as never)}</Button>
              <Button type="button" variant="outline" onClick={saveOptions} disabled={isSaving}>{t("seller.products.editorActions.saveOptions" as never)}</Button>
              <Button type="button" variant="outline" onClick={generateVariantsFromOptions} disabled={!generatedCombinationCount}>{t("seller.products.editorActions.generateRows" as never)}</Button>
            </div>
            <p className="text-xs text-slate-500">{t("seller.products.axesHelp" as never).replace("{count}", String(generatedCombinationCount))}</p>
            <div className="space-y-3">
              {options.length ? options.map((option, optionIndex) => (
                <div key={option.id} className="space-y-3 rounded-lg border border-slate-200 p-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <Field label={t("seller.products.labels.optionName")} htmlFor={`option-name-${optionIndex}`}><Input id={`option-name-${optionIndex}`} name={`options.${optionIndex}.name`} value={option.name} onChange={(event) => updateOptionDraft(optionIndex, { name: event.target.value })} placeholder={t("seller.editor.placeholder.optionName")} /></Field>
                    <Field label={t("seller.products.labels.thaiName")} htmlFor={`option-name-th-${optionIndex}`}><Input id={`option-name-th-${optionIndex}`} name={`options.${optionIndex}.nameTh`} value={option.nameTh} onChange={(event) => updateOptionDraft(optionIndex, { nameTh: event.target.value })} /></Field>
                    <div className="flex items-end"><Button type="button" variant="outline" onClick={() => removeOption(optionIndex)}>{t("seller.products.editorActions.remove" as never)}</Button></div>
                  </div>
                  <div className="space-y-2">
                    {option.values.map((value, valueIndex) => (
                      <div key={value.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_100px_auto_auto]">
                        <Input name={`options.${optionIndex}.values.${valueIndex}.value`} aria-label={t("seller.editor.variant.optionValueLabel").replace("{option}", String(optionIndex + 1)).replace("{value}", String(valueIndex + 1))} value={value.value} onChange={(event) => updateOptionValueDraft(optionIndex, valueIndex, { value: event.target.value })} placeholder={t("seller.editor.placeholder.optionValue")} />
                        <Input name={`options.${optionIndex}.values.${valueIndex}.valueTh`} aria-label={t("seller.editor.variant.optionValueThaiLabel").replace("{option}", String(optionIndex + 1)).replace("{value}", String(valueIndex + 1))} value={value.valueTh} onChange={(event) => updateOptionValueDraft(optionIndex, valueIndex, { valueTh: event.target.value })} />
                        <Input name={`options.${optionIndex}.values.${valueIndex}.colorHex`} aria-label={t("seller.editor.variant.optionValueColorLabel").replace("{option}", String(optionIndex + 1)).replace("{value}", String(valueIndex + 1))} value={value.colorHex} onChange={(event) => updateOptionValueDraft(optionIndex, valueIndex, { colorHex: event.target.value })} placeholder="#000000" />
                        <div className="flex gap-1">
                          <Button type="button" variant="outline" aria-label={t("seller.editor.variant.moveValueUp").replace("{option}", String(optionIndex + 1)).replace("{value}", String(valueIndex + 1))} onClick={() => moveOptionValue(optionIndex, valueIndex, -1)} disabled={valueIndex === 0}><ArrowUpIcon className="size-4" /></Button>
                          <Button type="button" variant="outline" aria-label={t("seller.editor.variant.moveValueDown").replace("{option}", String(optionIndex + 1)).replace("{value}", String(valueIndex + 1))} onClick={() => moveOptionValue(optionIndex, valueIndex, 1)} disabled={valueIndex === option.values.length - 1}><ArrowDownIcon className="size-4" /></Button>
                        </div>
                        <Button type="button" variant="outline" onClick={() => removeOptionValue(optionIndex, valueIndex)}>{t("seller.products.editorActions.remove" as never)}</Button>
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="outline" onClick={() => addOptionValue(optionIndex)}>{t("seller.products.editorActions.addValue" as never)}</Button>
                </div>
              )) : <p className="text-sm text-slate-500">{t("seller.products.noStructuredOptions" as never)}</p>}
            </div>
          </ProductSection>
          <ProductSection title={t("seller.products.variantRowsTitle" as never)} description={t("seller.products.variantRowsDescription" as never)}>
            {!workingProductId ? <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">{t("seller.editor.error.draftBeforeVariants")}</p> : null}
            {variantError ? <p role="alert" className="text-sm text-red-600">{variantError}</p> : null}
            <div className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_1fr_auto_auto_auto]">
              <Field label={t("seller.products.labels.bulkPrice")} htmlFor="bulk-price"><Input id="bulk-price" name="bulkPrice" type="number" min="0" step="0.01" value={bulk.price} onChange={(event) => setBulk((current) => ({ ...current, price: event.target.value }))} className="tabular-nums" /></Field>
              <Field label={t("seller.products.labels.bulkStock")} htmlFor="bulk-stock"><Input id="bulk-stock" name="bulkStock" type="number" min="0" value={bulk.stock} onChange={(event) => setBulk((current) => ({ ...current, stock: event.target.value }))} className="tabular-nums" /></Field>
              <Field label={t("seller.products.labels.bulkStatus")} htmlFor="bulk-status">
                <Select name="bulkStatus" value={bulk.status} onValueChange={(value) => setBulk((current) => ({ ...current, status: value as VariantStatus }))}>
                  <SelectTrigger id="bulk-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">{t("seller.manage.status.active")}</SelectItem>
                    <SelectItem value="INACTIVE">{t("seller.manage.status.inactive")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-end"><Button type="button" variant="outline" onClick={() => applyBulk("price")}>{t("seller.products.editorActions.applyPrice" as never)}</Button></div>
              <div className="flex items-end"><Button type="button" variant="outline" onClick={() => applyBulk("stock")}>{t("seller.products.editorActions.applyStock" as never)}</Button></div>
              <div className="flex items-end"><Button type="button" variant="outline" onClick={() => applyBulk("status")}>{t("seller.products.editorActions.applyStatus" as never)}</Button></div>
            </div>
            <Button type="button" variant="outline" onClick={addVariant}><PlusIcon className="size-4" />{t("seller.products.editorActions.addVariant" as never)}</Button>
            <div className="space-y-3">
              {variants.map((variant, index) => {
                const rowErrors = getVariantRowErrors(variant, index, duplicateSkuIndexes, duplicateCombinationIndexes, t);
                const available = getAvailableStock(variant);
                return (
                <div key={variant.id ?? index} className={`space-y-3 rounded-lg border p-3 ${rowErrors.length ? "border-red-200 bg-red-50" : variant.status === "INACTIVE" ? "border-slate-200 bg-slate-100 opacity-80" : available <= 0 ? "border-amber-200 bg-amber-50" : "border-slate-200"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 text-sm font-semibold text-slate-900">{getVariantCombinationLabel(variant, options, locale, t)}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {variant.status === "INACTIVE" ? <span className="rounded-full bg-slate-200 px-2 py-1 font-semibold text-slate-700">{t("seller.products.editorActions.inactive" as never)}</span> : null}
                      {available <= 0 ? <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-800">{t("seller.products.editorActions.outOfStock" as never)}</span> : null}
                    </div>
                  </div>
                  {rowErrors.length ? <p role="alert" className="text-sm text-red-700">{rowErrors.join(" ")}</p> : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("seller.products.labels.sku")} htmlFor={`variant-sku-${index}`}><Input id={`variant-sku-${index}`} name={`variants.${index}.sku`} value={variant.sku} onChange={(event) => updateVariantDraft(index, { sku: event.target.value })} /></Field>
                    <Field label={t("seller.products.labels.variantTitle")} htmlFor={`variant-title-${index}`}><Input id={`variant-title-${index}`} name={`variants.${index}.title`} value={variant.title} onChange={(event) => updateVariantDraft(index, { title: event.target.value })} /></Field>
                    <Field label={t("seller.products.labels.thaiVariantTitle")} htmlFor={`variant-title-th-${index}`}><Input id={`variant-title-th-${index}`} name={`variants.${index}.titleTh`} value={variant.titleTh} onChange={(event) => updateVariantDraft(index, { titleTh: event.target.value })} /></Field>
                    <Field label={t("seller.products.labels.englishVariantTitle")} htmlFor={`variant-title-en-${index}`}><Input id={`variant-title-en-${index}`} name={`variants.${index}.titleEn`} value={variant.titleEn} onChange={(event) => updateVariantDraft(index, { titleEn: event.target.value })} /></Field>
                    <Field label={t("seller.products.labels.price")} htmlFor={`variant-price-${index}`}><Input id={`variant-price-${index}`} name={`variants.${index}.price`} type="number" min="0" step="0.01" value={variant.price} onChange={(event) => updateVariantDraft(index, { price: event.target.value })} className="tabular-nums" /></Field>
                    <Field label={t("seller.products.labels.currency")} htmlFor={`variant-currency-${index}`}><Input id={`variant-currency-${index}`} name={`variants.${index}.currency`} value={variant.currency} onChange={(event) => updateVariantDraft(index, { currency: event.target.value.toUpperCase() })} /></Field>
                    <Field label={t("seller.products.labels.variantStatus")} htmlFor={`variant-status-${index}`}>
                      <Select name={`variants.${index}.status`} value={variant.status} onValueChange={(value) => updateVariantDraft(index, { status: value as VariantStatus })}>
                        <SelectTrigger id={`variant-status-${index}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ACTIVE">{t("seller.manage.status.active")}</SelectItem>
                          <SelectItem value="INACTIVE">{t("seller.manage.status.inactive")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  {options.length ? (
                    <div className="space-y-2 rounded-md bg-slate-50 p-3">
                      <p className="text-sm font-medium text-slate-900">{t("seller.editor.variant.optionValues")}</p>
                      {options.map((option) => (
                        <div key={option.id} className="space-y-1">
                          <p className="text-xs font-semibold text-slate-600">{option.name || t("seller.editor.variant.optionFallback")}</p>
                          <div className="flex flex-wrap gap-2">
                            {option.values.map((value) => {
                              const checked = variant.optionValueIds.includes(value.id);
                              return (
                                <label key={value.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
                                  <input
                                    type="checkbox"
                                    name={`variants.${index}.optionValueIds`}
                                    value={value.id}
                                    checked={checked}
                                    onChange={(event) => {
                                      const nextIds = event.target.checked
                                        ? [...variant.optionValueIds.filter((id) => !option.values.some((item) => item.id === id)), value.id]
                                        : variant.optionValueIds.filter((id) => id !== value.id);
                                      updateVariantDraft(index, { optionValueIds: nextIds });
                                    }}
                                  />
                                  {value.value || t("seller.editor.variant.valueFallback")}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("seller.products.labels.quantityOnHand")} htmlFor={`variant-on-hand-${index}`}><Input id={`variant-on-hand-${index}`} name={`variants.${index}.quantityOnHand`} type="number" min="0" value={variant.quantityOnHand} onChange={(event) => updateVariantDraft(index, { quantityOnHand: event.target.value })} className="tabular-nums" /></Field>
                    <Field label={t("seller.products.labels.reorderLevel")} htmlFor={`variant-reorder-${index}`}><Input id={`variant-reorder-${index}`} name={`variants.${index}.reorderLevel`} type="number" min="0" value={variant.reorderLevel} onChange={(event) => updateVariantDraft(index, { reorderLevel: event.target.value })} className="tabular-nums" /></Field>
                    <Field label={t("seller.products.labels.quantityReserved")} htmlFor={`variant-reserved-${index}`}><Input id={`variant-reserved-${index}`} name={`variants.${index}.quantityReserved`} value={variant.quantityReserved} readOnly className="tabular-nums" /></Field>
                    <Field label={t("seller.products.labels.availableStock")} htmlFor={`variant-available-${index}`}><Input id={`variant-available-${index}`} name={`variants.${index}.availableStock`} value={getAvailableStock(variant)} readOnly className="tabular-nums" /></Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("seller.products.labels.weightGrams")} htmlFor={`variant-weight-${index}`}><Input id={`variant-weight-${index}`} name={`variants.${index}.weightGrams`} type="number" min="0" value={variant.weightGrams} onChange={(event) => updateVariantDraft(index, { weightGrams: event.target.value })} className="tabular-nums" /></Field>
                    <Field label={t("seller.products.labels.lengthMm")} htmlFor={`variant-length-${index}`}><Input id={`variant-length-${index}`} name={`variants.${index}.lengthMm`} type="number" min="0" value={variant.lengthMm} onChange={(event) => updateVariantDraft(index, { lengthMm: event.target.value })} className="tabular-nums" /></Field>
                    <Field label={t("seller.products.labels.widthMm")} htmlFor={`variant-width-${index}`}><Input id={`variant-width-${index}`} name={`variants.${index}.widthMm`} type="number" min="0" value={variant.widthMm} onChange={(event) => updateVariantDraft(index, { widthMm: event.target.value })} className="tabular-nums" /></Field>
                    <Field label={t("seller.products.labels.heightMm")} htmlFor={`variant-height-${index}`}><Input id={`variant-height-${index}`} name={`variants.${index}.heightMm`} type="number" min="0" value={variant.heightMm} onChange={(event) => updateVariantDraft(index, { heightMm: event.target.value })} className="tabular-nums" /></Field>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => saveVariant(variant, index)} disabled={isSaving}>{t("seller.products.editorActions.saveVariant" as never)}</Button>
                    <Button type="button" variant="outline" onClick={() => deleteVariantDraft(variant, index)}>{t("seller.products.editorActions.deleteVariant" as never)}</Button>
                  </div>
                </div>
              );})}
            </div>
          </ProductSection>
          <ProductSection id="inventory">
            {variants.length ? (
              <div className="space-y-3">
                {variants.map((variant, index) => {
                  const available = getAvailableStock(variant);
                  const quantityOnHand = Number(variant.quantityOnHand || "0");
                  const reorderLevel = Number(variant.reorderLevel || "0");
                  const lowStock = available <= reorderLevel;
                  return (
                    <div key={variant.id ?? `inventory-${index}`} className={`rounded-md border p-3 text-sm ${lowStock ? "border-amber-200 bg-amber-50" : "border-slate-200"}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-950">{getLocalizedText(locale, variant.title, variant.titleTh, variant.titleEn) || variant.sku || t("seller.editor.variant.generatedName").replace("{index}", String(index + 1))}</p>
                          <p className="text-xs text-slate-500">{variant.sku || t("seller.editor.variant.noSku")}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {lowStock ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">{t("seller.products.editorActions.lowStock" as never)}</span> : <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">{t("seller.products.editorActions.stockOk" as never)}</span>}
                          {variant.id ? <Link href={`/seller/inventory?variantId=${variant.id}`} className="text-xs font-semibold text-slate-700 underline">{t("seller.products.editorActions.movementHistory" as never)}</Link> : <span className="text-xs text-slate-500">{t("seller.products.editorActions.saveVariantMovements" as never)}</span>}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-4">
                        <div className="rounded-md bg-white p-2">
                          <p className="text-xs font-semibold text-slate-500">{t("seller.editor.inventory.onHand")}</p>
                          <p className="text-base font-semibold tabular-nums text-slate-950">{quantityOnHand}</p>
                        </div>
                        <div className="rounded-md bg-white p-2">
                          <p className="text-xs font-semibold text-slate-500">{t("seller.editor.inventory.reserved")}</p>
                          <p className="text-base font-semibold tabular-nums text-slate-950">{variant.quantityReserved}</p>
                          <p className="text-xs text-slate-500">{t("seller.products.editorActions.readOnlyHolds" as never)}</p>
                        </div>
                        <div className="rounded-md bg-white p-2">
                          <p className="text-xs font-semibold text-slate-500">{t("seller.editor.inventory.available")}</p>
                          <p className="text-base font-semibold tabular-nums text-slate-950">{available}</p>
                          <p className="text-xs text-slate-500">{t("seller.products.editorActions.onHandMinusReserved" as never)}</p>
                        </div>
                        <div className="rounded-md bg-white p-2">
                          <p className="text-xs font-semibold text-slate-500">{t("seller.products.labels.reorderLevel" as never)}</p>
                          <p className="text-base font-semibold tabular-nums text-slate-950">{reorderLevel}</p>
                        </div>
                      </div>
                      <div className="mt-3 rounded-md bg-white p-3 text-xs text-slate-600">
                        {t("seller.editor.inventory.movementPreview")}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">{t("seller.products.editorActions.noInventory" as never)}</p>
            )}
          </ProductSection>
          <ProductSection id="review">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                <span>{t("seller.products.reviewModerationStatus" as never)}:</span>
                {workingProduct?.status ? <StatusPill value={workingProduct.status} /> : <span>{t("seller.products.thisProduct")}</span>}
              </div>
              {moderationReason ? <p className="mt-1 text-sm text-red-700">{t("seller.products.reviewReason" as never)}: {moderationReason}</p> : null}
            </div>
            <div className="space-y-2 rounded-md border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-950">{t("seller.products.reviewChecklist" as never)}</p>
              <ul className="space-y-2">
                {readinessChecks.map((check) => (
                  <li key={check.id} className="flex items-start gap-2 text-sm">
                    <span className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${check.passed ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-800"}`}>
                      {check.passed ? "OK" : "!"}
                    </span>
                    <span className={check.passed ? "text-slate-700" : "text-amber-800"}>{check.label}</span>
                  </li>
                ))}
              </ul>
            </div>
            {readinessMissing.length ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-medium text-amber-900">{t("seller.products.reviewBlocked" as never)}</p>
                <p className="mt-1 text-sm text-amber-800">{t("seller.products.reviewMissing" as never).replace("{items}", readinessMissing.join(", "))}</p>
              </div>
            ) : (
              <p className="text-sm text-green-700">{t("seller.products.reviewSetupReady" as never)}</p>
            )}
            {duplicateCombinationError ? <p role="alert" className="text-sm text-red-600">{duplicateCombinationError}</p> : null}
            <Button type="button" variant="outline" onClick={publishListing} disabled={isSaving || readinessMissing.length > 0 || Boolean(duplicateCombinationError) || ["ACTIVE", "SUSPENDED", "PENDING_REVIEW"].includes(form.status)}>
              <SendIcon className="size-4" />
              {publishProduct.isPending ? t("seller.products.submitting") : t("seller.products.submitForReview" as never)}
            </Button>
          </ProductSection>
          {formError ? <p id="product-form-error" role="alert" className="text-sm text-red-600">{formError}</p> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end xl:flex-col-reverse">
            <Button type="button" variant="outline" onClick={cancel}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? t("seller.products.editorActions.uploading" as never) : t("seller.products.editorActions.saveProduct" as never)}</Button>
          </div>
        </div>
      </form>
      <AlertDialog open={Boolean(confirmation)} onOpenChange={(open) => { if (!open) setConfirmation(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmationCopy?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmationCopy?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={isSaving} onClick={confirmPendingAction}>
              {confirmationCopy?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ProductStudioHeader({
  productTitle,
  productStatus,
  saveState,
  isSaving,
  canPublish,
  onPublish,
  onCancel,
}: {
  productTitle: string;
  productStatus: ProductStatus;
  saveState: string;
  isSaving: boolean;
  canPublish: boolean;
  onPublish: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations();
  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-slate-950">{productTitle}</h2>
            <StatusPill value={productStatus} />
          </div>
          <p aria-live="polite" aria-atomic="true" className="mt-1 text-sm text-slate-500">{t("seller.editor.saveState")}: {saveState}</p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>{t("common.cancel")}</Button>
          <Button form="seller-product-studio-form" type="submit" disabled={isSaving}>
            <SaveIcon className="size-4" />
            {isSaving ? t("seller.editor.saving") : t("seller.editor.saveDraft")}
          </Button>
          <Button type="button" variant="outline" onClick={onPublish} disabled={isSaving || !canPublish}>
            <SendIcon className="size-4" />
            {t("seller.editor.submitReview")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProductStudioNav() {
  const t = useTranslations();
  return (
    <nav aria-label={t("seller.editor.sections")} className="overflow-x-auto border-b border-slate-200 pb-2">
      <div className="flex min-w-max gap-2">
        {PRODUCT_STUDIO_SECTIONS.map((section) => (
          <a key={section.id} href={`#${section.id}`} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            {t(`seller.editor.section.${section.id}` as never)}
          </a>
        ))}
      </div>
    </nav>
  );
}

function ProductSection({ id, title, description, children }: { id?: ProductStudioSectionId; title?: string; description?: string; children: ReactNode }) {
  const t = useTranslations();
  const sectionTitle = id ? t(`seller.editor.section.${id}` as never) : title ?? "";
  const sectionDescription = id ? t(`seller.editor.sectionDescription.${id}` as never) : description ?? "";
  return (
    <Card id={id} className="scroll-mt-32 rounded-lg border-slate-200 bg-white">
      <CardHeader>
        <CardTitle>{sectionTitle}</CardTitle>
        <p className="text-sm text-slate-500">{sectionDescription}</p>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  const t = useTranslations();
  const keyByLabel: Record<string, string> = { Title:"title",Slug:"slug",Description:"description","Thai title":"thaiTitle","English title":"englishTitle","Thai description":"thaiDescription","English description":"englishDescription",Brand:"brand","SEO title":"seoTitle","SEO description":"seoDescription",Condition:"condition","Warranty info":"warranty","Country of origin":"origin",Category:"category",Status:"status","Additional specifications":"additionalSpecs",Highlights:"highlights","Alt text":"altText",Order:"order","Option name":"optionName","Thai name":"thaiName","Bulk price":"bulkPrice","Bulk stock":"bulkStock","Bulk status":"bulkStatus",SKU:"sku","Variant title":"variantTitle","Thai variant title":"thaiVariantTitle","English variant title":"englishVariantTitle",Price:"price",Currency:"currency","Variant status":"variantStatus","Quantity on hand":"quantityOnHand","Reorder level":"reorderLevel","Quantity reserved":"quantityReserved","Available stock":"availableStock","Weight grams":"weightGrams","Length mm":"lengthMm","Width mm":"widthMm","Height mm":"heightMm" };
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{keyByLabel[label] ? t(`seller.products.labels.${keyByLabel[label]}` as never) : label}</Label>
      {children}
    </div>
  );
}

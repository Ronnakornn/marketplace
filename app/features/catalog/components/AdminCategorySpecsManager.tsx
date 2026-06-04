"use client";

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { ClipboardListIcon, FolderTreeIcon, PlusIcon, RotateCcwIcon, SaveIcon, SearchIcon } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import {
  type AdminCategory,
  type AdminCategorySpec,
  type CategorySpecType,
  useAdminCategories,
  useAdminCategorySpecs,
  useCreateAdminCategory,
  useCreateAdminCategorySpec,
  useReorderAdminCategories,
  useReorderAdminCategorySpecs,
  useSetAdminCategoryActive,
  useSetAdminCategorySpecActive,
  useUpdateAdminCategory,
  useUpdateAdminCategorySpec,
} from "../hooks/useCatalog";

type VisibilityFilter = "all" | "active" | "inactive";
type CategoryForm = { id: string | null; name: string; nameTh: string; nameEn: string; slug: string; parentId: string; sortOrder: string };
type SpecForm = {
  id: string | null;
  attributeKey: string;
  displayName: string;
  displayNameTh: string;
  displayNameEn: string;
  type: CategorySpecType;
  isRequired: boolean;
  isFilterable: boolean;
  unit: string;
  sortOrder: string;
};

const specTypes: CategorySpecType[] = ["TEXT", "NUMBER", "BOOLEAN", "SELECT", "MULTI_SELECT"];
const emptyCategoryForm: CategoryForm = { id: null, name: "", nameTh: "", nameEn: "", slug: "", parentId: "", sortOrder: "0" };
const emptySpecForm: SpecForm = {
  id: null,
  attributeKey: "",
  displayName: "",
  displayNameTh: "",
  displayNameEn: "",
  type: "TEXT",
  isRequired: false,
  isFilterable: false,
  unit: "",
  sortOrder: "0",
};

function errorText(error: unknown) {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "message" in error) return String((error as { message?: unknown }).message);
  return "Request failed.";
}

function isForbidden(error: unknown) {
  const text = JSON.stringify(error ?? "").toLowerCase();
  return text.includes("forbidden") || text.includes("unauthorized") || text.includes("401") || text.includes("403");
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

function categoryToForm(category: AdminCategory): CategoryForm {
  return {
    id: category.id,
    name: category.name,
    nameTh: category.nameTh ?? "",
    nameEn: category.nameEn ?? "",
    slug: category.slug,
    parentId: category.parentId ?? "",
    sortOrder: String(category.sortOrder),
  };
}

function specToForm(spec: AdminCategorySpec): SpecForm {
  return {
    id: spec.id,
    attributeKey: spec.attributeKey,
    displayName: spec.displayName,
    displayNameTh: spec.displayNameTh ?? "",
    displayNameEn: spec.displayNameEn ?? "",
    type: (spec.valueType ?? "TEXT") as CategorySpecType,
    isRequired: spec.isRequired,
    isFilterable: spec.isFilterable,
    unit: spec.unit ?? "",
    sortOrder: String(spec.sortOrder),
  };
}

function StatusBadge({ active }: { active: boolean }) {
  return active
    ? <Badge variant="outline" className="border-emerald-300/30 bg-emerald-300/12 text-emerald-100">Active</Badge>
    : <Badge variant="outline" className="border-amber-300/30 bg-amber-300/12 text-amber-100">Inactive</Badge>;
}

export function AdminCategorySpecsManager() {
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState<VisibilityFilter>("all");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategoryForm);
  const [specForm, setSpecForm] = useState<SpecForm>(emptySpecForm);
  const [notice, setNotice] = useState("");
  const [mutationError, setMutationError] = useState("");

  const categoriesQuery = useAdminCategories();
  const selectedCategory = useMemo(() => (categoriesQuery.data ?? []).find((category) => category.id === selectedCategoryId) ?? null, [categoriesQuery.data, selectedCategoryId]);
  const specsQuery = useAdminCategorySpecs(selectedCategoryId);
  const createCategory = useCreateAdminCategory();
  const updateCategory = useUpdateAdminCategory();
  const setCategoryActive = useSetAdminCategoryActive();
  const reorderCategories = useReorderAdminCategories();
  const createSpec = useCreateAdminCategorySpec();
  const updateSpec = useUpdateAdminCategorySpec();
  const setSpecActive = useSetAdminCategorySpecActive();
  const reorderSpecs = useReorderAdminCategorySpecs();

  const mutationPending = [
    createCategory,
    updateCategory,
    setCategoryActive,
    reorderCategories,
    createSpec,
    updateSpec,
    setSpecActive,
    reorderSpecs,
  ].some((mutation) => mutation.isPending);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (categoriesQuery.data ?? [])
      .filter((category) => visibility === "all" || category.isActive === (visibility === "active"))
      .filter((category) => !needle || [category.name, category.nameTh, category.nameEn, category.slug].some((value) => (value ?? "").toLowerCase().includes(needle)))
      .sort((a, b) => (a.parentId ?? "").localeCompare(b.parentId ?? "") || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }, [categoriesQuery.data, search, visibility]);

  const siblingRows = useMemo(() => {
    if (!selectedCategory) return [];
    return (categoriesQuery.data ?? []).filter((category) => (category.parentId ?? null) === (selectedCategory.parentId ?? null)).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [categoriesQuery.data, selectedCategory]);

  useEffect(() => {
    if (!selectedCategoryId && rows[0]) setSelectedCategoryId(rows[0].id);
  }, [rows, selectedCategoryId]);

  useEffect(() => {
    if (selectedCategory) setCategoryForm(categoryToForm(selectedCategory));
  }, [selectedCategory]);

  const specs = useMemo(() => (specsQuery.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder || a.attributeKey.localeCompare(b.attributeKey)), [specsQuery.data]);
  const categoryValid = categoryForm.name.trim().length > 0 && categoryForm.slug.trim().length > 0;
  const specValid = Boolean(selectedCategoryId) && specForm.attributeKey.trim().length > 0 && specForm.displayName.trim().length > 0;
  const categoryError = errorText(categoriesQuery.error);
  const specError = errorText(specsQuery.error);

  async function runMutation(action: () => Promise<unknown>, success: string) {
    setNotice("");
    setMutationError("");
    try {
      await action();
      setNotice(success);
    } catch (error) {
      setMutationError(errorText(error));
    }
  }

  function saveCategory() {
    const payload = {
      parentId: categoryForm.parentId || null,
      name: categoryForm.name,
      nameTh: categoryForm.nameTh,
      nameEn: categoryForm.nameEn,
      slug: categoryForm.slug,
      sortOrder: toNumber(categoryForm.sortOrder),
    };
    void runMutation(
      () => categoryForm.id ? updateCategory.mutateAsync({ ...payload, id: categoryForm.id }) : createCategory.mutateAsync(payload),
      categoryForm.id ? "Category updated." : "Category created.",
    );
  }

  function saveCategoryOrder(category: AdminCategory, sortOrder: number) {
    const categories = siblingRows.map((item) => ({ id: item.id, sortOrder: item.id === category.id ? sortOrder : item.sortOrder }));
    void runMutation(() => reorderCategories.mutateAsync({ parentId: category.parentId ?? null, categories }), "Category order updated.");
  }

  function saveSpec() {
    if (!selectedCategoryId) return;
    const payload = {
      categoryId: selectedCategoryId,
      attributeKey: specForm.attributeKey,
      displayName: specForm.displayName,
      displayNameTh: specForm.displayNameTh,
      displayNameEn: specForm.displayNameEn,
      type: specForm.type,
      isRequired: specForm.isRequired,
      isFilterable: specForm.isFilterable,
      sortOrder: toNumber(specForm.sortOrder),
      unit: specForm.unit || null,
    };
    void runMutation(
      () => specForm.id ? updateSpec.mutateAsync({ ...payload, id: specForm.id }) : createSpec.mutateAsync(payload),
      specForm.id ? "Spec updated." : "Spec created.",
    );
  }

  function saveSpecOrder(spec: AdminCategorySpec, sortOrder: number) {
    if (!selectedCategoryId) return;
    const nextSpecs = specs.map((item) => ({ id: item.id, sortOrder: item.id === spec.id ? sortOrder : item.sortOrder }));
    void runMutation(() => reorderSpecs.mutateAsync({ categoryId: selectedCategoryId, specs: nextSpecs }), "Spec order updated.");
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,460px)]">
      <Card className="admin-panel overflow-hidden rounded-xl border-white/10 bg-white/5 py-0">
        <CardHeader className="border-b border-white/10 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white"><FolderTreeIcon className="size-5 text-cyan-200" />Category Workspace</CardTitle>
              <p className="mt-2 text-sm text-slate-400">Search, select, mutate, and reorder admin-visible categories.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search categories" className="pl-9 border-white/10 bg-slate-950/60 text-slate-100 placeholder:text-slate-500" />
              </div>
              <select aria-label="Category visibility" value={visibility} onChange={(event) => setVisibility(event.target.value as VisibilityFilter)} className="h-10 rounded-md border border-white/10 bg-slate-950/80 px-3 text-sm text-slate-100">
                <option value="all">All states</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          {isForbidden(categoriesQuery.error) ? <StateMessage tone="danger" text="Forbidden: admin category access is required." /> : null}
          {categoryError && !isForbidden(categoriesQuery.error) ? <StateMessage tone="danger" text={categoryError} /> : null}
          {notice ? <StateMessage tone="success" text={notice} /> : null}
          {mutationError ? <StateMessage tone="danger" text={mutationError} /> : null}
          {mutationPending ? <StateMessage tone="info" text="Saving changes..." /> : null}

          <CategoryFormPanel
            form={categoryForm}
            categories={categoriesQuery.data ?? []}
            pending={mutationPending}
            valid={categoryValid}
            onChange={setCategoryForm}
            onReset={() => setCategoryForm(emptyCategoryForm)}
            onSubmit={saveCategory}
          />

          <div className="overflow-x-auto rounded-lg border border-white/10">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 bg-white/6 hover:bg-white/6">
                  <TableHead className="px-4 text-slate-300">Category</TableHead>
                  <TableHead className="text-slate-300">Parent</TableHead>
                  <TableHead className="text-slate-300">Sort</TableHead>
                  <TableHead className="text-slate-300">Status</TableHead>
                  <TableHead className="text-right text-slate-300">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length ? rows.map((category) => (
                  <TableRow key={category.id} className={`border-white/8 hover:bg-white/4 ${category.isActive ? "" : "bg-amber-950/20"}`}>
                    <TableCell className="px-4 py-4">
                      <p className="font-medium text-white">{category.name}</p>
                      <p className="text-xs text-slate-500">{category.slug}</p>
                    </TableCell>
                    <TableCell className="text-sm text-slate-300">{categoriesQuery.data?.find((item) => item.id === category.parentId)?.name ?? "Root"}</TableCell>
                    <TableCell>
                      <Input aria-label={`Sort order for ${category.name}`} type="number" min={0} defaultValue={category.sortOrder} disabled={mutationPending} onBlur={(event) => saveCategoryOrder(category, toNumber(event.target.value))} className="h-9 w-20 border-white/10 bg-slate-950/60 text-slate-100" />
                    </TableCell>
                    <TableCell><StatusBadge active={category.isActive} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" className="border-white/10 bg-white/5 text-slate-100" onClick={() => { setSelectedCategoryId(category.id); setCategoryForm(categoryToForm(category)); }}>Select</Button>
                        <Button type="button" size="sm" variant="outline" disabled={mutationPending} className="border-white/10 bg-white/5 text-slate-100" onClick={() => {
                          if (window.confirm(`${category.isActive ? "Deactivate" : "Reactivate"} ${category.name}?`)) {
                            void runMutation(() => setCategoryActive.mutateAsync({ id: category.id, isActive: !category.isActive }), category.isActive ? "Category deactivated." : "Category reactivated.");
                          }
                        }}>{category.isActive ? "Deactivate" : "Reactivate"}</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow className="border-white/8 hover:bg-transparent">
                    <TableCell colSpan={5} className="h-28 text-center text-slate-400">{categoriesQuery.isLoading ? "Loading categories..." : "No categories match the current filters."}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="admin-panel rounded-xl border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white"><ClipboardListIcon className="size-5 text-cyan-200" />Spec Definitions</CardTitle>
          <p className="text-sm text-slate-400">Manage required, filterable, active, and inactive specs for the selected category.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-slate-950/40 p-4">
            <p className="text-xs font-medium uppercase text-slate-500">Selected category</p>
            <p className="mt-2 font-medium text-white">{selectedCategory?.name ?? "No category selected"}</p>
            <p className="text-xs text-slate-500">{selectedCategory?.slug ?? "Select or create a category before editing specs."}</p>
          </div>
          {specError ? <StateMessage tone={isForbidden(specsQuery.error) ? "danger" : "danger"} text={isForbidden(specsQuery.error) ? "Forbidden: admin spec access is required." : specError} /> : null}
          <SpecFormPanel form={specForm} pending={mutationPending || !selectedCategoryId} valid={specValid} onChange={setSpecForm} onReset={() => setSpecForm(emptySpecForm)} onSubmit={saveSpec} />
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <Table>
              <TableHeader><TableRow className="border-white/10 bg-white/6 hover:bg-white/6"><TableHead className="px-4 text-slate-300">Spec</TableHead><TableHead className="text-slate-300">Type</TableHead><TableHead className="text-slate-300">Sort</TableHead><TableHead className="text-slate-300">Rules</TableHead><TableHead className="text-right text-slate-300">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {specs.length ? specs.map((spec) => (
                  <TableRow key={spec.id} className={`border-white/8 hover:bg-white/4 ${spec.isActive ? "" : "bg-amber-950/20"}`}>
                    <TableCell className="px-4 py-3"><p className="font-medium text-white">{spec.displayName}</p><p className="text-xs text-slate-500">{spec.attributeKey}{spec.unit ? ` · ${spec.unit}` : ""}</p></TableCell>
                    <TableCell className="text-sm text-slate-300">{spec.valueType}</TableCell>
                    <TableCell><Input aria-label={`Sort order for ${spec.displayName}`} type="number" min={0} defaultValue={spec.sortOrder} disabled={mutationPending} onBlur={(event) => saveSpecOrder(spec, toNumber(event.target.value))} className="h-9 w-20 border-white/10 bg-slate-950/60 text-slate-100" /></TableCell>
                    <TableCell><div className="flex flex-wrap gap-1"><StatusBadge active={spec.isActive} />{spec.isRequired ? <Badge>Required</Badge> : null}{spec.isFilterable ? <Badge variant="outline">Filterable</Badge> : null}</div></TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" className="border-white/10 bg-white/5 text-slate-100" onClick={() => setSpecForm(specToForm(spec))}>Edit</Button>
                        <Button type="button" size="sm" variant="outline" disabled={mutationPending} className="border-white/10 bg-white/5 text-slate-100" onClick={() => {
                          if (!selectedCategoryId) return;
                          if (window.confirm(`${spec.isActive ? "Deactivate" : "Reactivate"} ${spec.displayName}?`)) {
                            void runMutation(() => setSpecActive.mutateAsync({ categoryId: selectedCategoryId, id: spec.id, isActive: !spec.isActive }), spec.isActive ? "Spec deactivated." : "Spec reactivated.");
                          }
                        }}>{spec.isActive ? "Deactivate" : "Reactivate"}</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow className="border-white/8 hover:bg-transparent">
                    <TableCell colSpan={5} className="h-24 text-center text-slate-400">{!selectedCategoryId ? "Select a category to manage specs." : specsQuery.isLoading ? "Loading specs..." : "No specs exist for this category yet."}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StateMessage({ text, tone }: { text: string; tone: "danger" | "success" | "info" }) {
  const classes = tone === "danger" ? "border-red-300/25 bg-red-300/10 text-red-100" : tone === "success" ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
  return <div className={`rounded-lg border p-3 text-sm ${classes}`}>{text}</div>;
}

function CategoryFormPanel(props: { form: CategoryForm; categories: AdminCategory[]; pending: boolean; valid: boolean; onChange: (form: CategoryForm) => void; onReset: () => void; onSubmit: () => void }) {
  const { form, categories, pending, valid, onChange, onReset, onSubmit } = props;
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/30 p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Category name" htmlFor="category-name"><Input id="category-name" value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} className="border-white/10 bg-slate-950/60 text-slate-100" /></Field>
        <Field label="Slug" htmlFor="category-slug"><Input id="category-slug" value={form.slug} onChange={(event) => onChange({ ...form, slug: event.target.value })} className="border-white/10 bg-slate-950/60 text-slate-100" /></Field>
        <Field label="Sort order" htmlFor="category-sort"><Input id="category-sort" type="number" min={0} value={form.sortOrder} onChange={(event) => onChange({ ...form, sortOrder: event.target.value })} className="border-white/10 bg-slate-950/60 text-slate-100" /></Field>
        <Field label="Thai name" htmlFor="category-name-th"><Input id="category-name-th" value={form.nameTh} onChange={(event) => onChange({ ...form, nameTh: event.target.value })} className="border-white/10 bg-slate-950/60 text-slate-100" /></Field>
        <Field label="English name" htmlFor="category-name-en"><Input id="category-name-en" value={form.nameEn} onChange={(event) => onChange({ ...form, nameEn: event.target.value })} className="border-white/10 bg-slate-950/60 text-slate-100" /></Field>
        <Field label="Parent category" htmlFor="category-parent">
          <select id="category-parent" value={form.parentId} onChange={(event) => onChange({ ...form, parentId: event.target.value })} className="h-10 w-full rounded-md border border-white/10 bg-slate-950/80 px-3 text-sm text-slate-100">
            <option value="">Root</option>
            {categories.filter((category) => category.id !== form.id).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" disabled={pending || !valid} onClick={onSubmit} className="bg-cyan-300 text-slate-950 hover:bg-cyan-200"><SaveIcon className="size-4" />{form.id ? "Save category" : "Create category"}</Button>
        <Button type="button" variant="outline" disabled={pending} onClick={onReset} className="border-white/10 bg-white/5 text-slate-100"><PlusIcon className="size-4" />New category</Button>
      </div>
    </div>
  );
}

function SpecFormPanel(props: { form: SpecForm; pending: boolean; valid: boolean; onChange: (form: SpecForm) => void; onReset: () => void; onSubmit: () => void }) {
  const { form, pending, valid, onChange, onReset, onSubmit } = props;
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/30 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Attribute key" htmlFor="spec-key"><Input id="spec-key" value={form.attributeKey} onChange={(event) => onChange({ ...form, attributeKey: event.target.value })} className="border-white/10 bg-slate-950/60 text-slate-100" /></Field>
        <Field label="Display name" htmlFor="spec-name"><Input id="spec-name" value={form.displayName} onChange={(event) => onChange({ ...form, displayName: event.target.value })} className="border-white/10 bg-slate-950/60 text-slate-100" /></Field>
        <Field label="Thai display name" htmlFor="spec-name-th"><Input id="spec-name-th" value={form.displayNameTh} onChange={(event) => onChange({ ...form, displayNameTh: event.target.value })} className="border-white/10 bg-slate-950/60 text-slate-100" /></Field>
        <Field label="English display name" htmlFor="spec-name-en"><Input id="spec-name-en" value={form.displayNameEn} onChange={(event) => onChange({ ...form, displayNameEn: event.target.value })} className="border-white/10 bg-slate-950/60 text-slate-100" /></Field>
        <Field label="Type" htmlFor="spec-type"><select id="spec-type" value={form.type} onChange={(event) => onChange({ ...form, type: event.target.value as CategorySpecType })} className="h-10 w-full rounded-md border border-white/10 bg-slate-950/80 px-3 text-sm text-slate-100">{specTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></Field>
        <Field label="Unit" htmlFor="spec-unit"><Input id="spec-unit" value={form.unit} onChange={(event) => onChange({ ...form, unit: event.target.value })} className="border-white/10 bg-slate-950/60 text-slate-100" /></Field>
        <Field label="Sort order" htmlFor="spec-sort"><Input id="spec-sort" type="number" min={0} value={form.sortOrder} onChange={(event) => onChange({ ...form, sortOrder: event.target.value })} className="border-white/10 bg-slate-950/60 text-slate-100" /></Field>
        <div className="flex items-end gap-4 text-sm text-slate-200">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.isRequired} onChange={(event) => onChange({ ...form, isRequired: event.target.checked })} />Required</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.isFilterable} onChange={(event) => onChange({ ...form, isFilterable: event.target.checked })} />Filterable</label>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" disabled={pending || !valid} onClick={onSubmit} className="bg-cyan-300 text-slate-950 hover:bg-cyan-200"><SaveIcon className="size-4" />{form.id ? "Save spec" : "Add spec"}</Button>
        <Button type="button" variant="outline" disabled={pending} onClick={onReset} className="border-white/10 bg-white/5 text-slate-100"><RotateCcwIcon className="size-4" />Clear spec</Button>
      </div>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={htmlFor} className="text-slate-300">{label}</Label>{children}</div>;
}

"use client";

import { useMemo, useState } from "react";
import { ClipboardListIcon, FolderTreeIcon, PlusIcon, SaveIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { normalizePublicCategories, publicCategoriesQueryOptions } from "#/features/product/queries";

const draftSpecRows = [
  { key: "brand_model", name: "Brand model", type: "TEXT", required: true, filterable: true },
  { key: "material", name: "Material", type: "TEXT", required: false, filterable: true },
  { key: "warranty_months", name: "Warranty months", type: "NUMBER", required: false, filterable: false },
];

export function AdminCategorySpecsManager() {
  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const categoriesQuery = useQuery({
    ...publicCategoriesQueryOptions({ locale: "en" }),
    select: normalizePublicCategories,
  });
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const categories = categoriesQuery.data ?? [];
    if (!needle) return categories;
    return categories.filter((category) => [category.name, category.slug].some((value) => value.toLowerCase().includes(needle)));
  }, [categoriesQuery.data, search]);
  const selectedCategory = useMemo(() => {
    const categories = categoriesQuery.data ?? [];
    return categories.find((category) => category.id === selectedCategoryId) ?? rows[0] ?? null;
  }, [categoriesQuery.data, rows, selectedCategoryId]);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Card className="admin-panel overflow-hidden rounded-xl border-white/10 bg-white/5 py-0">
        <CardHeader className="border-b border-white/10 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <FolderTreeIcon className="size-5 text-cyan-200" />
                Category Tree
              </CardTitle>
              <p className="mt-2 text-sm text-slate-400">Review active categories that sellers can assign to products. Parent/child editing is disabled until admin category mutation APIs are mounted.</p>
            </div>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search categories"
              className="max-w-sm border-white/10 bg-slate-950/60 text-slate-100 placeholder:text-slate-500"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 bg-white/6 hover:bg-white/6">
                <TableHead className="px-5 text-slate-300">Category</TableHead>
                <TableHead className="text-slate-300">Slug</TableHead>
                <TableHead className="text-slate-300">Sort</TableHead>
                <TableHead className="text-slate-300">Status</TableHead>
                <TableHead className="text-right text-slate-300">Mode</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? rows.map((category) => (
                <TableRow key={category.id} className="border-white/8 hover:bg-white/4">
                  <TableCell className="px-5 py-4 font-medium text-white">{category.name}</TableCell>
                  <TableCell className="text-sm text-slate-300">{category.slug}</TableCell>
                  <TableCell className="text-sm text-slate-300">{category.sortOrder}</TableCell>
                  <TableCell><Badge variant="outline" className="border-emerald-300/30 bg-emerald-300/12 text-emerald-100">Active</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-white/10 bg-white/5 text-slate-100"
                      onClick={() => setSelectedCategoryId(category.id)}
                    >
                      Inspect
                    </Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow className="border-white/8 hover:bg-transparent">
                  <TableCell colSpan={5} className="h-28 text-center text-slate-400">
                    {categoriesQuery.isLoading ? "Loading categories..." : "No categories match the current search."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="admin-panel rounded-xl border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <ClipboardListIcon className="size-5 text-cyan-200" />
            Spec Definitions
          </CardTitle>
          <p className="text-sm text-slate-400">Prepare required and filterable specs for product publish readiness. Draft controls are disabled because persistence endpoints are unavailable.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-100">
            Admin category/spec mutation APIs are not mounted yet. This page reads active category data from the public category API and keeps category/spec changes draft-only.
          </div>
          <div className="rounded-lg border border-white/10 bg-slate-950/40 p-4">
            <p className="text-xs font-medium uppercase text-slate-500">Selected category</p>
            <p className="mt-2 font-medium text-white">{selectedCategory?.name ?? "No category selected"}</p>
            <p className="text-xs text-slate-500">{selectedCategory?.slug ?? "Choose a category to inspect its draft spec plan."}</p>
          </div>
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category-name" className="text-slate-300">Category name</Label>
                <Input id="category-name" disabled value={selectedCategory?.name ?? ""} placeholder="Category name" className="border-white/10 bg-slate-950/60 text-slate-100 placeholder:text-slate-600" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parent-category" className="text-slate-300">Parent category</Label>
                <Input id="parent-category" disabled placeholder="Parent API not available" className="border-white/10 bg-slate-950/60 text-slate-100 placeholder:text-slate-600" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="spec-name" className="text-slate-300">Spec name</Label>
              <Input id="spec-name" disabled placeholder="Display name" className="border-white/10 bg-slate-950/60 text-slate-100 placeholder:text-slate-600" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled className="w-fit bg-cyan-300 text-slate-950 hover:bg-cyan-200">
                <PlusIcon className="size-4" />
                Add spec
              </Button>
              <Button disabled variant="outline" className="w-fit border-white/10 bg-white/5 text-slate-100">
                <SaveIcon className="size-4" />
                Save draft
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-white/10">
            <Table>
              <TableHeader><TableRow className="border-white/10 bg-white/6 hover:bg-white/6"><TableHead className="px-4 text-slate-300">Key</TableHead><TableHead className="text-slate-300">Type</TableHead><TableHead className="text-slate-300">Rules</TableHead></TableRow></TableHeader>
              <TableBody>
                {draftSpecRows.map((spec) => (
                  <TableRow key={spec.key} className="border-white/8 hover:bg-white/4">
                    <TableCell className="px-4 py-3"><p className="font-medium text-white">{spec.name}</p><p className="text-xs text-slate-500">{spec.key}</p></TableCell>
                    <TableCell className="text-sm text-slate-300">{spec.type}</TableCell>
                    <TableCell><div className="flex flex-wrap gap-1">{spec.required ? <Badge>Required</Badge> : null}{spec.filterable ? <Badge variant="outline">Filterable</Badge> : null}</div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

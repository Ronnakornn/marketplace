"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPinIcon, PlusIcon, StarIcon, Trash2Icon } from "lucide-react";
import { BuyerEmptyState, BuyerErrorState, BuyerLoadingList } from "#/components/BuyerState";
import { BuyerTopBar } from "#/components/BuyerShell";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  createAddress,
  deleteAddress,
  fetchAddresses,
  setDefaultAddress,
  type AddressInput,
} from "#/features/buyer/api";

const initialForm: AddressInput = {
  recipientName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "TH",
  isDefault: false,
};

export function AddressBookPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AddressInput>(initialForm);
  const addressesQuery = useQuery({ queryKey: ["buyer-addresses"], queryFn: fetchAddresses });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["buyer-addresses"] });
  const createMutation = useMutation({
    mutationFn: createAddress,
    onSuccess: () => {
      setForm(initialForm);
      void invalidate();
    },
  });
  const defaultMutation = useMutation({ mutationFn: setDefaultAddress, onSuccess: invalidate });
  const deleteMutation = useMutation({ mutationFn: deleteAddress, onSuccess: invalidate });

  return (
    <>
      <BuyerTopBar title="Address book" />
      <div className="mx-auto grid max-w-5xl gap-4 px-3 pb-28 pt-4 lg:grid-cols-[1fr_360px]">
        <section className="space-y-3">
          {addressesQuery.isLoading ? <BuyerLoadingList /> : null}
          {addressesQuery.isError ? <BuyerErrorState message={addressesQuery.error.message} onRetry={() => void addressesQuery.refetch()} /> : null}
          {addressesQuery.isSuccess && addressesQuery.data.length === 0 ? (
            <BuyerEmptyState title="No saved addresses" description="Add a shipping address to speed up checkout." />
          ) : null}
          {addressesQuery.data?.map((address) => (
            <article key={address.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-slate-950">{address.recipientName}</h2>
                    {address.isDefault ? <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">Default</span> : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{[address.line1, address.line2, address.city, address.region, address.postalCode, address.country].filter(Boolean).join(", ")}</p>
                  {address.phone ? <p className="mt-1 text-xs text-slate-500">{address.phone}</p> : null}
                </div>
                <MapPinIcon className="size-5 shrink-0 text-orange-600" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="rounded-full" disabled={address.isDefault || defaultMutation.isPending} onClick={() => defaultMutation.mutate(address.id)}>
                  <StarIcon className="size-4" />
                  Set default
                </Button>
                <Button variant="outline" size="sm" className="rounded-full text-red-600" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(address.id)}>
                  <Trash2Icon className="size-4" />
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </section>

        <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950"><PlusIcon className="size-5 text-orange-600" />Add address</h2>
          <form className="mt-4 space-y-3" onSubmit={(event) => {
            event.preventDefault();
            createMutation.mutate(form);
          }}>
            <Field label="Recipient name" value={form.recipientName} onChange={(value) => setForm({ ...form, recipientName: value })} required />
            <Field label="Phone" value={form.phone ?? ""} onChange={(value) => setForm({ ...form, phone: value })} />
            <Field label="Address line 1" value={form.line1} onChange={(value) => setForm({ ...form, line1: value })} required />
            <Field label="Address line 2" value={form.line2 ?? ""} onChange={(value) => setForm({ ...form, line2: value })} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="City" value={form.city} onChange={(value) => setForm({ ...form, city: value })} required />
              <Field label="Region" value={form.region ?? ""} onChange={(value) => setForm({ ...form, region: value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Postal code" value={form.postalCode} onChange={(value) => setForm({ ...form, postalCode: value })} required />
              <Field label="Country" value={form.country} onChange={(value) => setForm({ ...form, country: value })} required />
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Checkbox checked={form.isDefault} onCheckedChange={(checked) => setForm({ ...form, isDefault: checked === true })} />
              Use as default address
            </label>
            {createMutation.isError ? <p className="text-sm text-red-600">{createMutation.error.message}</p> : null}
            <Button type="submit" className="w-full rounded-2xl bg-orange-600 hover:bg-orange-700" disabled={createMutation.isPending}>
              Save address
            </Button>
          </form>
        </aside>
      </div>
    </>
  );
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  const id = label.toLowerCase().replaceAll(" ", "-");
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} required={required} className="rounded-2xl" />
    </div>
  );
}

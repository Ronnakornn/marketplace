"use client";

import { useEffect, useState } from "react";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUpDownIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Skeleton } from "#/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { ROLES, type AppRole, isAdminRole, isSystemRole } from "#/lib/roles";
import {
  type AdminUser,
  useAdminUsers,
  useCreateAdminUser,
  useDeleteAdminUser,
  useUpdateAdminUser,
} from "../hooks/useAdminUsers";

interface AdminUserTableProps {
  currentUserId: string;
}

interface UserFormState {
  name: string;
  email: string;
  role: AppRole;
  password: string;
}

type UserGroup = "customers" | "system";

const EMPTY_CREATE_FORM: UserFormState = {
  name: "",
  email: "",
  role: ROLES.USER,
  password: "",
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "value" in error &&
    typeof (error as { value?: unknown }).value === "object" &&
    (error as { value?: { message?: unknown } }).value?.message
  ) {
    return String((error as { value?: { message?: unknown } }).value?.message);
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}

function AdminUsersTableSkeleton() {
  return (
    <Card className="admin-panel overflow-hidden rounded-2xl border-white/10 bg-white/5 py-0">
      <CardHeader className="border-b border-white/10 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-7 w-48 bg-white/12" />
          <Skeleton className="h-10 w-36 rounded-lg bg-cyan-300/12" />
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/6">
                {Array.from({ length: 5 }).map((_, index) => (
                  <th key={index} className="px-6 py-3">
                    <Skeleton className="h-4 w-20 bg-white/10" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 3 }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-b border-white/8 last:border-b-0">
                  <td className="px-6 py-4">
                    <Skeleton className="h-5 w-28 bg-white/12" />
                    <Skeleton className="mt-2 h-3 w-10 bg-white/8" />
                  </td>
                  <td className="px-6 py-4">
                    <Skeleton className="h-5 w-44 bg-white/10" />
                  </td>
                  <td className="px-6 py-4">
                    <Skeleton className="h-7 w-16 rounded-full bg-cyan-300/12" />
                  </td>
                  <td className="px-6 py-4">
                    <Skeleton className="h-5 w-24 bg-white/10" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <Skeleton className="h-9 w-20 rounded-lg bg-cyan-300/12" />
                      <Skeleton className="h-9 w-20 rounded-lg bg-red-500/16" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function getRoleBadgeClass(role: AppRole | string) {
  if (isAdminRole(role)) {
    return "border border-cyan-300/20 bg-cyan-300/14 text-cyan-100";
  }

  return "border border-white/10 bg-white/6 text-slate-300";
}

function getGroupCopy(group: UserGroup) {
  if (group === "customers") {
    return {
      title: "Customers",
      description: "Buyer accounts that browse, checkout, review, and request returns.",
      empty: "No customer users found.",
      icon: UsersIcon,
    };
  }

  return {
    title: "System users",
    description: "Admin accounts that manage the marketplace and protected operations.",
    empty: "No system users found.",
    icon: ShieldIcon,
  };
}

function SortableHeader(props: {
  label: string;
  column: { toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" };
}) {
  const { label, column } = props;

  return (
    <Button
      type="button"
      variant="ghost"
      className="-ml-3 h-8 px-3 text-slate-300 hover:bg-white/8 hover:text-white"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ArrowUpDownIcon className="ml-2 size-3.5" />
    </Button>
  );
}

function UserDataTable(props: {
  data: AdminUser[];
  currentUserId: string;
  emptyMessage: string;
  onEdit: (userId: string) => void;
  onDelete: (userId: string) => void;
}) {
  const { data, currentUserId, emptyMessage, onEdit, onDelete } = props;
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns: ColumnDef<AdminUser>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => <SortableHeader label="Name" column={column} />,
      cell: ({ row }) => {
        const user = row.original;
        const isSelf = user.id === currentUserId;

        return (
          <div>
            <div className="font-medium text-slate-100">{user.name}</div>
            {isSelf ? (
              <div className="mt-1 text-xs text-slate-400">You</div>
            ) : null}
          </div>
        );
      },
    },
    {
      accessorKey: "email",
      header: ({ column }) => <SortableHeader label="Email" column={column} />,
      cell: ({ row }) => (
        <span className="text-slate-300">{row.original.email}</span>
      ),
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getRoleBadgeClass(row.original.role)}`}
        >
          {row.original.role}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => <SortableHeader label="Created" column={column} />,
      cell: ({ row }) => (
        <span className="text-slate-300">
          {new Date(row.original.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const user = row.original;
        const isSelf = user.id === currentUserId;

        return (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-cyan-300/20 bg-cyan-300/8 text-cyan-100 hover:bg-cyan-300/16 hover:text-white"
              onClick={() => onEdit(user.id)}
            >
              <PencilIcon className="size-3.5" />
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="bg-red-500 text-white hover:bg-red-500/90 disabled:bg-red-500/35 disabled:text-white/70"
              disabled={isSelf}
              onClick={() => onDelete(user.id)}
            >
              <Trash2Icon className="size-3.5" />
              Delete
            </Button>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          placeholder="Filter users..."
          className="h-9 max-w-sm border-white/10 bg-slate-900/80 text-slate-100 placeholder:text-slate-500"
        />
        <p className="text-sm text-slate-400">
          {table.getFilteredRowModel().rows.length} result(s)
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-white/10 bg-white/6 hover:bg-white/6"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="px-4 py-3 text-slate-300">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-white/8 hover:bg-white/4"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="border-white/8 hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-28 text-center text-slate-300"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end gap-2 py-4">
        <Button
          variant="outline"
          size="sm"
          className="border-white/12 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-white/12 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function UserDialogForm(props: {
  mode: "create" | "edit";
  open: boolean;
  title: string;
  description: string;
  submitLabel: string;
  initialValues: UserFormState;
  disableUserRoleOption?: boolean;
  roleHint?: string | null;
  pending: boolean;
  errorMessage: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: UserFormState) => Promise<void>;
}) {
  const {
    mode,
    open,
    title,
    description,
    submitLabel,
    initialValues,
    disableUserRoleOption = false,
    roleHint = null,
    pending,
    errorMessage,
    onOpenChange,
    onSubmit,
  } = props;
  const [form, setForm] = useState<UserFormState>(initialValues);

  useEffect(() => {
    if (open) {
      setForm(initialValues);
    }
  }, [initialValues, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-white/12 bg-slate-950/95 text-slate-100 shadow-[0_24px_80px_rgba(2,6,23,0.8)] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-slate-400">
            {description}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit(form);
          }}
        >
          {errorMessage && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/12 px-3 py-2 text-sm text-red-200">
              {errorMessage}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-200" htmlFor={`${mode}-name`}>
              Name
            </label>
            <Input
              id={`${mode}-name`}
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              className="border-white/10 bg-slate-900/80 text-slate-100 placeholder:text-slate-500"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-200" htmlFor={`${mode}-email`}>
              Email
            </label>
            <Input
              id={`${mode}-email`}
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
              className="border-white/10 bg-slate-900/80 text-slate-100 placeholder:text-slate-500"
              required
            />
          </div>

          {mode === "create" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-200" htmlFor="create-password">
                Password
              </label>
              <Input
                id="create-password"
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password: event.target.value }))
                }
                className="border-white/10 bg-slate-900/80 text-slate-100 placeholder:text-slate-500"
                minLength={8}
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-200" htmlFor={`${mode}-role`}>
              Role
            </label>
            <select
              id={`${mode}-role`}
              value={form.role}
              onChange={(event) =>
                setForm((current) => ({ ...current, role: event.target.value as AppRole }))
              }
              className="flex h-9 w-full rounded-md border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20"
            >
              <option value={ROLES.USER} disabled={disableUserRoleOption}>USER</option>
              <option value={ROLES.ADMIN}>ADMIN</option>
            </select>
            {roleHint ? (
              <p className="text-xs text-slate-400">{roleHint}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-white/12 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[linear-gradient(90deg,rgba(34,211,238,0.9),rgba(168,85,247,0.9))] text-slate-950 hover:opacity-95"
              disabled={pending}
            >
              {pending ? "Saving..." : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdminUserTable({ currentUserId }: AdminUserTableProps) {
  const {
    data: users = [],
    isLoading,
    error,
    refetch,
  } = useAdminUsers();
  const createUser = useCreateAdminUser();
  const updateUser = useUpdateAdminUser();
  const deleteUser = useDeleteAdminUser();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<UserGroup>("customers");

  const editingUser = users.find((user) => user.id === editingUserId) ?? null;
  const deletingUser = users.find((user) => user.id === deletingUserId) ?? null;
  const customerUsers = users.filter((user) => !isSystemRole(user.role));
  const systemUsers = users.filter((user) => isSystemRole(user.role));
  const visibleUsers = activeGroup === "customers" ? customerUsers : systemUsers;
  const activeGroupCopy = getGroupCopy(activeGroup);
  const ActiveGroupIcon = activeGroupCopy.icon;

  if (isLoading) {
    return <AdminUsersTableSkeleton />;
  }

  if (error) {
    return (
      <Card className="border-red-500/30 bg-red-500/10">
        <CardContent className="pt-6">
          <p className="text-sm text-red-200">
            {getErrorMessage(error, "Failed to load users")}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 border-white/12 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
            onClick={() => void refetch()}
          >
            <RefreshCwIcon className="size-3.5" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="admin-panel overflow-hidden rounded-2xl border-white/10 bg-white/5 py-0">
        <CardHeader className="border-b border-white/10 py-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-white">
                  <UsersIcon className="size-5 text-cyan-200" />
                  User Management
                </CardTitle>
                <p className="mt-2 text-sm text-slate-300">
                  Separate customer accounts from admin system users.
                </p>
              </div>
              <Button
                size="sm"
                className="border border-cyan-300/30 bg-[linear-gradient(90deg,rgba(125,211,252,0.95),rgba(167,243,208,0.95))] font-semibold text-slate-950 shadow-[0_10px_30px_rgba(103,232,249,0.18)] hover:brightness-105"
                onClick={() => {
                  setCreateError(null);
                  setIsCreateOpen(true);
                }}
              >
                <PlusIcon className="size-4" />
                Create User
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                {
                  key: "customers",
                  title: "Customers",
                  count: customerUsers.length,
                  icon: UsersIcon,
                },
                {
                  key: "system",
                  title: "System users",
                  count: systemUsers.length,
                  icon: ShieldIcon,
                },
              ] as const).map((item) => {
                const Icon = item.icon;
                const isActive = activeGroup === item.key;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveGroup(item.key)}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      isActive
                        ? "border-cyan-300/35 bg-cyan-300/12 text-white"
                        : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/8 hover:text-white"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <Icon className="size-4" />
                        {item.title}
                      </span>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">
                        {item.count}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-start gap-3">
                <ActiveGroupIcon className="mt-0.5 size-4 text-cyan-200" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {activeGroupCopy.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {activeGroupCopy.description}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <UserDataTable
            data={visibleUsers}
            currentUserId={currentUserId}
            emptyMessage={activeGroupCopy.empty}
            onEdit={(userId) => {
              setUpdateError(null);
              setEditingUserId(userId);
            }}
            onDelete={(userId) => {
              setDeleteError(null);
              setDeletingUserId(userId);
            }}
          />
        </CardContent>
      </Card>

      <UserDialogForm
        mode="create"
        open={isCreateOpen}
        title="Create user"
        description="Create an account that can sign in immediately."
        submitLabel="Create"
        initialValues={EMPTY_CREATE_FORM}
        pending={createUser.isPending}
        errorMessage={createError}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) setCreateError(null);
        }}
        onSubmit={async (values) => {
          try {
            setCreateError(null);
            await createUser.mutateAsync(values);
            setIsCreateOpen(false);
          } catch (submitError) {
            setCreateError(getErrorMessage(submitError, "Failed to create user"));
          }
        }}
      />

      <UserDialogForm
        mode="edit"
        open={editingUser !== null}
        title="Edit user"
        description="Update the profile and role for this account."
        submitLabel="Save changes"
        initialValues={{
          name: editingUser?.name ?? "",
          email: editingUser?.email ?? "",
          role: (editingUser?.role ?? ROLES.USER) as AppRole,
          password: "",
        }}
        disableUserRoleOption={editingUser?.id === currentUserId && editingUser.role === ROLES.ADMIN}
        roleHint={
          editingUser?.id === currentUserId && editingUser.role === ROLES.ADMIN
            ? "Your admin access cannot be removed from this screen."
            : null
        }
        pending={updateUser.isPending}
        errorMessage={updateError}
        onOpenChange={(open) => {
          if (!open) {
            setEditingUserId(null);
            setUpdateError(null);
          }
        }}
        onSubmit={async (values) => {
          if (!editingUser) return;
          try {
            setUpdateError(null);
            await updateUser.mutateAsync({
              id: editingUser.id,
              name: values.name,
              email: values.email,
              role: values.role,
            });
            setEditingUserId(null);
          } catch (submitError) {
            setUpdateError(getErrorMessage(submitError, "Failed to update user"));
          }
        }}
      />

      <Dialog
        open={deletingUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingUserId(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent className="border border-white/12 bg-slate-950/95 text-slate-100 shadow-[0_24px_80px_rgba(2,6,23,0.8)]">
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription className="text-slate-400">
              This permanently deletes the account and related data.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/12 px-3 py-2 text-sm text-red-200">
              {deleteError}
            </div>
          )}

          <div className="rounded-lg border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-100">
            {deletingUser ? (
              <>
                Delete <span className="font-semibold">{deletingUser.email}</span>?
              </>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-white/12 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
              onClick={() => {
                setDeletingUserId(null);
                setDeleteError(null);
              }}
              disabled={deleteUser.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="bg-red-500 text-white hover:bg-red-500/90 disabled:bg-red-500/35 disabled:text-white/70"
              disabled={deleteUser.isPending || !deletingUser}
              onClick={() => {
                if (!deletingUser) return;
                void deleteUser
                  .mutateAsync(deletingUser.id)
                  .then(() => {
                    setDeletingUserId(null);
                    setDeleteError(null);
                  })
                  .catch((submitError) => {
                    setDeleteError(getErrorMessage(submitError, "Failed to delete user"));
                  });
              }}
            >
              {deleteUser.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

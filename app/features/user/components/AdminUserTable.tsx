"use client";

import { useEffect, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import { Button } from "#/components/ui/button";
import { Badge } from "#/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { DataTable } from "#/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { NativeSelect, NativeSelectOption } from "#/components/ui/native-select";
import { Skeleton } from "#/components/ui/skeleton";
import { useTranslations } from "#/i18n/client";
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
          <Table>
            <TableHeader>
              <TableRow className="border-b border-white/10 bg-white/6">
                {Array.from({ length: 5 }).map((_, index) => (
                  <TableHead key={index} className="px-6 py-3">
                    <Skeleton className="h-4 w-20 bg-white/10" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 3 }).map((_, rowIndex) => (
                <TableRow key={rowIndex} className="border-b border-white/8 last:border-b-0">
                  <TableCell className="px-6 py-4">
                    <Skeleton className="h-5 w-28 bg-white/12" />
                    <Skeleton className="mt-2 h-3 w-10 bg-white/8" />
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <Skeleton className="h-5 w-44 bg-white/10" />
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <Skeleton className="h-7 w-16 rounded-full bg-cyan-300/12" />
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <Skeleton className="h-5 w-24 bg-white/10" />
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      <Skeleton className="h-9 w-20 rounded-lg bg-cyan-300/12" />
                      <Skeleton className="h-9 w-20 rounded-lg bg-red-500/16" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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

function getGroupCopy(group: UserGroup, t: ReturnType<typeof useTranslations>) {
  if (group === "customers") {
    return {
      title: t("admin.userManagement.customers"),
      description: t("admin.userManagement.customersDescription"),
      empty: t("admin.userManagement.noCustomers"),
      icon: UsersIcon,
    };
  }

  return {
    title: t("admin.userManagement.systemUsers"),
    description: t("admin.userManagement.systemUsersDescription"),
    empty: t("admin.userManagement.noSystemUsers"),
    icon: ShieldIcon,
  };
}

function UserDataTable(props: {
  data: AdminUser[];
  currentUserId: string;
  emptyMessage: string;
  onEdit: (userId: string) => void;
  onDelete: (userId: string) => void;
}) {
  const t = useTranslations();
  const { data, currentUserId, emptyMessage, onEdit, onDelete } = props;
  const columns: ColumnDef<AdminUser>[] = [
    {
      accessorKey: "name",
      header: t("admin.userManagement.name"),
      cell: ({ row }) => {
        const user = row.original;
        const isSelf = user.id === currentUserId;

        return (
          <div>
            <div className="font-medium text-slate-100">{user.name}</div>
            {isSelf ? (
              <div className="mt-1 text-xs text-slate-400">{t("admin.userManagement.you")}</div>
            ) : null}
          </div>
        );
      },
    },
    {
      accessorKey: "email",
      header: t("admin.userManagement.email"),
      cell: ({ row }) => (
        <span className="text-slate-300">{row.original.email}</span>
      ),
    },
    {
      accessorKey: "role",
      header: t("admin.role"),
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
      header: t("admin.userManagement.created"),
      cell: ({ row }) => (
        <span className="text-slate-300">
          {new Date(row.original.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right">{t("admin.userManagement.actions")}</div>,
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
              {t("admin.userManagement.edit")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="bg-red-500 text-white hover:bg-red-500/90 disabled:bg-red-500/35 disabled:text-white/70"
              disabled={isSelf}
              onClick={() => onDelete(user.id)}
            >
              <Trash2Icon className="size-3.5" />
              {t("admin.userManagement.delete")}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="px-6 py-5">
      <DataTable
        columns={columns}
        data={data}
        emptyMessage={emptyMessage}
        renderToolbar={(table) => (
          <>
            <Input
              value={(table.getState().globalFilter as string | undefined) ?? ""}
              onChange={(event) => table.setGlobalFilter(event.target.value)}
              placeholder={t("admin.userManagement.filter")}
              className="h-9 max-w-sm"
            />
            <p className="text-sm text-muted-foreground">
              {t("admin.userManagement.results").replace("{count}", String(table.getFilteredRowModel().rows.length))}
            </p>
          </>
        )}
      />
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
  const t = useTranslations();
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
              {t("admin.userManagement.name")}
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
              {t("admin.userManagement.email")}
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
                {t("admin.userManagement.password")}
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
              {t("admin.role")}
            </label>
            <NativeSelect
              id={`${mode}-role`}
              value={form.role}
              onChange={(event) =>
                setForm((current) => ({ ...current, role: event.target.value as AppRole }))
              }
              className="w-full"
            >
              <NativeSelectOption value={ROLES.USER} disabled={disableUserRoleOption}>USER</NativeSelectOption>
              <NativeSelectOption value={ROLES.ADMIN}>ADMIN</NativeSelectOption>
            </NativeSelect>
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
              {t("admin.common.cancel")}
            </Button>
            <Button
              type="submit"
              className="bg-[linear-gradient(90deg,rgba(34,211,238,0.9),rgba(168,85,247,0.9))] text-slate-950 hover:opacity-95"
              disabled={pending}
            >
              {pending ? t("admin.userManagement.saving") : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdminUserTable({ currentUserId }: AdminUserTableProps) {
  const t = useTranslations();
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
  const activeGroupCopy = getGroupCopy(activeGroup, t);
  const ActiveGroupIcon = activeGroupCopy.icon;

  if (isLoading) {
    return <AdminUsersTableSkeleton />;
  }

  if (error) {
    return (
      <Card className="border-red-500/30 bg-red-500/10">
        <CardContent className="pt-6">
          <p className="text-sm text-red-200">
            {getErrorMessage(error, t("admin.userManagement.loadFailed"))}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 border-white/12 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
            onClick={() => void refetch()}
          >
            <RefreshCwIcon className="size-3.5" />
            {t("admin.common.retry")}
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
                  {t("admin.userManagement.title")}
                </CardTitle>
                <p className="mt-2 text-sm text-slate-300">
                  {t("admin.userManagement.description")}
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
                {t("admin.userManagement.createUser")}
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                {
                  key: "customers",
                  title: t("admin.userManagement.customers"),
                  count: customerUsers.length,
                  icon: UsersIcon,
                },
                {
                  key: "system",
                  title: t("admin.userManagement.systemUsers"),
                  count: systemUsers.length,
                  icon: ShieldIcon,
                },
              ] as const).map((item) => {
                const Icon = item.icon;
                const isActive = activeGroup === item.key;

                return (
                  <Button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveGroup(item.key)}
                    variant="outline"
                    className={`h-auto justify-start rounded-xl px-4 py-3 text-left transition ${
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
                      <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
                        {item.count}
                      </Badge>
                    </span>
                  </Button>
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
        title={t("admin.userManagement.createTitle")}
        description={t("admin.userManagement.createDescription")}
        submitLabel={t("admin.userManagement.createUser")}
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
            setCreateError(getErrorMessage(submitError, t("admin.userManagement.createFailed")));
          }
        }}
      />

      <UserDialogForm
        mode="edit"
        open={editingUser !== null}
        title={t("admin.userManagement.editTitle")}
        description={t("admin.userManagement.editDescription")}
        submitLabel={t("admin.userManagement.saveChanges")}
        initialValues={{
          name: editingUser?.name ?? "",
          email: editingUser?.email ?? "",
          role: (editingUser?.role ?? ROLES.USER) as AppRole,
          password: "",
        }}
        disableUserRoleOption={editingUser?.id === currentUserId && editingUser.role === ROLES.ADMIN}
        roleHint={
          editingUser?.id === currentUserId && editingUser.role === ROLES.ADMIN
            ? t("admin.userManagement.selfRoleHint")
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
            setUpdateError(getErrorMessage(submitError, t("admin.userManagement.updateFailed")));
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
            <DialogTitle>{t("admin.userManagement.deleteTitle")}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {t("admin.userManagement.deleteDescription")}
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
                {t("admin.userManagement.deleteConfirm").replace("{email}", deletingUser.email)}
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
              {t("admin.common.cancel")}
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
                    setDeleteError(getErrorMessage(submitError, t("admin.userManagement.deleteFailed")));
                  });
              }}
            >
              {deleteUser.isPending ? t("admin.userManagement.deleting") : t("admin.userManagement.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

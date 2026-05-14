"use client";

import { useQuery } from "@tanstack/react-query";
import type { Treaty } from "@elysiajs/eden";
import { api } from "#/lib/eden";
import { PAGE_SIZE } from "#/features/admin/hooks/useAdminOperations";

export type AuditLogsResponse = Treaty.Data<ReturnType<(typeof api.api.admin)["audit-logs"]["get"]>>;
export type AuditLog = AuditLogsResponse extends { items: Array<infer T> } ? T : never;

export interface AuditLogFilters {
  actorUserId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  from?: string;
  to?: string;
  page: number;
  limit?: number;
}

function cleanQuery(filters: AuditLogFilters) {
  return Object.fromEntries(
    Object.entries({
      actorUserId: filters.actorUserId || undefined,
      action: filters.action || undefined,
      entityType: filters.entityType || undefined,
      entityId: filters.entityId || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      page: filters.page,
      limit: filters.limit ?? PAGE_SIZE,
    }).filter(([, value]) => value !== undefined),
  );
}

export function useAuditLogs(filters: AuditLogFilters) {
  return useQuery({
    queryKey: ["admin", "audit-logs", cleanQuery(filters)],
    queryFn: async () => {
      const { data, error } = await api.api.admin["audit-logs"].get({ query: cleanQuery(filters) });
      if (error) throw error;
      return data;
    },
  });
}

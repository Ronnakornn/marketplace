import { t } from 'elysia'

export const ListPageQuery = {
  page: t.Optional(t.Integer({ minimum: 1, maximum: 2_147_483_647 })),
  limit: t.Optional(t.Integer({ minimum: 1, maximum: 50 })),
}

export interface ListPageInput { page?: number; limit?: number }

export function listPage(input: ListPageInput = {}) {
  const page = input.page ?? 1
  const limit = input.limit ?? 20
  return { page, limit, skip: (page - 1) * limit, take: limit }
}

export function listPageResult<T>(data: T[], totalCount: number, input: ListPageInput) {
  const { page, limit } = listPage(input)
  return { data, meta: {
    page, limit, totalCount, totalPages: Math.ceil(totalCount / limit),
    hasNextPage: page * limit < totalCount, hasPreviousPage: page > 1,
  } }
}

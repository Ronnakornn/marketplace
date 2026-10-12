'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '#/lib/eden'
import { invalidateProductMutationQueries } from '#/features/product/queries'

export type CatalogApprovalInput = Parameters<ReturnType<typeof api.api.admin.catalog.products>['approval']['post']>[0]

export function useCatalogPublicationReview() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ productId, input }: { productId: string; input: CatalogApprovalInput }) => {
      const response = await api.api.admin.catalog.products({ productId }).approval.post(input)
      if (response.error) throw response.error
      return response.data
    },
    onSuccess: async product => {
      await invalidateProductMutationQueries(client, { productId: product.id, affectsPublic: true, affectsAffiliateTargets: true })
      await client.invalidateQueries({ queryKey: ['admin', 'catalog', 'moderation'] })
    },
  })
}

import { z } from 'zod'
const authContext = z.object({
  authContext: z.object({
    user: z.object({ id: z.string(), role: z.enum(['USER', 'ADMIN']) }),
  }),
})
export function reportingActor(context: unknown) {
  return authContext.parse(context).authContext.user
}

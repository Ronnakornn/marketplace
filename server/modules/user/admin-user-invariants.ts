import type { Prisma, User } from '#generated/client/client.ts'
import { UserServiceError } from './user.errors.ts'
import type {
  AdminActor,
  AdminAuthorizer,
} from '#server/modules/admin-access/admin-access.contract.ts'

export async function lockAdminUserChange(
  tx: Prisma.TransactionClient,
  userId: string,
  changes: Partial<Pick<User, 'role' | 'status' | 'emailVerified'>> & {
    deleting?: boolean
  },
  actor?: AdminActor,
  access?: AdminAuthorizer,
) {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(719362804)`
  const member = await tx.adminTeamMember.findUnique({
    where: { userId },
    include: {
      user: { select: { role: true, status: true, emailVerified: true } },
    },
  })
  if (access) {
    if (!actor) throw new UserServiceError('Administrator actor required', 403)
    const target =
      member?.user ??
      (await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { role: true },
      }))
    await access.require(
      actor,
      target.role === 'ADMIN' ||
        (changes.role !== undefined && changes.role !== target.role)
        ? 'team.manage'
        : 'users.write',
    )
    if (
      member?.isOwner &&
      !(
        await tx.adminTeamMember.findUnique({
          where: { userId: actor.id },
          select: { isOwner: true },
        })
      )?.isOwner
    )
      throw new UserServiceError(
        'Only an owner can change another owner account',
        403,
      )
  }
  if (!member?.isOwner || !member.isActive) return
  const remainsEligible =
    !changes.deleting &&
    (changes.role ?? member.user.role) === 'ADMIN' &&
    (changes.status ?? member.user.status) === 'ACTIVE' &&
    (changes.emailVerified ?? member.user.emailVerified)
  if (remainsEligible) return
  const owners = await tx.adminTeamMember.count({
    where: {
      userId: { not: userId },
      isActive: true,
      isOwner: true,
      user: { role: 'ADMIN', status: 'ACTIVE', emailVerified: true },
    },
  })
  if (owners === 0)
    throw new UserServiceError(
      'The final active administrator owner cannot be removed',
      409,
    )
}

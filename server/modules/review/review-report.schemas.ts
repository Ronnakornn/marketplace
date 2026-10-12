import { t, type Static } from 'elysia'
import { ReviewReportPlain } from '#generated/prismabox/ReviewReport.ts'

const detail = t.Partial(t.Pick(ReviewReportPlain, ['detail']))
const reason = t.Pick(ReviewReportPlain, ['reason'])
export const ReportReviewSchema = t.Union([
  t.Object({ ...reason.properties, ...detail.properties, reviewId: t.String({ format: 'uuid' }), shopRatingId: t.Optional(t.Never()) }, { additionalProperties: false }),
  t.Object({ ...reason.properties, ...detail.properties, shopRatingId: t.String({ format: 'uuid' }), reviewId: t.Optional(t.Never()) }, { additionalProperties: false }),
])
export type ReportReviewInput = Static<typeof ReportReviewSchema>

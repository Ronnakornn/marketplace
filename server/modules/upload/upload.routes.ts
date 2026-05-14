import { Elysia, status as httpStatus, t } from 'elysia'
import type { ServiceContainer } from '#server/context/app-context.ts'
import { authPlugin } from '#server/modules/auth'
import { UploadServiceError } from './upload.errors.ts'

const PresignedUrlBodySchema = t.Object({
  fileName: t.String({ minLength: 1 }),
  contentType: t.String({ minLength: 1 }),
  fileSize: t.Number({ minimum: 1 }),
  usage: t.String({ minLength: 1 }),
})

const CompleteUploadBodySchema = t.Object({
  fileId: t.String({ format: 'uuid' }),
})

const UploadParamsSchema = t.Object({
  fileId: t.String({ format: 'uuid' }),
})

export function createUploadRoutes(container: ServiceContainer) {
  return new Elysia()
    .use(authPlugin)
    .onError(({ error }) => {
      if (error instanceof UploadServiceError) {
        return httpStatus(error.status, {
          error: {
            code: error.code,
            message: error.message,
            details: error.details ?? {},
          },
        })
      }
    })
    .post('/api/uploads/presigned-url', ({ authContext, body }: any) =>
      container.uploadService.createPresignedUrl(authContext!.user, body), {
      withAuth: true,
      body: PresignedUrlBodySchema,
    })
    .post('/api/uploads/complete', ({ authContext, body }: any) =>
      container.uploadService.completeUpload(authContext!.user, body.fileId), {
      withAuth: true,
      body: CompleteUploadBodySchema,
    })
    .get('/api/uploads/:fileId', ({ authContext, params }: any) =>
      container.uploadService.getUpload(authContext!.user, params.fileId), {
      withAuth: true,
      params: UploadParamsSchema,
    })
}

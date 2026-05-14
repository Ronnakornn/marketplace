import { SecurityError } from './security.errors.ts'

export const allowedImageMimeTypes = ['image/jpeg', 'image/png', 'image/webp'] as const

export interface ValidateUploadInput {
  contentType: string
  fileSize: number
  maxFileSize: number
  allowedMimeTypes?: readonly string[]
}

export function validateUploadInput(input: ValidateUploadInput): void {
  const allowedMimeTypes = input.allowedMimeTypes ?? allowedImageMimeTypes
  if (!allowedMimeTypes.includes(input.contentType)) {
    throw new SecurityError('Unsupported upload media type', 415, 'UNSUPPORTED_MEDIA_TYPE', {
      allowedMimeTypes: [...allowedMimeTypes],
    })
  }
  if (!Number.isInteger(input.fileSize) || input.fileSize <= 0 || input.fileSize > input.maxFileSize) {
    throw new SecurityError('Upload payload is too large', 413, 'PAYLOAD_TOO_LARGE', {
      maxFileSize: input.maxFileSize,
    })
  }
}

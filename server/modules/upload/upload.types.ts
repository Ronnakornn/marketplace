import type { Role } from '#generated/client/enums.ts'

export const uploadUsages = ['product_image', 'shop_image', 'review_image', 'review_video', 'kyc_document'] as const
export type UploadUsageInput = typeof uploadUsages[number]

export interface UploadActor {
  id: string
  role: Role
}

export interface PresignedUploadInput {
  fileName: string
  contentType: string
  fileSize: number
  usage: UploadUsageInput
}

export interface CompleteUploadInput {
  fileId: string
}

export interface PresignedUploadResponse {
  fileId: string
  uploadUrl: string
  publicUrl?: string
  key: string
  expiresIn: number
}

export interface UploadResponse {
  id: string
  userId: string
  usage: UploadUsageInput
  status: 'pending' | 'completed'
  fileName: string
  contentType: string
  fileSize: number
  key: string
  publicUrl?: string
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface StorageConfig {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  publicBaseUrl?: string
  cdnBaseUrl?: string
}

export interface CreatePresignedPutUrlInput {
  key: string
  contentType: string
  fileSize: number
  expiresIn: number
  cacheControl?: string
}

export interface UploadStorage {
  createPresignedPutUrl(input: CreatePresignedPutUrlInput): Promise<string>
  getPublicUrl(key: string): string | undefined
}

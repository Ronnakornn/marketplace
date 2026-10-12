'use client'

import { api } from '#/lib/eden'

export async function uploadSupportAttachment(file: File) {
  const presigned = await api.api.uploads['presigned-url'].post({
    fileName: file.name, contentType: file.type, fileSize: file.size, usage: 'support_attachment',
  })
  if (presigned.error || !presigned.data) throw new Error('SUPPORT_UPLOAD_FAILED')
  const result = await fetch(presigned.data.uploadUrl, { method: 'PUT', body: file, headers: { 'content-type': file.type } })
  if (!result.ok) throw new Error('SUPPORT_UPLOAD_FAILED')
  const completed = await api.api.uploads.complete.post({ fileId: presigned.data.fileId })
  if (completed.error || !completed.data) throw new Error('SUPPORT_UPLOAD_FAILED')
  return completed.data.id
}

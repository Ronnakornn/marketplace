import { CHAT_ATTACHMENT_POLICY } from '#/lib/chat-attachments.ts'
import { ChatServiceError } from './chat.errors.ts'

export function isChatMultipartRequest(request: Request): boolean {
  return request.method === 'POST' && /^\/api\/chats\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/messages$/i.test(new URL(request.url).pathname)
    && /^multipart\/form-data(?:;|$)/i.test(request.headers.get('content-type') ?? '')
}

export function getChatRequestBodyLimit(request: Request): number | undefined {
  return isChatMultipartRequest(request) ? CHAT_ATTACHMENT_POLICY.maxRequestBytes : undefined
}

export async function parseChatMessage(request: Request): Promise<unknown> {
  const multipart = isChatMultipartRequest(request)
  const limit = multipart ? CHAT_ATTACHMENT_POLICY.maxRequestBytes : 1024 * 1024
  const reader = request.body?.getReader()
  if (!reader) throw new ChatServiceError('Message body is required', 400, 'INVALID_MESSAGE')
  const chunks: Uint8Array[] = []
  let size = 0
  const timer = setTimeout(() => { void reader.cancel('Chat request timed out').catch(() => undefined) }, 30_000)
  const started = Date.now()
  try {
    while (true) {
      const item = await reader.read()
      if (Date.now() - started >= 30_000) throw new ChatServiceError('Chat request timed out', 400, 'INVALID_MESSAGE')
      if (item.done) break
      size += item.value.byteLength
      if (size > limit) {
        await reader.cancel()
        throw new ChatServiceError('Request payload is too large', 413, 'PAYLOAD_TOO_LARGE')
      }
      chunks.push(item.value)
    }
  } finally {
    clearTimeout(timer)
    // Bun native HTTP readers can throw on releaseLock after draining; this reader has no next consumer.
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  try {
    if (!multipart) return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    const form = await new Response(bytes, { headers: { 'content-type': request.headers.get('content-type') ?? '' } }).formData()
    const fields: Record<string, string> = {}
    const files: File[] = []
    for (const [key, value] of form.entries()) {
      if (key === 'files' && value instanceof File) {
        files.push(value)
        if (files.length > CHAT_ATTACHMENT_POLICY.maxFiles) throw new ChatServiceError('At most five attachments are allowed', 400, 'INVALID_CHAT_ATTACHMENT')
      }
      else {
        if (!['clientMessageId', 'body', 'productId', 'orderId', 'scope'].includes(key) || typeof value !== 'string' || key in fields) {
          throw new ChatServiceError('Invalid multipart field', 400, 'INVALID_MESSAGE')
        }
        fields[key] = value
      }
    }
    if (!fields.clientMessageId) throw new ChatServiceError('Multipart requires a message ID', 400, 'INVALID_MESSAGE')
    return { ...fields, messageType: 'text', files }
  } catch (error) {
    if (error instanceof ChatServiceError) throw error
    throw new ChatServiceError('Invalid message body', 400, 'INVALID_MESSAGE')
  }
}

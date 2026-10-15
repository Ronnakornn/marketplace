import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { CHAT_ATTACHMENT_POLICY } from '#/lib/chat-attachments.ts'
import { ChatServiceError } from './chat.errors.ts'
import type { ChatAttachment } from '#generated/client/client.ts'

export type ChatFileMetadata = Pick<ChatAttachment, 'ordinal' | 'fileName' | 'contentType' | 'byteSize' | 'sha256'> & { kind: 'IMAGE' | 'FILE' }
export type ValidatedChatFile = ChatFileMetadata & { bytes: Uint8Array }
export type StoredChatFile = ChatFileMetadata & { storageKey: string }

function invalid(message: string): never { throw new ChatServiceError(message, 400, 'INVALID_CHAT_ATTACHMENT') }

export function safeChatFileName(name: string): string {
  const cleaned = name.normalize('NFC').replace(/[\\/\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim()
  const result = Array.from(cleaned).slice(0, 180).join('')
  if (!result || result === '.' || result === '..') invalid('Invalid attachment filename')
  return result
}

function zipEntries(bytes: Buffer): Set<string> {
  if (bytes.readUInt32LE(0) !== 0x04034b50) invalid('Invalid ZIP header')
  let end = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50) { end = i; break }
  }
  if (end < 0) invalid('Invalid ZIP directory')
  const count = bytes.readUInt16LE(end + 10)
  const directorySize = bytes.readUInt32LE(end + 12)
  let offset = bytes.readUInt32LE(end + 16)
  if (bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6) || count > 2048 || !count
    || directorySize > 1024 * 1024 || offset + directorySize !== end
    || end + 22 + bytes.readUInt16LE(end + 20) !== bytes.length) invalid('Unsupported ZIP container')
  const names = new Set<string>()
  let expanded = 0
  const directoryEnd = offset + directorySize
  for (let i = 0; i < count; i++) {
    if (offset + 46 > directoryEnd || bytes.readUInt32LE(offset) !== 0x02014b50) invalid('Invalid ZIP entry')
    const flags = bytes.readUInt16LE(offset + 8)
    const method = bytes.readUInt16LE(offset + 10)
    const compressed = bytes.readUInt32LE(offset + 20)
    const size = bytes.readUInt32LE(offset + 24)
    const length = bytes.readUInt16LE(offset + 28)
    const extra = bytes.readUInt16LE(offset + 30)
    const comment = bytes.readUInt16LE(offset + 32)
    const local = bytes.readUInt32LE(offset + 42)
    const next = offset + 46 + length + extra + comment
    if (next > directoryEnd || flags & 1 || ![0, 8].includes(method) || local + 30 > bytes.length
      || bytes.readUInt32LE(local) !== 0x04034b50) invalid('Unsupported ZIP entry')
    const name = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(offset + 46, offset + 46 + length))
    if (name.startsWith('/') || name.includes('\\') || name.split('/').includes('..') || names.has(name)) invalid('Unsafe ZIP entry')
    const dataOffset = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28)
    const localName = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(local + 30, local + 30 + bytes.readUInt16LE(local + 26)))
    if (localName !== name || bytes.readUInt16LE(local + 8) !== method || bytes.readUInt16LE(local + 6) !== flags) invalid('ZIP directory disagrees with entry')
    if (dataOffset + compressed > bytes.readUInt32LE(end + 16)) invalid('Invalid ZIP content range')
    expanded += size
    if (expanded > 100 * 1024 * 1024 || size > Math.max(compressed * 200, 1024 * 1024)) invalid('ZIP expansion exceeds limits')
    names.add(name)
    offset = next
  }
  if (offset !== directoryEnd) invalid('Invalid ZIP directory size')
  return names
}

export async function validateChatFiles(files: readonly File[]): Promise<ValidatedChatFile[]> {
  if (files.length > CHAT_ATTACHMENT_POLICY.maxFiles) invalid('At most five attachments are allowed')
  let total = 0
  const result: ValidatedChatFile[] = []
  for (const [ordinal, file] of files.entries()) {
    if (!file.size || file.size > CHAT_ATTACHMENT_POLICY.maxFileBytes) invalid('Attachment must be between 1 byte and 10 MiB')
    total += file.size
    if (total > CHAT_ATTACHMENT_POLICY.maxTotalBytes) invalid('Attachments exceed 20 MiB total')
    const fileName = safeChatFileName(file.name)
    const extension = fileName.split('.').at(-1)?.toLowerCase() ?? ''
    const format = Object.entries(CHAT_ATTACHMENT_POLICY.formats).find(([key]) => key === extension)
    const suppliedContentType = file.type.split(';', 1)[0].trim().toLowerCase()
    if (!format || suppliedContentType && suppliedContentType !== 'application/octet-stream' && suppliedContentType !== format[1]) invalid('Attachment type and extension must agree')
    const contentType = format[1]
    const bytes = Buffer.from(await file.arrayBuffer())
    if (bytes.length !== file.size) invalid('Attachment size changed')
    const kind = contentType.startsWith('image/') ? 'IMAGE' : 'FILE'
    try {
      if (kind === 'IMAGE') {
        const image = sharp(bytes, { failOn: 'error', limitInputPixels: 40_000_000 })
        const metadata = await image.metadata()
        const expected = contentType === 'image/jpeg' ? 'jpeg' : extension
        if (metadata.format !== expected || !metadata.width || !metadata.height || (metadata.pages ?? 1) !== 1) invalid('Invalid raster image')
        await image.raw().toBuffer()
      } else if (extension === 'txt' || extension === 'csv') {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
        if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(text) || /^\s*<(?:!doctype|html|svg|script)/i.test(text)) invalid('Invalid UTF-8 text')
      } else if (extension === 'pdf') {
        if (!/^%PDF-(?:1\.[0-7]|2\.0)/.test(bytes.subarray(0, 12).toString('ascii'))
          || !/%%EOF\s*$/.test(bytes.subarray(-1024).toString('ascii'))) invalid('Invalid PDF signature')
      } else {
        if (bytes.length < 22) invalid('Invalid ZIP container')
        const names = zipEntries(bytes)
        const officePart = extension === 'docx' ? 'word/document.xml' : extension === 'xlsx' ? 'xl/workbook.xml' : extension === 'pptx' ? 'ppt/presentation.xml' : null
        if (officePart && (!names.has('[Content_Types].xml') || !names.has(officePart)
          || [...names].some((name) => /vbaProject\.bin$/i.test(name)))) invalid('Office container does not match extension')
      }
    } catch (error) {
      if (error instanceof ChatServiceError) throw error
      invalid('Attachment bytes could not be verified')
    }
    result.push({ ordinal, fileName, contentType, byteSize: bytes.length, kind, sha256: createHash('sha256').update(bytes).digest('hex'), bytes })
  }
  return result
}

export function chatContentDisposition(fileName: string, inline: boolean): string {
  const fallback = fileName.replace(/[^\x20-\x7e]|["\\]/g, '_') || 'attachment'
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
  return `${inline ? 'inline' : 'attachment'}; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

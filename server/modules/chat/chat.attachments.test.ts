import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { S3Client } from '@aws-sdk/client-s3'
import type { HttpRequest } from '@smithy/types'
import { LocalUploadStorage, S3UploadStorage } from '#server/modules/upload/upload.storage.ts'
import { CHAT_ATTACHMENT_POLICY } from '#/lib/chat-attachments.ts'
import { chatContentDisposition, safeChatFileName, validateChatFiles } from './chat.attachments.ts'
import { parseChatMessage } from './chat.multipart.ts'

describe('verified chat file boundaries', () => {
  it('accepts MIME parameters while retaining canonical types and strict UTF-8 validation', async () => {
    const [file] = await validateChatFiles([new File(['สวัสดี'], 'note.txt', { type: ' Text/Plain ;charset=utf-8' })])
    expect(file).toMatchObject({ contentType: 'text/plain', kind: 'FILE', byteSize: 18 })
    expect(new TextDecoder().decode(file.bytes)).toBe('สวัสดี')
    await expect(validateChatFiles([new File(['text'], 'note.txt', { type: 'image/png;charset=utf-8' })])).rejects.toMatchObject({ code: 'INVALID_CHAT_ATTACHMENT' })
    await expect(validateChatFiles([new File([new Uint8Array([0xff])], 'note.txt', { type: 'text/plain;charset=utf-8' })])).rejects.toMatchObject({ code: 'INVALID_CHAT_ATTACHMENT' })
  })
  it('checks Office identity and ZIP expansion without extracting content', async () => {
    const bytes = Buffer.from('UEsDBBQAAAAAABAJTl3HHBc8CAAAAAgAAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbDxUeXBlcy8+UEsDBBQAAAAAABAJTl1fW9FMCwAAAAsAAAARAAAAd29yZC9kb2N1bWVudC54bWw8ZG9jdW1lbnQvPlBLAQIUABQAAAAAABAJTl3HHBc8CAAAAAgAAAATAAAAAAAAAAAAAACAAQAAAABbQ29udGVudF9UeXBlc10ueG1sUEsBAhQAFAAAAAAAEAlOXV9b0UwLAAAACwAAABEAAAAAAAAAAAAAAIABOQAAAHdvcmQvZG9jdW1lbnQueG1sUEsFBgAAAAACAAIAgAAAAHMAAAAAAA==', 'base64')
    const mime = CHAT_ATTACHMENT_POLICY.formats.docx
    const result = await validateChatFiles([new File([new Uint8Array(bytes)], 'file.docx', { type: mime })])
    expect(result[0]).toMatchObject({ kind: 'FILE', contentType: mime, byteSize: bytes.length })
    expect(Buffer.from(result[0].bytes)).toEqual(bytes)
    await expect(validateChatFiles([new File([new Uint8Array(bytes)], 'file.xlsx', { type: CHAT_ATTACHMENT_POLICY.formats.xlsx })])).rejects.toMatchObject({ code: 'INVALID_CHAT_ATTACHMENT' })
    const bomb = Buffer.from(bytes)
    const directory = bomb.indexOf(Buffer.from('504b0102', 'hex'))
    bomb.writeUInt32LE(101 * 1024 * 1024, directory + 24)
    await expect(validateChatFiles([new File([new Uint8Array(bomb)], 'file.zip', { type: 'application/zip' })])).rejects.toMatchObject({ code: 'INVALID_CHAT_ATTACHMENT' })
    const disagreement = Buffer.from(bytes)
    disagreement.write('other/document.xml', disagreement.indexOf('word/document.xml'))
    await expect(validateChatFiles([new File([new Uint8Array(disagreement)], 'file.docx', { type: mime })])).rejects.toMatchObject({ code: 'INVALID_CHAT_ATTACHMENT' })
  })
  it('retains Thai filenames and original verified image bytes', async () => {
    const bytes = await sharp({ create: { width: 2, height: 3, channels: 3, background: '#ff0000' } }).png().toBuffer()
    const [file] = await validateChatFiles([new File([new Uint8Array(bytes)], 'รูปภาพ.png', { type: 'image/png' })])
    expect(file).toMatchObject({ fileName: 'รูปภาพ.png', kind: 'IMAGE', ordinal: 0, contentType: 'image/png', byteSize: bytes.length })
    expect(Buffer.from(file.bytes)).toEqual(bytes)
    expect(file.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(chatContentDisposition(file.fileName, true)).toContain("filename*=UTF-8''%E0")
    expect(safeChatFileName('../รูป\u202eภาพ.png')).toBe('..รูปภาพ.png')
  })
  it('validates PDF and strict text even when OS MIME is missing', async () => {
    const files = await validateChatFiles([
      new File(['%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n'], 'file.pdf', { type: 'application/pdf' }),
      new File(['ชื่อ,จำนวน\nทดสอบ,1\n'], 'ตาราง.csv'),
      new File(['A document'], 'note.txt', { type: 'application/octet-stream' }),
    ])
    expect(files.map((file) => [file.kind, file.contentType])).toEqual([
      ['FILE', 'application/pdf'], ['FILE', 'text/csv'], ['FILE', 'text/plain'],
    ])
  })
  it('rejects executable, active, malformed, empty and mismatched content', async () => {
    for (const file of [
      new File(['<svg/>'], 'image.svg', { type: 'image/svg+xml' }),
      new File(['MZ'], 'file.exe', { type: 'application/octet-stream' }),
      new File(['not png'], 'image.png', { type: 'image/png' }),
      new File(['%PDF-1.7'], 'file.pdf', { type: 'application/pdf' }),
      new File(['text'], 'note.txt', { type: 'image/png' }),
      new File([new Uint8Array([0xff, 0xff])], 'note.txt', { type: 'text/plain' }),
      new File(['binary\0'], 'note.txt', { type: 'text/plain' }),
      new File(['<html>active</html>'], 'note.txt', { type: 'text/plain' }),
      new File([], 'note.txt', { type: 'text/plain' }),
      new File(['PK\u0003\u0004junk'], 'file.zip', { type: 'application/zip' }),
    ]) await expect(validateChatFiles([file])).rejects.toMatchObject({ code: 'INVALID_CHAT_ATTACHMENT', status: 400 })
  })
  it('enforces count, individual bytes and aggregate bytes', async () => {
    const small = new File(['a'], 'note.txt', { type: 'text/plain' })
    await expect(validateChatFiles(Array(6).fill(small))).rejects.toMatchObject({ code: 'INVALID_CHAT_ATTACHMENT' })
    await expect(validateChatFiles([new File([new Uint8Array(CHAT_ATTACHMENT_POLICY.maxFileBytes + 1)], 'big.txt', { type: 'text/plain' })])).rejects.toMatchObject({ code: 'INVALID_CHAT_ATTACHMENT' })
    const large = new File(['x'.repeat(8 * 1024 * 1024)], 'big.txt', { type: 'text/plain' })
    await expect(validateChatFiles([large, large, large])).rejects.toMatchObject({ code: 'INVALID_CHAT_ATTACHMENT' })
  })
})

describe('bounded multipart parsing', () => {
  const url = 'http://localhost/api/chats/11111111-1111-4111-8111-111111111111/messages'
  it('preserves repeated ordered files and rejects duplicate scalars', async () => {
    const form = new FormData()
    form.append('clientMessageId', randomUUID())
    form.append('files', new File(['one'], 'one.txt', { type: 'text/plain' }))
    form.append('files', new File(['two'], 'two.txt', { type: 'text/plain' }))
    const parsed = await parseChatMessage(new Request(url, { method: 'POST', body: form }))
    expect(parsed).toMatchObject({ messageType: 'text', files: [{ name: 'one.txt' }, { name: 'two.txt' }] })
    form.append('clientMessageId', randomUUID())
    await expect(parseChatMessage(new Request(url, { method: 'POST', body: form }))).rejects.toMatchObject({ code: 'INVALID_MESSAGE' })
  })
  it('rejects actual oversized chunked bytes before multipart parsing', async () => {
    let count = 0
    let canceled = false
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { count++; controller.enqueue(new Uint8Array(1024 * 1024)); },
      cancel() { canceled = true },
    })
    const request = new Request(url, { method: 'POST', body: stream, headers: { 'content-type': 'multipart/form-data; boundary=test' }, ...{ duplex: 'half' } })
    await expect(parseChatMessage(request)).rejects.toMatchObject({ status: 413, code: 'PAYLOAD_TOO_LARGE' })
    expect(canceled).toBe(true)
    expect(count).toBeLessThanOrEqual(23)
  })
})

describe('private immutable local chat objects', () => {
  it('never overwrites bytes or exposes generic signed/public access', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'chat-objects-'))
    try {
      const storage = new LocalUploadStorage({ rootDir: path.join(directory, 'public'), privateRootDir: path.join(directory, 'private'), signingSecret: 'test' })
      const key = `private/chat/${randomUUID()}`
      await storage.chatObjects.putNew({ key, bytes: new TextEncoder().encode('original'), contentType: 'text/plain' })
      await expect(storage.chatObjects.putNew({ key, bytes: new TextEncoder().encode('changed'), contentType: 'text/plain' })).rejects.toMatchObject({ code: 'EEXIST' })
      expect(await new Response(await storage.chatObjects.read(key)).text()).toBe('original')
      await expect(storage.createPresignedGetUrl({ key, contentType: 'text/plain', expiresIn: 900 })).rejects.toThrow('participant')
      await expect(storage.createPresignedPutUrl({ key, contentType: 'text/plain', fileSize: 8, expiresIn: 900 })).rejects.toThrow('participant')
      expect(() => storage.getPublicUrl(key)).toThrow('participant')
      await expect(storage.createPresignedGetUrl({ key: key.replace('private/chat/', 'private/other/../chat/'), contentType: 'text/plain', expiresIn: 900 })).rejects.toThrow('participant')
      expect((await storage.chatObjects.list({ limit: 1 })).items.map((item) => item.key)).toEqual([key])
      await storage.chatObjects.remove(key)
      expect((await storage.chatObjects.list({ limit: 1 })).items).toEqual([])
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
  it('rejects private chat bytes beneath the configured public root', async () => {
    const storage = new LocalUploadStorage({ rootDir: path.resolve('public'), privateRootDir: path.resolve('public/private'), signingSecret: 'test' })
    await expect(storage.chatObjects.putNew({ key: `private/chat/${randomUUID()}`, bytes: new Uint8Array([1]), contentType: 'text/plain' })).rejects.toThrow('outside public')
  })
})

it('sends conditional private S3 writes with checksum and propagates precondition failure', async () => {
  const requests: Array<{ method: string; path: string; headers: Record<string, string> }> = []
  let status = 200
  const config = { endpoint: 'https://storage.example.test', region: 'auto', bucket: 'private', accessKeyId: 'test', secretAccessKey: 'test' }
  const client = new S3Client({ endpoint: config.endpoint, region: config.region, forcePathStyle: true,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    requestHandler: { handle: async (request: HttpRequest) => {
      requests.push({ method: request.method, path: request.path, headers: request.headers })
      return { response: { statusCode: status, headers: {}, body: new Uint8Array() } }
    } },
  })
  try {
    const storage = new S3UploadStorage(config, client)
    const key = `private/chat/${randomUUID()}`
    await storage.chatObjects.putNew({ key, bytes: new TextEncoder().encode('original'), contentType: 'text/plain' })
    expect(requests[0]).toMatchObject({ method: 'PUT', path: `/private/${key}`, headers: {
      'if-none-match': '*', 'cache-control': 'private, no-store', 'content-type': 'text/plain',
      'x-amz-checksum-sha256': 'BoLF8gdvCZw0z90VqeBjhJ7UN6SWd+b8xbQZjHZXW+U=',
    } })
    expect(requests[0].headers['x-amz-acl']).toBeUndefined()
    status = 412
    await expect(storage.chatObjects.putNew({ key, bytes: new TextEncoder().encode('changed'), contentType: 'text/plain' })).rejects.toMatchObject({ $metadata: { httpStatusCode: 412 } })
    expect(() => storage.getPublicUrl(key)).toThrow('participant')
  } finally { client.destroy() }
})

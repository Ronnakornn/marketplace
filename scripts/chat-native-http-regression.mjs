import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import sharp from 'sharp'
import { mock } from 'bun:test'
import { Elysia } from 'elysia'
import { createObservabilityPlugin } from '../server/plugins/observability.plugin.ts'
import { createSecurityPlugin } from '../server/plugins/security.plugin.ts'
import { getSecurityConfigFromEnv } from '../server/modules/security/security.config.ts'
import { isChatParserError } from '../server/modules/chat/chat.errors.ts'
import { getChatRequestBodyLimit } from '../server/modules/chat/chat.multipart.ts'
import { validateChatFiles } from '../server/modules/chat/chat.attachments.ts'
import { MetricsCollector } from '../server/modules/observability/metrics.collector.ts'
import { getObservabilityConfigFromEnv } from '../server/modules/observability/observability.config.ts'
import { request as httpRequest } from 'node:http'
import { CHAT_ATTACHMENT_POLICY } from '../app/lib/chat-attachments.ts'

mock.module('../server/modules/auth/auth.ts', () => ({ getSocialProviderAvailability: () => ({}), auth: { handler: () => new Response(null, { status: 404 }) } }))
mock.module('../server/modules/auth/auth.context.ts', () => ({ getAuthContext: async () => {
  await new Promise(resolve => setTimeout(resolve, 10))
  return { user: { id: 'buyer', role: 'USER', status: 'ACTIVE' }, session: { id: 'session' } }
} }))
const { createChatRoutes } = await import('../server/modules/chat/chat.routes.ts')
const context = { logger: { error() {}, info() {}, warn() {}, debug() {} }, config: { environment: 'production' } }
const app = new Elysia()
  .use(createObservabilityPlugin(context, new MetricsCollector(), getObservabilityConfigFromEnv({}), isChatParserError))
  .use(createSecurityPlugin(context, getSecurityConfigFromEnv({ RATE_LIMIT_ENABLED: 'false' }), isChatParserError, getChatRequestBodyLimit))
  .use(createChatRoutes({ chatService: { sendMessage: async (_actor, _room, body) => {
    const verified = await validateChatFiles(body.files ?? [])
    assert.deepEqual(verified.map(file => file.contentType), (body.files ?? []).map(file => file.name.endsWith('.txt') ? 'text/plain' : 'image/png'))
    return {
      body: body.body,
      files: await Promise.all((body.files ?? []).map(async file => ({ name: file.name, size: file.size, text: file.name.endsWith('.txt') ? await file.text() : undefined }))),
    }
  } } }))
  .listen({ hostname: '127.0.0.1', port: 0, maxRequestBodySize: CHAT_ATTACHMENT_POLICY.maxRequestBytes + 1024 * 1024 })
const url = `http://127.0.0.1:${app.server.port}/api/chats/33333333-3333-4333-8333-333333333333/messages`
async function expectResponse(response, status, expected) {
  assert.equal(response.status, status, await response.clone().text())
  assert.deepEqual(await response.json(), expected)
}
async function chunked(bytes, contentType) {
  return new Promise((resolve, reject) => {
    const request = httpRequest(url, { method: 'POST', headers: { 'content-type': contentType } }, response => {
      const chunks = []
      response.on('data', chunk => chunks.push(chunk))
      response.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: response.statusCode })))
      response.on('error', reject)
    })
    request.on('error', reject)
    for (let offset = 0; offset < bytes.length; offset += 64 * 1024) request.write(bytes.subarray(offset, offset + 64 * 1024))
    request.end()
  })
}
try {
  await expectResponse(await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messageType: 'text', body: 'hello' }) }), 200, { body: 'hello', files: [] })
  const form = new FormData()
  form.append('clientMessageId', '55555555-5555-4555-8555-555555555555')
  form.append('body', 'caption')
  const png = await sharp(randomBytes(800 * 800 * 3), { raw: { width: 800, height: 800, channels: 3 } }).png().toBuffer()
  assert.ok(png.length > 1024 * 1024)
  form.append('files', new File([png], 'รูปภาพ.png', { type: 'image/png' }))
  form.append('files', new File(['สวัสดี'], 'เอกสาร.txt', { type: 'text/plain' }))
  const expected = { body: 'caption', files: [{ name: 'รูปภาพ.png', size: png.length }, { name: 'เอกสาร.txt', size: 18, text: 'สวัสดี' }] }
  await expectResponse(await fetch(url, { method: 'POST', body: form }), 200, expected)
  const encoded = new Request(url, { method: 'POST', body: form })
  const contentType = encoded.headers.get('content-type')
  await expectResponse(await chunked(Buffer.from(await encoded.arrayBuffer()), contentType), 200, expected)
  const sixFiles = new FormData()
  sixFiles.append('clientMessageId', '55555555-5555-4555-8555-555555555555')
  for (let index = 0; index < 6; index++) sixFiles.append('files', new File(['hello'], `${index}.txt`, { type: 'text/plain' }))
  await expectResponse(await fetch(url, { method: 'POST', body: sixFiles }), 400, { error: { code: 'INVALID_CHAT_ATTACHMENT', message: 'At most five attachments are allowed' } })
  const duplicateField = new FormData()
  duplicateField.append('clientMessageId', '55555555-5555-4555-8555-555555555555')
  duplicateField.append('body', 'first')
  duplicateField.append('body', 'second')
  await expectResponse(await fetch(url, { method: 'POST', body: duplicateField }), 400, { error: { code: 'INVALID_MESSAGE', message: 'Invalid multipart field' } })
  const invalid = { error: { code: 'INVALID_MESSAGE', message: 'Invalid message body' } }
  await expectResponse(await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }), 400, invalid)
  await expectResponse(await chunked(Buffer.from('malformed'), 'multipart/form-data; boundary=missing'), 400, invalid)
  const tooLarge = { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request payload is too large' } }
  await expectResponse(await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: ' '.repeat(1024 * 1024 + 1) }), 413, { error: { code: 'INVALID_REQUEST', message: 'Request failed' } })
  await expectResponse(await chunked(Buffer.alloc(1024 * 1024 + 1, 32), 'application/json'), 413, tooLarge)
  await expectResponse(await chunked(Buffer.alloc(CHAT_ATTACHMENT_POLICY.maxRequestBytes + 1, 32), 'multipart/form-data; boundary=missing'), 413, tooLarge)
  process.stdout.write('Native Bun HTTP chat parser regression passed\n')
} finally {
  await app.stop(true)
}

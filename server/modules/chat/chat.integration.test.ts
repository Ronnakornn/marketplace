import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, utimes } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PrismaClient } from '#generated/client/client.ts'
import { numericThresholdFixture, thresholdContext, thresholdSale } from '#server/test-support/numeric-threshold.fixture.ts'
import { InMemoryRealtimeAdapter, RealtimeService } from '#server/modules/realtime'
import { PrismaRealtimeRepository } from '#server/modules/realtime/realtime.repository.ts'
import { PrismaChatRepository } from './chat.repository.ts'
import { ChatService } from './chat.service.ts'
import { LocalUploadStorage } from '#server/modules/upload/upload.storage.ts'
import type { ChatPrivateObjectStore } from '#server/modules/upload/upload.types.ts'

const databaseUrl = process.env['CHAT_TEST_DATABASE_URL']

describe.skipIf(!databaseUrl)('chat persistence and participant contract on PostgreSQL', () => {
  let db: PrismaClient
  beforeAll(() => {
    if (!databaseUrl) throw new Error('CHAT_TEST_DATABASE_URL is required')
    const url = new URL(databaseUrl)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_test')) throw new Error('Use an isolated local *_test database')
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
  })
  afterAll(async () => { await db?.$disconnect() })

  async function fixture(objects?: ChatPrivateObjectStore) {
    const data = await numericThresholdFixture(db)
    const repo = new PrismaChatRepository(thresholdContext, db)
    const realtime = new RealtimeService(thresholdContext, new PrismaRealtimeRepository(thresholdContext, db), new InMemoryRealtimeAdapter(thresholdContext))
    const publish = vi.spyOn(realtime, 'publish')
    const service = new ChatService(thresholdContext, repo, realtime, undefined, objects)
    const room = await service.createRoom(data.buyer, { shopId: data.shop.id })
    return { ...data, repo, service, publish, room }
  }

  it('creates one buyer/shop room under concurrent requests without sending a message', async () => {
    const f = await fixture()
    const other = await db.user.create({ data: { name: 'Concurrent buyer', email: `${randomUUID()}@example.test` } })
    const rooms = await Promise.all(Array.from({ length: 12 }, () => f.service.createRoom(other, { shopId: f.shop.id })))
    expect(new Set(rooms.map((room) => room.roomId)).size).toBe(1)
    expect(await db.chatThread.count({ where: { buyerId: other.id, shopId: f.shop.id } })).toBe(1)
    expect(await db.chatMessage.count({ where: { threadId: rooms[0].roomId } })).toBe(0)
  })

  it('persists one immutable UUID send and publishes once despite concurrent retries', async () => {
    const f = await fixture()
    const id = randomUUID()
    const input = { messageType: 'text', body: '  Hello shop  ', clientMessageId: id } as const
    const results = await Promise.all(Array.from({ length: 10 }, () => f.service.sendMessage(f.buyer, f.room.roomId, input)))
    expect(results.map((room) => room.sentMessage.id)).toEqual(Array(10).fill(id))
    expect(results[0].sentMessage.body).toBe('Hello shop')
    expect(await db.chatMessage.count({ where: { threadId: f.room.roomId } })).toBe(1)
    expect(f.publish).toHaveBeenCalledTimes(3)
    for (const body of ['Different payload', '']) {
      await expect(f.service.sendMessage(f.buyer, f.room.roomId, { ...input, body })).rejects.toMatchObject({ status: body ? 409 : 400 })
    }
    await expect(f.service.sendMessage(f.owner, f.room.roomId, input)).rejects.toMatchObject({ code: 'MESSAGE_ID_CONFLICT', status: 409 })
  })

  it('rejects global UUID reuse across rooms without revealing the original content', async () => {
    const f = await fixture()
    const other = await db.user.create({ data: { name: 'Other buyer', email: `${randomUUID()}@example.test` } })
    const second = await f.service.createRoom(other, { shopId: f.shop.id })
    const id = randomUUID()
    await f.service.sendMessage(f.buyer, f.room.roomId, { messageType: 'text', body: 'Private original', clientMessageId: id })
    await expect(f.service.sendMessage(other, second.roomId, { messageType: 'text', body: 'Other buyer text', clientMessageId: id })).rejects.toMatchObject({
      message: 'Message ID was already used for a different message', code: 'MESSAGE_ID_CONFLICT', status: 409,
    })
    expect(await db.chatMessage.count({ where: { threadId: second.roomId } })).toBe(0)
  })

  it('serializes concurrent sends after the greatest legacy timestamp and sets activity', async () => {
    const f = await fixture()
    const future = new Date(Date.now() + 60_000)
    await db.chatMessage.create({ data: { threadId: f.room.roomId, senderId: f.owner.id, body: 'Legacy', createdAt: future } })
    await Promise.all(Array.from({ length: 16 }, (_, index) => f.service.sendMessage(index % 2 ? f.owner : f.buyer, f.room.roomId, {
      messageType: 'text', body: `Concurrent ${index}`, clientMessageId: randomUUID(),
    })))
    const rows = await db.chatMessage.findMany({ where: { threadId: f.room.roomId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })
    expect(rows).toHaveLength(17)
    expect(rows[0].createdAt).toEqual(future)
    for (let index = 1; index < rows.length; index++) expect(rows[index].createdAt.getTime() - rows[index - 1].createdAt.getTime()).toBeGreaterThanOrEqual(1)
    const thread = await db.chatThread.findUniqueOrThrow({ where: { id: f.room.roomId } })
    expect(thread.lastMessageAt).toEqual(rows.at(-1)?.createdAt)
    expect(thread.updatedAt).toEqual(thread.lastMessageAt)
  })

  it('reads through an exact tied-timestamp ID and never regresses or changes activity', async () => {
    const f = await fixture()
    const prefix = randomUUID().slice(0, 24)
    const ids = ['000000000100', '000000000200', '000000000300'].map((suffix) => `${prefix}${suffix}`)
    const timestamp = new Date('2026-10-12T08:00:00Z')
    await db.chatMessage.createMany({ data: ids.map((id) => ({ id, threadId: f.room.roomId, senderId: f.owner.id, body: id, createdAt: timestamp })) })
    const before = await db.chatThread.findUniqueOrThrow({ where: { id: f.room.roomId } })
    const read = await f.service.markRead(f.buyer, f.room.roomId, 'buyer', ids[1])
    expect(read.readBoundary).toEqual({ messageId: ids[1], createdAt: timestamp.toISOString() })
    expect(read.unreadCount).toBe(1)
    f.publish.mockClear()
    const stale = await f.service.markRead(f.buyer, f.room.roomId, 'buyer', ids[0])
    expect(stale.readBoundary).toEqual(read.readBoundary)
    expect(stale.unreadCount).toBe(1)
    expect(f.publish).not.toHaveBeenCalled()
    const after = await db.chatThread.findUniqueOrThrow({ where: { id: f.room.roomId } })
    expect(after.updatedAt).toEqual(before.updatedAt)
    await Promise.all([ids[0], ids[2], ids[1]].map((id) => f.service.markRead(f.buyer, f.room.roomId, 'buyer', id)))
    expect((await f.service.getRoom(f.buyer, f.room.roomId)).readBoundary?.messageId).toBe(ids[2])
    await f.service.markRead(f.buyer, f.room.roomId)
    expect((await f.service.getRoom(f.buyer, f.room.roomId)).unreadCount).toBe(0)
  })

  it('preserves timestamp-only read semantics for legacy tied messages without repeated publication', async () => {
    const f = await fixture()
    const createdAt = new Date('2026-10-10T07:00:00Z')
    const message = await db.chatMessage.create({ data: { threadId: f.room.roomId, senderId: f.owner.id, body: 'Legacy read', createdAt } })
    await db.chatThread.update({ where: { id: f.room.roomId }, data: { buyerReadAt: createdAt, buyerReadMessageId: null } })
    f.publish.mockClear()
    for (let attempt = 0; attempt < 3; attempt++) {
      const room = await f.service.markRead(f.buyer, f.room.roomId, 'buyer', message.id)
      expect(room.readBoundary).toEqual({ messageId: null, createdAt: createdAt.toISOString() })
      expect(room.unreadCount).toBe(0)
    }
    expect(f.publish).not.toHaveBeenCalled()
  })

  it('preserves cursor history amid new arrivals and catches up beyond one page', async () => {
    const f = await fixture()
    const base = new Date('2026-10-10T08:00:00Z').getTime()
    await db.chatMessage.createMany({ data: Array.from({ length: 75 }, (_, index) => ({
      threadId: f.room.roomId, senderId: f.owner.id, body: `Older ${index}`, createdAt: new Date(base + index),
    })) })
    const first = await f.service.getRoom(f.buyer, f.room.roomId, { limit: 30 })
    expect(first.messages?.map((message) => message.body)).toEqual(Array.from({ length: 30 }, (_, index) => `Older ${45 + index}`))
    const before = first.pagination?.beforeCursor ?? undefined
    const oldest = await f.service.getRoom(f.buyer, f.room.roomId, { limit: 30, before })
    await f.service.sendMessage(f.owner, f.room.roomId, { messageType: 'text', body: 'New arrival' })
    const repeat = await f.service.getRoom(f.buyer, f.room.roomId, { limit: 30, before })
    expect(repeat.messages?.map((message) => message.id)).toEqual(oldest.messages?.map((message) => message.id))
    await db.chatMessage.createMany({ data: Array.from({ length: 65 }, (_, index) => ({ threadId: f.room.roomId, senderId: f.owner.id, body: `Recovered ${index}`, createdAt: new Date(Date.now() + 1000 + index) })) })
    let after = first.pagination?.afterCursor ?? undefined
    const recovered: string[] = []
    let hasMore = true
    while (hasMore) {
      const page = await f.service.getRoom(f.buyer, f.room.roomId, { after, limit: 30 })
      recovered.push(...(page.messages ?? []).map((message) => message.body ?? ''))
      after = page.pagination?.afterCursor ?? after
      hasMore = page.pagination?.hasMore ?? false
    }
    expect(recovered).toEqual(['New arrival', ...Array.from({ length: 65 }, (_, index) => `Recovered ${index}`)])
    expect(new Set(recovered).size).toBe(66)
  })

  it('rejects cross-room cursors and reads, isolates actors and selected seller shop', async () => {
    const f = await fixture()
    const other = await fixture()
    const message = await other.service.sendMessage(other.buyer, other.room.roomId, { messageType: 'text', body: 'Other room' })
    await expect(f.service.getRoom(f.buyer, f.room.roomId, { before: message.sentMessage.id })).rejects.toMatchObject({ code: 'INVALID_MESSAGE_CURSOR' })
    await expect(f.service.markRead(f.buyer, f.room.roomId, 'buyer', message.sentMessage.id)).rejects.toMatchObject({ code: 'INVALID_READ_BOUNDARY' })
    for (const actor of [other.buyer, other.owner]) {
      await expect(f.service.getRoom(actor, f.room.roomId)).rejects.toMatchObject({ status: 403 })
      await expect(f.service.sendMessage(actor, f.room.roomId, { messageType: 'text', body: 'Forbidden' })).rejects.toMatchObject({ status: 403 })
      await expect(f.service.markRead(actor, f.room.roomId)).rejects.toMatchObject({ status: 403 })
    }
    await expect(f.service.getRoom(f.owner, f.room.roomId, { scope: 'seller', shopId: other.shop.id })).rejects.toMatchObject({ status: 403 })
  })

  it('keeps history readable when chat is disabled, but rejects creation and new sends', async () => {
    const f = await fixture()
    await db.shopSetting.create({ data: { shopId: f.shop.id, chatEnabled: false } })
    for (const actor of [f.buyer, f.owner]) {
      expect(await f.service.getRoom(actor, f.room.roomId)).toMatchObject({ canSend: false, chatEnabled: false })
      await expect(f.service.sendMessage(actor, f.room.roomId, { messageType: 'text', body: 'Disabled' })).rejects.toMatchObject({ code: 'SHOP_CHAT_DISABLED' })
    }
    await expect(f.service.createRoom(f.buyer, { shopId: f.shop.id })).rejects.toMatchObject({ code: 'SHOP_CHAT_DISABLED' })
    await db.shop.update({ where: { id: f.shop.id }, data: { status: 'SUSPENDED' } })
    await expect(f.service.sendMessage(f.buyer, f.room.roomId, { messageType: 'text', body: 'Inactive' })).rejects.toMatchObject({ code: 'SELLER_SHOP_NOT_ACTIVE' })
  })

  it('validates per-message context and rejects attachment URLs and oversized text', async () => {
    const f = await fixture()
    const order = await thresholdSale(db, f)
    const send = await f.service.sendMessage(f.buyer, f.room.roomId, { messageType: 'text', body: 'This product/order', productId: f.product.id, orderId: order.order.id })
    expect(send.sentMessage.product?.id).toBe(f.product.id)
    expect(send.sentMessage.order?.id).toBe(order.order.id)
    const stored = await db.chatMessage.findUniqueOrThrow({ where: { id: send.sentMessage.id } })
    expect(stored.productId).toBe(f.product.id)
    expect(stored.orderId).toBe(order.order.id)
    const other = await fixture()
    await expect(f.service.sendMessage(f.buyer, f.room.roomId, { messageType: 'text', body: 'Forged context', productId: other.product.id })).rejects.toMatchObject({ code: 'INVALID_MESSAGE' })
    for (const messageType of ['image', 'text'] as const) await expect(f.service.sendMessage(f.buyer, f.room.roomId, { messageType, body: 'Unsafe', attachments: ['https://example.test/private.png'] })).rejects.toMatchObject({ code: 'CHAT_ATTACHMENT_UNSUPPORTED' })
    await expect(f.service.sendMessage(f.buyer, f.room.roomId, { messageType: 'text', body: 'x'.repeat(4001) })).rejects.toMatchObject({ code: 'MESSAGE_TOO_LONG' })
  })

  it('excludes soft-deleted messages from history, last message and unread counts', async () => {
    const f = await fixture()
    const visible = await f.service.sendMessage(f.owner, f.room.roomId, { messageType: 'text', body: 'Visible' })
    const hidden = await f.service.sendMessage(f.owner, f.room.roomId, { messageType: 'text', body: 'Deleted' })
    await db.chatMessage.update({ where: { id: hidden.sentMessage.id }, data: { deletedAt: new Date() } })
    const room = await f.service.getRoom(f.buyer, f.room.roomId)
    expect(room.messages?.map((message) => message.id)).toEqual([visible.sentMessage.id])
    expect(room.lastMessage?.id).toBe(visible.sentMessage.id)
    expect(room.unreadCount).toBe(1)
    expect(room.pagination?.total).toBe(1)
  })

  it('persists ordered files, exact bytes and immutable UUID replay with participant reads', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'chat-persistence-'))
    try {
      const storage = new LocalUploadStorage({ rootDir: path.join(directory, 'public'), privateRootDir: path.join(directory, 'private'), signingSecret: 'test' })
      const f = await fixture(storage.chatObjects)
      const png = new Uint8Array(await sharp({ create: { width: 3, height: 4, channels: 3, background: '#00ff00' } }).png().toBuffer())
      const files = [new File([png], 'รูปภาพ.png', { type: 'image/png' }), new File(['เอกสาร'], 'เอกสาร.txt', { type: 'text/plain' })]
      const input = { messageType: 'text', files, clientMessageId: randomUUID() } as const
      const concurrent = await Promise.all(Array.from({ length: 4 }, () => f.service.sendMessage(f.buyer, f.room.roomId, input)))
      const first = concurrent[0]
      expect(concurrent.map((response) => response.sentMessage)).toEqual(Array(4).fill(first.sentMessage))
      expect(first.sentMessage).toMatchObject({ body: null, messageType: 'file', files: [{ fileName: 'รูปภาพ.png', kind: 'IMAGE' }, { fileName: 'เอกสาร.txt', kind: 'FILE' }] })
      const replay = await f.service.sendMessage(f.buyer, f.room.roomId, input)
      expect(replay.sentMessage).toEqual(first.sentMessage)
      expect(f.publish).toHaveBeenCalledTimes(3)
      expect((await storage.chatObjects.list({ limit: 100 })).items).toHaveLength(2)
      const id = first.sentMessage.files[0].id
      const content = await f.service.openAttachment(f.owner, f.room.roomId, id, 'seller', f.shop.id)
      expect(new Uint8Array(await new Response(content.stream).arrayBuffer())).toEqual(png)
      for (const changed of [
        { ...input, files: [...files].reverse() },
        { ...input, body: 'Changed caption' },
        { ...input, files: [new File([png], 'renamed.png', { type: 'image/png' }), files[1]] },
        { ...input, files: [files[0], new File(['other'], 'เอกสาร.txt', { type: 'text/plain' })] },
      ]) await expect(f.service.sendMessage(f.buyer, f.room.roomId, changed)).rejects.toMatchObject({ code: 'MESSAGE_ID_CONFLICT', status: 409 })
      expect(await db.chatAttachment.count({ where: { messageId: first.sentMessage.id } })).toBe(2)
      await expect(f.service.openAttachment({ id: randomUUID(), role: 'USER' }, f.room.roomId, id)).rejects.toMatchObject({ status: 403 })
      await expect(f.service.openAttachment({ id: f.buyer.id, role: 'ADMIN' }, f.room.roomId, id)).rejects.toMatchObject({ status: 403 })
      await expect(f.service.openAttachment(f.owner, f.room.roomId, id, 'seller', randomUUID())).rejects.toMatchObject({ status: 403 })
      const other = await fixture()
      await expect(f.service.openAttachment(other.buyer, other.room.roomId, id)).rejects.toMatchObject({ status: 404 })
      await db.shopSetting.upsert({ where: { shopId: f.shop.id }, create: { shopId: f.shop.id, chatEnabled: false }, update: { chatEnabled: false } })
      expect(await new Response((await f.service.openAttachment(f.buyer, f.room.roomId, first.sentMessage.files[1].id)).stream).text()).toBe('เอกสาร')
      await expect(f.service.sendMessage(f.buyer, f.room.roomId, { ...input, clientMessageId: randomUUID() })).rejects.toMatchObject({ code: 'SHOP_CHAT_DISABLED' })
      await db.chatMessage.update({ where: { id: first.sentMessage.id }, data: { deletedAt: new Date() } })
      await expect(f.service.openAttachment(f.owner, f.room.roomId, id)).rejects.toMatchObject({ status: 404 })
    } finally { await rm(directory, { recursive: true, force: true }) }
  })

  it('retains attachment bytes when a send fails before its transaction becomes visible', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'chat-inflight-'))
    let release: () => void = () => {}
    const commitGate = new Promise<void>((resolve) => { release = resolve })
    let transaction: Promise<unknown> | undefined
    try {
      const storage = new LocalUploadStorage({ rootDir: path.join(directory, 'public'), privateRootDir: path.join(directory, 'private'), signingSecret: 'test' })
      const f = await fixture(storage.chatObjects)
      let inserted: () => void = () => {}
      let failed: (error: unknown) => void = () => {}
      const insertedGate = new Promise<void>((resolve, reject) => { inserted = resolve; failed = reject })
      vi.spyOn(f.repo, 'createMessage').mockImplementationOnce(async (input) => {
        transaction = db.$transaction(async (tx) => {
          await tx.chatMessage.create({ data: {
            id: input.clientMessageId, threadId: input.roomId, senderId: input.senderId,
            messageType: input.messageType, body: input.body, attachments: [],
            productId: input.productId, orderId: input.orderId, files: { create: input.files },
          } })
          inserted()
          await commitGate
        }, { timeout: 15_000 })
        void transaction.catch(failed)
        await insertedGate
        throw new Error('connection lost before commit visibility')
      })
      const input = { messageType: 'text' as const, files: [new File(['still readable'], 'pending.txt', { type: 'text/plain' })], clientMessageId: randomUUID() }
      await expect(f.service.sendMessage(f.buyer, f.room.roomId, input)).rejects.toThrow('connection lost before commit visibility')
      expect(await db.chatMessage.count({ where: { id: input.clientMessageId } })).toBe(0)
      const pending = await storage.chatObjects.list({ limit: 100 })
      expect(pending.items).toHaveLength(1)
      expect(await f.repo.referencedStorageKeys(pending.items.map((item) => item.key))).toEqual([])
      expect(await new Response(await storage.chatObjects.read(pending.items[0].key)).text()).toBe('still readable')
      release()
      await transaction
      const attachment = await db.chatAttachment.findFirstOrThrow({ where: { messageId: input.clientMessageId } })
      expect(await new Response((await f.service.openAttachment(f.owner, f.room.roomId, attachment.id)).stream).text()).toBe('still readable')
    } finally {
      release()
      await transaction
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('cleans partial writes and preserves referenced bytes after an uncertain commit', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'chat-failure-'))
    try {
      const storage = new LocalUploadStorage({ rootDir: path.join(directory, 'public'), privateRootDir: path.join(directory, 'private'), signingSecret: 'test' })
      const f = await fixture(storage.chatObjects)
      const files = [new File(['one'], 'one.txt', { type: 'text/plain' }), new File(['two'], 'two.txt', { type: 'text/plain' })]
      const put = storage.chatObjects.putNew.bind(storage.chatObjects)
      const spy = vi.spyOn(storage.chatObjects, 'putNew').mockImplementationOnce(put).mockRejectedValueOnce(new Error('storage failed'))
      await expect(f.service.sendMessage(f.buyer, f.room.roomId, { messageType: 'text', files, clientMessageId: randomUUID() })).rejects.toThrow('storage failed')
      expect(await db.chatMessage.count({ where: { threadId: f.room.roomId } })).toBe(0)
      expect((await storage.chatObjects.list({ limit: 100 })).items).toHaveLength(0)
      spy.mockRestore()
      const original = f.repo.createMessage.bind(f.repo)
      vi.spyOn(f.repo, 'createMessage').mockImplementationOnce(async (...args) => { await original(...args); throw new Error('lost commit acknowledgement') })
      const input = { messageType: 'text', files, clientMessageId: randomUUID() } as const
      await expect(f.service.sendMessage(f.buyer, f.room.roomId, input)).rejects.toThrow('lost commit acknowledgement')
      expect((await storage.chatObjects.list({ limit: 100 })).items).toHaveLength(2)
      const retry = await f.service.sendMessage(f.buyer, f.room.roomId, input)
      expect(retry.sentMessage.files).toHaveLength(2)
      expect(await new Response((await f.service.openAttachment(f.owner, f.room.roomId, retry.sentMessage.files[0].id)).stream).text()).toBe('one')
      const orphan = `private/chat/${randomUUID()}`
      await put({ key: orphan, bytes: new Uint8Array([1]), contentType: 'text/plain' })
      const old = new Date(Date.now() - 49 * 60 * 60 * 1000)
      for (const item of (await storage.chatObjects.list({ limit: 100 })).items) await utimes(path.join(directory, 'private', item.key), old, old)
      expect(await f.service.reconcileAttachments()).toMatchObject({ removed: 1, examined: 3 })
      expect((await storage.chatObjects.list({ limit: 100 })).items).toHaveLength(2)
      vi.spyOn(f.repo, 'referencedStorageKeys').mockRejectedValueOnce(new Error('DB down'))
      await expect(f.service.reconcileAttachments()).rejects.toThrow('DB down')
      expect((await storage.chatObjects.list({ limit: 100 })).items).toHaveLength(2)
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
})

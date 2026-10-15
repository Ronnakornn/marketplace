import { prisma } from '#server/lib/prisma.ts'
import { createLogger } from '#server/infrastructure/logging/index.ts'
import { PrismaChatRepository } from '#server/modules/chat/chat.repository.ts'
import { ChatService } from '#server/modules/chat/chat.service.ts'
import { createUploadStorageFromEnv } from '#server/modules/upload/upload.storage.ts'

const environment = process.env['NODE_ENV'] ?? 'development'
const context = { config: { environment }, logger: createLogger({ environment }) }
const service = new ChatService(context, new PrismaChatRepository(context, prisma), undefined, undefined, createUploadStorageFromEnv().chatObjects)
try {
  const result = await service.reconcileAttachments({ cursor: process.argv[2], limit: 100 })
  context.logger.info('Chat attachment reconciliation completed', result)
} finally { await prisma.$disconnect() }

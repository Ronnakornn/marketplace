import type { ILogger } from '#server/infrastructure/logging/index.ts'
import { createLogger } from '#server/infrastructure/logging/index.ts'
import { prisma } from '#server/lib/prisma.ts'
import { PrismaCatalogRepository } from '#server/modules/catalog/catalog.repository.ts'
import { CatalogService } from '#server/modules/catalog/catalog.service.ts'
import { PrismaUserRepository } from '#server/modules/user/user.repository.ts'
import { UserService } from '#server/modules/user/user.service.ts'

export interface AppConfig {
  environment: string
}

export interface AppContext {
  logger: ILogger
  config: AppConfig
}

export interface ServiceContainer {
  appContext: AppContext
  catalogService: CatalogService
  userService: UserService
}

export function createContainer(): ServiceContainer {
  const environment = process.env['NODE_ENV'] ?? 'development'
  const logger = createLogger({ environment })
  const config: AppConfig = { environment }
  const appContext: AppContext = { logger, config }

  const catalogRepo = new PrismaCatalogRepository(appContext, prisma)
  const catalogService = new CatalogService(appContext, catalogRepo)
  const userRepo = new PrismaUserRepository(appContext, prisma)
  const userService = new UserService(appContext, userRepo)

  return { appContext, catalogService, userService }
}

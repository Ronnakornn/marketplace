import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { AiSearchConfig } from './ai-search.config.ts'
import { AiSearchServiceError } from './ai-search.errors.ts'

interface OpenAiEmbeddingResponse {
  data?: Array<{ embedding?: number[] }>
  error?: { message?: string }
}

export interface IEmbeddingService {
  embedText(input: string): Promise<number[]>
}

export class EmbeddingService implements IEmbeddingService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private config: AiSearchConfig,
    private fetcher: typeof fetch = fetch,
  ) {
    this.logger = appContext.logger
  }

  async embedText(input: string): Promise<number[]> {
    if (!this.config.openAiApiKey) {
      throw new AiSearchServiceError('OpenAI API key is not configured', 503, 'VECTOR_SEARCH_UNAVAILABLE')
    }

    try {
      const response = await this.fetcher('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.openAiApiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.embeddingModel,
          input,
        }),
      })
      const payload = await response.json() as OpenAiEmbeddingResponse
      if (!response.ok) {
        throw new Error(payload.error?.message || `OpenAI embeddings request failed with ${response.status}`)
      }
      const embedding = payload.data?.[0]?.embedding
      if (!Array.isArray(embedding) || embedding.length === 0 || embedding.some((value) => typeof value !== 'number')) {
        throw new Error('OpenAI embeddings response did not include a numeric embedding')
      }
      return embedding
    } catch (error) {
      this.logger.warn('EmbeddingService.embedText failed', {
        code: 'VECTOR_SEARCH_UNAVAILABLE',
        message: error instanceof Error ? error.message : String(error),
      })
      throw new AiSearchServiceError('Vector search is unavailable', 503, 'VECTOR_SEARCH_UNAVAILABLE')
    }
  }
}

import type { AppContext } from '#server/context/app-context.ts'
import type { ILogger } from '#server/infrastructure/logging/index.ts'
import type { AiSearchConfig } from './ai-search.config.ts'
import { AiSearchServiceError } from './ai-search.errors.ts'
import type { AiSearchProductItem, AiSearchService } from './ai-search.service.ts'

const MAX_MESSAGES = 12
const MAX_MESSAGE_LENGTH = 1000

export interface ShoppingAssistantMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ShoppingAssistantInput {
  messages: ShoppingAssistantMessage[]
  locale?: string
}

export interface ShoppingAssistantCitation {
  productId: string
  title: string
}

export interface ShoppingAssistantResponse {
  answer: string
  recommendedProducts: AiSearchProductItem[]
  citations?: ShoppingAssistantCitation[]
}

interface OpenAiChatResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
  error?: {
    message?: string
  }
}

export class ShoppingAssistantService {
  private logger: ILogger

  constructor(
    appContext: AppContext,
    private config: AiSearchConfig,
    private aiSearchService: AiSearchService,
    private fetcher: typeof fetch = fetch,
  ) {
    this.logger = appContext.logger
  }

  async answer(input: ShoppingAssistantInput): Promise<ShoppingAssistantResponse> {
    this.assertEnabled()
    const messages = this.normalizeMessages(input.messages)
    const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user')
    if (!latestUserMessage) {
      throw new AiSearchServiceError('At least one user message is required', 400, 'INVALID_AI_QUERY')
    }

    const retrieval = await this.aiSearchService.search({
      query: latestUserMessage.content,
      limit: 5,
      locale: input.locale,
    })
    const recommendedProducts = retrieval.items
    const citations = recommendedProducts.map((product) => ({
      productId: product.productId,
      title: product.title,
    }))

    return {
      answer: await this.generateAnswer(messages, recommendedProducts),
      recommendedProducts,
      ...(citations.length > 0 ? { citations } : {}),
    }
  }

  private async generateAnswer(
    messages: ShoppingAssistantMessage[],
    products: AiSearchProductItem[],
  ): Promise<string> {
    if (!this.config.openAiApiKey) return this.deterministicAnswer(products)

    try {
      const response = await this.fetcher('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.openAiApiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.assistantModel,
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content: [
                'You are a shopping assistant for a marketplace.',
                'Answer only from the supplied public product context.',
                'Never expose admin, seller-private, user-private, auth, payment, or operational data.',
                'Never invent pricing, stock, ratings, shops, discounts, or products.',
                'If the context is insufficient, say what is uncertain and ask a clarifying question.',
              ].join(' '),
            },
            {
              role: 'user',
              content: `Public product context:\n${this.formatProductContext(products)}`,
            },
            ...messages.map((message) => ({
              role: message.role,
              content: message.content,
            })),
          ],
        }),
      })
      const payload = await response.json() as OpenAiChatResponse
      if (!response.ok) throw new Error(payload.error?.message || `OpenAI chat request failed with ${response.status}`)
      const answer = payload.choices?.[0]?.message?.content?.trim()
      return answer || this.deterministicAnswer(products)
    } catch (error) {
      this.logger.warn('ShoppingAssistantService.generateAnswer failed', {
        code: 'AI_ASSISTANT_FAILED',
        message: error instanceof Error ? error.message : String(error),
      })
      return this.deterministicAnswer(products)
    }
  }

  private deterministicAnswer(products: AiSearchProductItem[]): string {
    if (products.length === 0) {
      return 'I could not find matching active products from the available catalog. Please share a little more detail, such as category, budget, or preferred brand.'
    }
    const topProducts = products.slice(0, 3).map((product) => {
      const price = product.price.maxPriceCents === null
        ? `${product.price.minPriceCents} ${product.price.currency}`
        : `${product.price.minPriceCents}-${product.price.maxPriceCents} ${product.price.currency}`
      return `${product.title} from ${product.shop.name} at ${price}, stock ${product.stockAvailability}`
    })
    return `Based on active catalog matches, consider ${topProducts.join('; ')}. Pricing and stock are from the current product records. If you need a tighter recommendation, please clarify budget, size, or preferred category.`
  }

  private normalizeMessages(messages: ShoppingAssistantMessage[]): ShoppingAssistantMessage[] {
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
      throw new AiSearchServiceError('Assistant messages are invalid', 400, 'INVALID_AI_QUERY')
    }

    return messages.map((message) => {
      const content = typeof message.content === 'string' ? message.content.trim() : ''
      if ((message.role !== 'user' && message.role !== 'assistant') || !content || content.length > MAX_MESSAGE_LENGTH) {
        throw new AiSearchServiceError('Assistant messages are invalid', 400, 'INVALID_AI_QUERY')
      }
      return {
        role: message.role,
        content,
      }
    })
  }

  private assertEnabled(): void {
    if (!this.config.enabled) {
      throw new AiSearchServiceError('AI search is disabled', 403, 'AI_SEARCH_DISABLED')
    }
  }

  private formatProductContext(products: AiSearchProductItem[]): string {
    if (products.length === 0) return 'No active product matches.'
    return products.map((product, index) => JSON.stringify({
      citation: index + 1,
      productId: product.productId,
      title: product.title,
      description: product.description,
      category: product.category?.name ?? null,
      price: product.price,
      rating: product.rating,
      shopName: product.shop.name,
      stockAvailability: product.stockAvailability,
    })).join('\n')
  }
}

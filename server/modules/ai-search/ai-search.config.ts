export interface AiSearchConfig {
  enabled: boolean
  openAiApiKey: string | null
  embeddingModel: string
  assistantModel: string
  vectorDbUrl: string | null
}

export function getAiSearchConfigFromEnv(env: Record<string, string | undefined> = process.env): AiSearchConfig {
  return {
    enabled: parseBoolean(env['AI_SEARCH_ENABLED'], false),
    openAiApiKey: env['OPENAI_API_KEY']?.trim() || null,
    embeddingModel: env['EMBEDDING_MODEL']?.trim() || 'text-embedding-3-small',
    assistantModel: env['AI_ASSISTANT_MODEL']?.trim() || 'gpt-4o-mini',
    vectorDbUrl: env['VECTOR_DB_URL']?.trim() || null,
  }
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

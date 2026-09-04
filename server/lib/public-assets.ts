const SECRET_QUERY_KEYS = new Set([
  'x-amz-signature',
  'x-amz-credential',
  'x-amz-security-token',
  'awsaccesskeyid',
  'x-goog-signature',
  'x-goog-credential',
  'signature',
  'token',
  'access_token',
  'expires',
])

export function isPublicAssetUrl(url: string): boolean {
  const value = url.trim()
  if (!value) return false

  try {
    const isRelative = value.startsWith('/') && !value.startsWith('//')
    const parsed = new URL(value, 'https://marketplace.invalid')
    if (!isRelative) {
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
      if (!allowedPublicAssetOrigins().has(parsed.origin)) return false
    }
    if (parsed.username || parsed.password) return false
    return [...parsed.searchParams.keys()].every((key) => !SECRET_QUERY_KEYS.has(key.toLowerCase()))
  } catch {
    return false
  }
}

function allowedPublicAssetOrigins(): Set<string> {
  const values = [
    process.env['NEXT_PUBLIC_APP_URL'],
    process.env['NEXT_PUBLIC_SITE_URL'],
    process.env['NEXT_PUBLIC_CDN_URL'],
    process.env['NEXT_PUBLIC_ASSET_BASE_URL'],
    process.env['S3_PUBLIC_BASE_URL'],
    process.env['LOCAL_UPLOAD_PUBLIC_BASE_URL'],
  ]
  return new Set(values.flatMap((value) => {
    if (!value) return []
    try {
      return [new URL(value).origin]
    } catch {
      return []
    }
  }))
}

export function publicAssetUrl(url: string | null | undefined): string | null {
  return url && isPublicAssetUrl(url) ? url : null
}
